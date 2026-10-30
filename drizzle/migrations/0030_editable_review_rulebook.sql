ALTER TABLE public.health_review_rules ADD COLUMN operational_rules jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.peer_review_assessments ADD COLUMN policy_snapshot jsonb;
ALTER TABLE public.file_versions ADD COLUMN peer_policy_snapshot jsonb;
CREATE TABLE public.review_rule_history (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid, before_rules jsonb, after_rules jsonb NOT NULL, effective_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.review_rule_history TO authenticated;
GRANT ALL ON public.review_rule_history TO service_role;
ALTER TABLE public.review_rule_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read rule changes" ON public.review_rule_history FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE OR REPLACE FUNCTION public.audit_review_rules() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF to_jsonb(OLD)-'updated_at'-'updated_by' IS DISTINCT FROM to_jsonb(NEW)-'updated_at'-'updated_by' THEN INSERT INTO public.review_rule_history(actor_id,before_rules,after_rules) VALUES (auth.uid(),to_jsonb(OLD),to_jsonb(NEW)); END IF; RETURN NEW; END $$;
CREATE TRIGGER review_rules_audit AFTER UPDATE ON public.health_review_rules FOR EACH ROW EXECUTE FUNCTION public.audit_review_rules();
CREATE OR REPLACE FUNCTION public.snapshot_peer_upload_policy() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF EXISTS(SELECT 1 FROM public.files WHERE id=NEW.file_id AND subsection='Mid-Semester Peer Reviews' AND NOT is_template) THEN SELECT operational_rules INTO NEW.peer_policy_snapshot FROM public.health_review_rules WHERE id='global'; END IF; RETURN NEW; END $$;
CREATE TRIGGER snapshot_peer_upload_policy BEFORE INSERT ON public.file_versions FOR EACH ROW EXECUTE FUNCTION public.snapshot_peer_upload_policy();
CREATE OR REPLACE FUNCTION public.gate_peer_review_version() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE f public.files; permission public.peer_review_final_uploads; latest_attempt integer; attempt_limit integer;
BEGIN
 SELECT * INTO f FROM public.files WHERE id=NEW.file_id;
 IF f.subsection <> 'Mid-Semester Peer Reviews' OR f.is_template THEN RETURN NEW; END IF;
 IF f.assigned_to IS NULL THEN RAISE EXCEPTION 'Select whose peer review this is before uploading.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.team_members WHERE team_id=f.team_id AND user_id=f.assigned_to) THEN RAISE EXCEPTION 'Peer review owner must be a member of this team.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(f.team_id::text || f.assigned_to::text,0));
 SELECT * INTO permission FROM public.peer_review_final_uploads WHERE team_id=f.team_id AND student_id=f.assigned_to FOR UPDATE;
 IF permission.consumed_at IS NOT NULL THEN RAISE EXCEPTION 'The final submission has already been uploaded. Contact your instructor.'; END IF;
 SELECT attempt INTO latest_attempt FROM public.peer_review_assessments WHERE team_id=f.team_id AND user_id=f.assigned_to AND status='assessed' ORDER BY attempt DESC LIMIT 1;
 attempt_limit := greatest(2,least(6,coalesce((NEW.peer_policy_snapshot->>'max_submissions')::integer,3)));
 IF permission.id IS NOT NULL THEN UPDATE public.peer_review_final_uploads SET version_id=NEW.id,consumed_at=now() WHERE id=permission.id;
 ELSIF coalesce(latest_attempt,0)>=attempt_limit THEN RAISE EXCEPTION 'Peer reviews are frozen after % submissions. Your instructor must allow your final submission during the meeting.',attempt_limit; END IF;
 RETURN NEW;
END $$;