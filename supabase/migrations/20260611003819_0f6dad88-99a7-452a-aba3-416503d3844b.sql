
-- Audit log table
CREATE TABLE public.file_audit_log (
  id BIGSERIAL PRIMARY KEY,
  file_id UUID,
  team_id UUID,
  actor_id UUID,
  action TEXT NOT NULL CHECK (action IN ('insert','update','delete')),
  file_name TEXT,
  section TEXT,
  subsection TEXT,
  old_data JSONB,
  new_data JSONB,
  changed_fields TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX file_audit_log_created_at_idx ON public.file_audit_log (created_at DESC);
CREATE INDEX file_audit_log_team_id_idx ON public.file_audit_log (team_id);
CREATE INDEX file_audit_log_actor_id_idx ON public.file_audit_log (actor_id);
CREATE INDEX file_audit_log_file_id_idx ON public.file_audit_log (file_id);

GRANT SELECT ON public.file_audit_log TO authenticated;
GRANT ALL ON public.file_audit_log TO service_role;

ALTER TABLE public.file_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit log"
  ON public.file_audit_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger function
CREATE OR REPLACE FUNCTION public.log_file_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor UUID := auth.uid();
  changed TEXT[] := '{}';
  k TEXT;
  old_j JSONB;
  new_j JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.file_audit_log
      (file_id, team_id, actor_id, action, file_name, section, subsection, new_data)
    VALUES
      (NEW.id, NEW.team_id, COALESCE(actor, NEW.uploaded_by), 'insert',
       NEW.file_name, NEW.section, NEW.subsection, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    old_j := to_jsonb(OLD);
    new_j := to_jsonb(NEW);
    FOR k IN SELECT jsonb_object_keys(new_j) LOOP
      IF (old_j -> k) IS DISTINCT FROM (new_j -> k) AND k <> 'updated_at' THEN
        changed := changed || k;
      END IF;
    END LOOP;
    IF array_length(changed, 1) IS NULL THEN
      RETURN NEW;
    END IF;
    INSERT INTO public.file_audit_log
      (file_id, team_id, actor_id, action, file_name, section, subsection,
       old_data, new_data, changed_fields)
    VALUES
      (NEW.id, NEW.team_id, actor, 'update',
       NEW.file_name, NEW.section, NEW.subsection,
       old_j, new_j, changed);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.file_audit_log
      (file_id, team_id, actor_id, action, file_name, section, subsection, old_data)
    VALUES
      (OLD.id, OLD.team_id, actor, 'delete',
       OLD.file_name, OLD.section, OLD.subsection, to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER files_audit_log
  AFTER INSERT OR UPDATE OR DELETE ON public.files
  FOR EACH ROW EXECUTE FUNCTION public.log_file_change();
