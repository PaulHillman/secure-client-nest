CREATE TABLE public.pm_duties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  details text,
  due_at timestamptz,
  order_index integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pm_duties TO authenticated;
GRANT ALL ON public.pm_duties TO service_role;

ALTER TABLE public.pm_duties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can view duties" ON public.pm_duties
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage duties insert" ON public.pm_duties
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage duties update" ON public.pm_duties
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage duties delete" ON public.pm_duties
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER pm_duties_set_updated_at BEFORE UPDATE ON public.pm_duties
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.pm_duty_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  duty_id uuid NOT NULL REFERENCES public.pm_duties(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  completed_by uuid,
  completed_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (duty_id, team_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pm_duty_completions TO authenticated;
GRANT ALL ON public.pm_duty_completions TO service_role;

ALTER TABLE public.pm_duty_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can view completions" ON public.pm_duty_completions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Team members or admins record completion" ON public.pm_duty_completions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_team_member(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Team members or admins update completion" ON public.pm_duty_completions
  FOR UPDATE TO authenticated
  USING (public.is_team_member(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_team_member(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Team members or admins remove completion" ON public.pm_duty_completions
  FOR DELETE TO authenticated
  USING (public.is_team_member(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER pm_duty_completions_set_updated_at BEFORE UPDATE ON public.pm_duty_completions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();