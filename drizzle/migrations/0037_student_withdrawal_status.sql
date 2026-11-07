ALTER TABLE public.profiles ADD COLUMN is_withdrawn boolean NOT NULL DEFAULT false, ADD COLUMN withdrawal_changed_at timestamptz, ADD COLUMN withdrawal_changed_by uuid;
CREATE OR REPLACE FUNCTION public.protect_student_withdrawal() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.is_withdrawn OR NEW.withdrawal_changed_at IS NOT NULL OR NEW.withdrawal_changed_by IS NOT NULL THEN RAISE EXCEPTION 'Withdrawal status must be changed by an instructor after account creation' USING ERRCODE='42501'; END IF;
 ELSIF NEW.is_withdrawn IS DISTINCT FROM OLD.is_withdrawn OR NEW.withdrawal_changed_at IS DISTINCT FROM OLD.withdrawal_changed_at OR NEW.withdrawal_changed_by IS DISTINCT FROM OLD.withdrawal_changed_by THEN
  IF NOT coalesce(public.has_role(auth.uid(),'admin'),false) THEN RAISE EXCEPTION 'Instructor access required to change withdrawal status' USING ERRCODE='42501'; END IF;
  IF public.has_role(NEW.id,'admin') OR NOT public.has_role(NEW.id,'student') THEN RAISE EXCEPTION 'Only student accounts can be withdrawn'; END IF;
  NEW.withdrawal_changed_at:=now(); NEW.withdrawal_changed_by:=auth.uid();
  IF NEW.is_withdrawn IS DISTINCT FROM OLD.is_withdrawn THEN
   INSERT INTO public.admin_audit_log(actor_id,action,archive_name,details) VALUES(auth.uid(),CASE WHEN NEW.is_withdrawn THEN 'student_withdrawn' ELSE 'student_reinstated' END,NEW.name,jsonb_build_object('student_id',NEW.id,'before',OLD.is_withdrawn,'after',NEW.is_withdrawn,'changed_at',NEW.withdrawal_changed_at));
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_student_withdrawal BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_student_withdrawal();
CREATE OR REPLACE FUNCTION public.set_student_withdrawal(_student_id uuid,_withdrawn boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT coalesce(public.has_role(auth.uid(),'admin'),false) THEN RAISE EXCEPTION 'Instructor access required' USING ERRCODE='42501'; END IF;
 IF _withdrawn IS NULL THEN RAISE EXCEPTION 'Withdrawal status required'; END IF;
 IF public.has_role(_student_id,'admin') OR NOT public.has_role(_student_id,'student') THEN RAISE EXCEPTION 'Only student accounts can be withdrawn'; END IF;
 UPDATE public.profiles SET is_withdrawn=_withdrawn WHERE id=_student_id AND is_withdrawn IS DISTINCT FROM _withdrawn;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=_student_id) THEN RAISE EXCEPTION 'Student not found'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.set_student_withdrawal(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_student_withdrawal(uuid,boolean) TO authenticated;
COMMENT ON COLUMN public.profiles.is_withdrawn IS 'Reversible instructor-managed withdrawal. Preserves identity, memberships and contributions; excludes current participation expectations and app email recipients.';