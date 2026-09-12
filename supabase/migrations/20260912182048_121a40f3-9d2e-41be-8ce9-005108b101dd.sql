DROP POLICY IF EXISTS "roles select" ON public.user_roles;
CREATE POLICY "user_roles select self or admin" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "vault read auth" ON storage.objects;

CREATE POLICY "vault read templates" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'vault' AND (storage.foldername(name))[1] = 'templates');

CREATE POLICY "vault read team files" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'vault'
    AND (storage.foldername(name))[1] = 'teams'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.is_team_member(((storage.foldername(name))[2])::uuid, auth.uid())
    )
  );

CREATE POLICY "vault read avatars" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'vault' AND (storage.foldername(name))[1] = 'avatars');

CREATE POLICY "vault read archive admin" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'vault' AND (storage.foldername(name))[1] = 'archive' AND public.has_role(auth.uid(), 'admin'));