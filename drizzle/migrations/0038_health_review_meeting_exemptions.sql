CREATE TABLE public.health_review_meeting_exemptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
 semester_start date NOT NULL,
 excused_count integer NOT NULL CHECK (excused_count > 0),
 reason text NOT NULL CHECK (length(trim(reason)) > 0),
 approved_by uuid NOT NULL,
 approved_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(team_id, semester_start)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_review_meeting_exemptions TO authenticated;
GRANT ALL ON public.health_review_meeting_exemptions TO service_role;
ALTER TABLE public.health_review_meeting_exemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Instructors manage meeting exemptions" ON public.health_review_meeting_exemptions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));