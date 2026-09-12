CREATE POLICY "Signed in users read course proof materials"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'proofs' AND (storage.foldername(name))[1] = 'course');

CREATE POLICY "Students read their own proof uploads"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'proofs'
    AND (storage.foldername(name))[1] = 'submissions'
    AND ((storage.foldername(name))[2] = auth.uid()::text OR public.has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Students upload their own proof file"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'proofs'
    AND (storage.foldername(name))[1] = 'submissions'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

CREATE POLICY "Admins manage the proofs bucket"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'proofs' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'proofs' AND public.has_role(auth.uid(), 'admin'));