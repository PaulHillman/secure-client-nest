CREATE TABLE public.health_report_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  file_id uuid NOT NULL,
  team_id uuid,
  logins_shown integer NOT NULL DEFAULT 0,
  last_session_id text,
  first_shown_at timestamptz,
  last_shown_at timestamptz,
  clicked_at timestamptz,
  view_count integer NOT NULL DEFAULT 0,
  last_viewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, file_id)
);
GRANT SELECT, INSERT, UPDATE ON public.health_report_views TO authenticated;
GRANT ALL ON public.health_report_views TO service_role;
ALTER TABLE public.health_report_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or admin read" ON public.health_report_views FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "own insert" ON public.health_report_views FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "own update" ON public.health_report_views FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());