CREATE POLICY "vault templates upload" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'vault' AND (storage.foldername(name))[1] = 'templates' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "vault templates update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'vault' AND (storage.foldername(name))[1] = 'templates' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "vault templates delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'vault' AND (storage.foldername(name))[1] = 'templates' AND has_role(auth.uid(), 'admin'));