CREATE TABLE public.peer_review_assessments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES public.profiles(id),
 team_id uuid NOT NULL REFERENCES public.teams(id),
 file_id uuid REFERENCES public.files(id),
 version_id uuid REFERENCES public.file_versions(id),
 attempt integer NOT NULL DEFAULT 1,
 score integer CHECK (score BETWEEN 0 AND 10),
 status text NOT NULL DEFAULT 'assessed',
 strengths jsonb NOT NULL DEFAULT '[]',
 concerns jsonb NOT NULL DEFAULT '[]',
 changes jsonb NOT NULL DEFAULT '[]',
 summary text NOT NULL DEFAULT '',
 criteria_snapshot text NOT NULL,
 email_body text NOT NULL,
 student_email_status text NOT NULL DEFAULT 'pending',
 instructor_email_status text NOT NULL DEFAULT 'pending',
 pm_email_status text NOT NULL DEFAULT 'pending',
 assessed_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(version_id)
);
GRANT SELECT, INSERT, UPDATE ON public.peer_review_assessments TO authenticated;
GRANT ALL ON public.peer_review_assessments TO service_role;
ALTER TABLE public.peer_review_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read assessments" ON public.peer_review_assessments FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins retain assessments" ON public.peer_review_assessments FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') AND assessed_by = auth.uid());
CREATE POLICY "Admins record delivery" ON public.peer_review_assessments FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));