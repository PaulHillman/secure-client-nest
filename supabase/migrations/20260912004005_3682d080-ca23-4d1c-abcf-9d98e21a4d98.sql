-- Readiness state shared by every requirement
CREATE TYPE public.readiness_status AS ENUM (
  'not_started', 'in_progress', 'submitted', 'needs_revision', 'approved'
);

-- 1. Catalogue of requirements (the six modules to start with)
CREATE TABLE public.project_requirements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  alias TEXT,
  description TEXT,
  module_number INTEGER,
  order_index INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.project_requirements TO authenticated;
GRANT ALL ON public.project_requirements TO service_role;
ALTER TABLE public.project_requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "requirements readable by signed-in users"
  ON public.project_requirements FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage requirements"
  ON public.project_requirements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER project_requirements_set_updated_at
  BEFORE UPDATE ON public.project_requirements
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 2. Professor kickoff: opens a requirement for a section, with a due date
CREATE TABLE public.requirement_openings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requirement_key TEXT NOT NULL REFERENCES public.project_requirements(key) ON DELETE CASCADE,
  section TEXT NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_at TIMESTAMPTZ,
  opened_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (requirement_key, section)
);
GRANT SELECT ON public.requirement_openings TO authenticated;
GRANT ALL ON public.requirement_openings TO service_role;
ALTER TABLE public.requirement_openings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "openings readable by signed-in users"
  ON public.requirement_openings FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage openings"
  ON public.requirement_openings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER requirement_openings_set_updated_at
  BEFORE UPDATE ON public.requirement_openings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3. Per-team progress on each requirement
CREATE TABLE public.team_requirement_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  requirement_key TEXT NOT NULL REFERENCES public.project_requirements(key) ON DELETE CASCADE,
  status public.readiness_status NOT NULL DEFAULT 'not_started',
  owner_id UUID,
  revision_note TEXT,
  submitted_at TIMESTAMPTZ,
  decided_at TIMESTAMPTZ,
  decided_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_id, requirement_key)
);
GRANT SELECT, INSERT, UPDATE ON public.team_requirement_status TO authenticated;
GRANT ALL ON public.team_requirement_status TO service_role;
ALTER TABLE public.team_requirement_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team members read own team status"
  ON public.team_requirement_status FOR SELECT TO authenticated
  USING (public.is_team_member(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "team members create own team status"
  ON public.team_requirement_status FOR INSERT TO authenticated
  WITH CHECK (public.is_team_member(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "team members update own team status"
  ON public.team_requirement_status FOR UPDATE TO authenticated
  USING (public.is_team_member(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_team_member(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER team_requirement_status_set_updated_at
  BEFORE UPDATE ON public.team_requirement_status
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX idx_trs_team ON public.team_requirement_status(team_id);
CREATE INDEX idx_trs_requirement ON public.team_requirement_status(requirement_key);

-- 4. Nudge log: the PM chasing a teammate
CREATE TABLE public.requirement_nudges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  requirement_key TEXT NOT NULL,
  target_user_id UUID NOT NULL,
  sent_by UUID NOT NULL,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.requirement_nudges TO authenticated;
GRANT ALL ON public.requirement_nudges TO service_role;
ALTER TABLE public.requirement_nudges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team members read own team nudges"
  ON public.requirement_nudges FOR SELECT TO authenticated
  USING (public.is_team_member(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "pm and admin send nudges"
  ON public.requirement_nudges FOR INSERT TO authenticated
  WITH CHECK (
    sent_by = auth.uid()
    AND (public.is_team_pm(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  );
CREATE INDEX idx_nudges_team ON public.requirement_nudges(team_id);

-- 5. Seed the six modules
INSERT INTO public.project_requirements (key, title, alias, description, module_number, order_index) VALUES
  ('team_setup', 'Team Setup', 'Team Charter', 'Team name, every member holding a role, agreed meeting day, time, place and mode.', 1, 10),
  ('client_proposal', 'Client Proposal', 'Client Proposal', 'Company, manager, title, industry, size, location and why this company.', 2, 20),
  ('research_brief', 'Research Brief', 'Research Brief', 'Company and industry research filed in the vault.', 3, 30),
  ('interview_plan', 'Interview Plan', 'Interview Plan', 'Interview questions from every member plus the compiled final set.', 4, 40),
  ('video_plan', 'Video Plan', 'Video Plan', 'B-roll, transcript, drafts and final submission.', 5, 50),
  ('reflection', 'Reflection & Peer Review', 'Reflection', 'End-of-semester reflection and peer review.', 6, 60);