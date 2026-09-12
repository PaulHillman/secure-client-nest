DROP POLICY IF EXISTS "Students read non-agenda proof materials" ON public.proof_materials;

CREATE POLICY "Admins read proof materials"
  ON public.proof_materials
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));