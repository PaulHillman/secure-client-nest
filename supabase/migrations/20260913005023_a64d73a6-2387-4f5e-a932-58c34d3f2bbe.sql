CREATE TABLE public.role_study_progress (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  role text NOT NULL,
  checked integer[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id)
);
GRANT SELECT, INSERT, UPDATE ON public.role_study_progress TO authenticated;
GRANT ALL ON public.role_study_progress TO service_role;
ALTER TABLE public.role_study_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students read their own role study"
  ON public.role_study_progress FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Students save their own role study"
  ON public.role_study_progress FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Students update their own role study"
  ON public.role_study_progress FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));