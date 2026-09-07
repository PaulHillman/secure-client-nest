CREATE TABLE public.meeting_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  meeting_date DATE NOT NULL,
  meeting_time TIME NOT NULL,
  location TEXT NOT NULL,
  meeting_mode TEXT,
  as_agreed BOOLEAN NOT NULL DEFAULT true,
  deviation_reason TEXT,
  minutes_posted BOOLEAN NOT NULL DEFAULT false,
  minutes_file_id UUID REFERENCES public.files(id) ON DELETE SET NULL,
  logged_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_id, meeting_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_logs TO authenticated;
GRANT ALL ON public.meeting_logs TO service_role;

ALTER TABLE public.meeting_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members and admins can view meeting logs"
ON public.meeting_logs FOR SELECT TO authenticated
USING (public.is_team_member(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Team members and admins can add meeting logs"
ON public.meeting_logs FOR INSERT TO authenticated
WITH CHECK ((public.is_team_member(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin')) AND logged_by = auth.uid());

CREATE POLICY "Team members and admins can edit meeting logs"
ON public.meeting_logs FOR UPDATE TO authenticated
USING (public.is_team_member(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.is_team_member(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Team members and admins can delete meeting logs"
ON public.meeting_logs FOR DELETE TO authenticated
USING (public.is_team_member(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER meeting_logs_set_updated_at
BEFORE UPDATE ON public.meeting_logs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();