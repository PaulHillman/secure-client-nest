CREATE TABLE public.requirement_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  requirement_key text NOT NULL REFERENCES public.project_requirements(key) ON DELETE CASCADE,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_by uuid,
  submitted_at timestamptz,
  submit_count integer NOT NULL DEFAULT 0,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, requirement_key)
);

GRANT SELECT, INSERT, UPDATE ON public.requirement_submissions TO authenticated;
GRANT ALL ON public.requirement_submissions TO service_role;

ALTER TABLE public.requirement_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members read their submissions"
ON public.requirement_submissions FOR SELECT TO authenticated
USING (public.is_team_member(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Team members create their submissions"
ON public.requirement_submissions FOR INSERT TO authenticated
WITH CHECK (public.is_team_member(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Team members update their submissions"
ON public.requirement_submissions FOR UPDATE TO authenticated
USING (public.is_team_member(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.is_team_member(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER requirement_submissions_set_updated_at
BEFORE UPDATE ON public.requirement_submissions
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX idx_requirement_submissions_team ON public.requirement_submissions(team_id);