ALTER TABLE public.health_review_rules ADD COLUMN IF NOT EXISTS peer_revision_closed_at timestamptz NOT NULL DEFAULT '2026-11-02 05:00:00+00';
ALTER TABLE public.health_review_rules ADD COLUMN IF NOT EXISTS peer_booking_closed_at timestamptz NOT NULL DEFAULT '2026-11-02 16:27:00+00';
ALTER TABLE public.peer_review_meetings ADD COLUMN IF NOT EXISTS booking_created_at timestamptz;
CREATE OR REPLACE FUNCTION public.gate_peer_review_version() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE f public.files; permission public.peer_review_final_uploads; latest_attempt integer; attempt_limit integer; cutoff timestamptz;
BEGIN
 SELECT * INTO f FROM public.files WHERE id=NEW.file_id;
 IF f.subsection <> 'Mid-Semester Peer Reviews' OR f.is_template THEN RETURN NEW; END IF;
 IF f.assigned_to IS NULL THEN RAISE EXCEPTION 'Select whose peer review this is before uploading.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.team_members WHERE team_id=f.team_id AND user_id=f.assigned_to) THEN RAISE EXCEPTION 'Peer review owner must be a member of this team.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(f.team_id::text || f.assigned_to::text,0));
 SELECT * INTO permission FROM public.peer_review_final_uploads WHERE team_id=f.team_id AND student_id=f.assigned_to FOR UPDATE;
 IF permission.consumed_at IS NOT NULL THEN RAISE EXCEPTION 'The final submission has already been uploaded. Contact your instructor.'; END IF;
 SELECT peer_revision_closed_at INTO cutoff FROM public.health_review_rules WHERE id='global';
 IF clock_timestamp() >= coalesce(cutoff,'2026-11-02 05:00:00+00'::timestamptz) AND permission.id IS NULL THEN RAISE EXCEPTION 'Peer-review revisions closed November 1 at 11:59 p.m. Detroit time. This late revision has not been accepted. Contact Professor Hillman.'; END IF;
 SELECT attempt INTO latest_attempt FROM public.peer_review_assessments WHERE team_id=f.team_id AND user_id=f.assigned_to AND status='assessed' ORDER BY attempt DESC LIMIT 1;
 attempt_limit := greatest(2,least(6,coalesce((NEW.peer_policy_snapshot->>'max_submissions')::integer,3)));
 IF permission.id IS NOT NULL THEN UPDATE public.peer_review_final_uploads SET version_id=NEW.id,consumed_at=now() WHERE id=permission.id;
 ELSIF coalesce(latest_attempt,0)>=attempt_limit THEN RAISE EXCEPTION 'Peer reviews are frozen after % submissions. Your instructor must allow your final submission during the meeting.',attempt_limit; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.gate_peer_review_file_creation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cutoff timestamptz;
BEGIN
 IF NEW.subsection <> 'Mid-Semester Peer Reviews' OR NEW.is_template THEN RETURN NEW; END IF;
 SELECT peer_revision_closed_at INTO cutoff FROM public.health_review_rules WHERE id='global';
 IF clock_timestamp() >= coalesce(cutoff,'2026-11-02 05:00:00+00'::timestamptz) AND NOT EXISTS(SELECT 1 FROM public.peer_review_final_uploads WHERE student_id=NEW.assigned_to AND team_id=NEW.team_id AND consumed_at IS NULL) THEN RAISE EXCEPTION 'Peer-review revisions closed November 1 at 11:59 p.m. Detroit time. This late revision has not been accepted. Contact Professor Hillman.'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER gate_peer_review_file_creation BEFORE INSERT ON public.files FOR EACH ROW EXECUTE FUNCTION public.gate_peer_review_file_creation();
CREATE OR REPLACE FUNCTION public.gate_peer_meeting_booking() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cutoff timestamptz;
BEGIN
 IF EXISTS(SELECT 1 FROM public.peer_review_meetings WHERE calendly_event_uri=NEW.calendly_event_uri AND student_id=NEW.student_id) THEN RETURN NEW; END IF;
 SELECT peer_booking_closed_at INTO cutoff FROM public.health_review_rules WHERE id='global';
 IF coalesce(NEW.booking_created_at,clock_timestamp()) > coalesce(cutoff,'2026-11-02 16:27:00+00'::timestamptz) THEN RAISE EXCEPTION 'New peer-review meeting bookings are closed. Contact Professor Hillman.'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER gate_peer_meeting_booking BEFORE INSERT ON public.peer_review_meetings FOR EACH ROW EXECUTE FUNCTION public.gate_peer_meeting_booking();
COMMENT ON COLUMN public.peer_review_meetings.booking_created_at IS 'Trusted Calendly booking creation time, not meeting time or local import time.';