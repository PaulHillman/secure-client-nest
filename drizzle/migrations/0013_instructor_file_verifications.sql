CREATE TABLE public.instructor_file_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  note text,
  verified_by uuid,
  verified_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, file_name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.instructor_file_verifications TO authenticated;
GRANT ALL ON public.instructor_file_verifications TO service_role;
ALTER TABLE public.instructor_file_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage file verifications" ON public.instructor_file_verifications FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Team members read file verifications" ON public.instructor_file_verifications FOR SELECT TO authenticated USING (public.is_team_member(team_id, auth.uid()));