CREATE TABLE public.proof_materials (
  proof_key text PRIMARY KEY,
  ready boolean NOT NULL DEFAULT false,
  audio_path text,
  transcript_text text,
  zip_path text,
  answer_key text,
  extra_instructions text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.proof_materials TO authenticated;
GRANT ALL ON public.proof_materials TO service_role;

ALTER TABLE public.proof_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can read proof materials"
  ON public.proof_materials FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage proof materials"
  ON public.proof_materials FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER proof_materials_set_updated_at
  BEFORE UPDATE ON public.proof_materials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.proof_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  proof_key text NOT NULL,
  role_at_submission team_job,
  response jsonb NOT NULL DEFAULT '{}'::jsonb,
  file_path text,
  file_name text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  feedback text,
  feedback_status text NOT NULL DEFAULT 'pending',
  feedback_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, proof_key)
);

CREATE INDEX proof_submissions_team_idx ON public.proof_submissions (team_id);
CREATE INDEX proof_submissions_proof_idx ON public.proof_submissions (proof_key);

GRANT SELECT, INSERT ON public.proof_submissions TO authenticated;
GRANT ALL ON public.proof_submissions TO service_role;

ALTER TABLE public.proof_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students read their own and teammates submissions"
  ON public.proof_submissions FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR (team_id IS NOT NULL AND public.is_team_member(team_id, auth.uid()))
  );

CREATE POLICY "Students record their own submission"
  ON public.proof_submissions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER proof_submissions_set_updated_at
  BEFORE UPDATE ON public.proof_submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.proof_materials (proof_key, ready) VALUES
  ('pm_agenda', true),
  ('pm_norms', true),
  ('comms_minutes', false),
  ('comms_record', true),
  ('liaison_interview', true),
  ('liaison_loop', true),
  ('video_disaster', true),
  ('tech_zip', false),
  ('tech_presentation', true),
  ('research_company', true)
ON CONFLICT (proof_key) DO NOTHING;