ALTER TABLE public.peer_review_meetings ADD COLUMN IF NOT EXISTS booking_topic text;
ALTER TABLE public.peer_review_meetings ADD COLUMN IF NOT EXISTS identity_match text NOT NULL DEFAULT 'email';
CREATE POLICY "Admins manage peer review bookings" ON public.peer_review_meetings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.peer_review_meetings TO authenticated;

CREATE TABLE public.peer_review_final_uploads (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 team_id uuid NOT NULL REFERENCES public.teams(id),
 student_id uuid NOT NULL REFERENCES public.profiles(id),
 authorized_by uuid NOT NULL REFERENCES public.profiles(id),
 authorized_at timestamptz NOT NULL DEFAULT now(),
 version_id uuid REFERENCES public.file_versions(id) ON DELETE SET NULL,
 consumed_at timestamptz,
 UNIQUE(team_id, student_id)
);
GRANT SELECT, INSERT ON public.peer_review_final_uploads TO authenticated;
GRANT ALL ON public.peer_review_final_uploads TO service_role;
ALTER TABLE public.peer_review_final_uploads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own final upload permission or admin" ON public.peer_review_final_uploads FOR SELECT TO authenticated USING (student_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin authorizes one final upload" ON public.peer_review_final_uploads FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') AND authorized_by = auth.uid() AND version_id IS NULL AND consumed_at IS NULL AND EXISTS (SELECT 1 FROM public.team_members m JOIN public.teams t ON t.id=m.team_id WHERE m.team_id=team_id AND m.user_id=student_id AND NOT t.is_test));

CREATE FUNCTION public.gate_peer_review_version() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f public.files; permission public.peer_review_final_uploads; latest_attempt integer; latest_score integer;
BEGIN
 SELECT * INTO f FROM public.files WHERE id=NEW.file_id;
 IF f.subsection <> 'Mid-Semester Peer Reviews' OR f.is_template THEN RETURN NEW; END IF;
 IF f.assigned_to IS NULL THEN RAISE EXCEPTION 'Select whose peer review this is before uploading.'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.team_members WHERE team_id=f.team_id AND user_id=f.assigned_to) THEN RAISE EXCEPTION 'Peer review owner must be a member of this team.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(f.team_id::text || f.assigned_to::text,0));
 SELECT * INTO permission FROM public.peer_review_final_uploads WHERE team_id=f.team_id AND student_id=f.assigned_to FOR UPDATE;
 IF permission.consumed_at IS NOT NULL THEN RAISE EXCEPTION 'The final submission has already been uploaded. Contact your instructor.'; END IF;
 SELECT attempt,score INTO latest_attempt,latest_score FROM public.peer_review_assessments WHERE team_id=f.team_id AND user_id=f.assigned_to AND status='assessed' ORDER BY attempt DESC LIMIT 1;
 IF permission.id IS NOT NULL THEN
   UPDATE public.peer_review_final_uploads SET version_id=NEW.id,consumed_at=now() WHERE id=permission.id;
 ELSIF coalesce(latest_attempt,0)>=3 THEN
   RAISE EXCEPTION 'Peer reviews are frozen after three submissions. Your instructor must allow your final submission during the meeting.';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER gate_peer_review_version AFTER INSERT ON public.file_versions FOR EACH ROW EXECUTE FUNCTION public.gate_peer_review_version();
REVOKE ALL ON FUNCTION public.gate_peer_review_version() FROM PUBLIC;
