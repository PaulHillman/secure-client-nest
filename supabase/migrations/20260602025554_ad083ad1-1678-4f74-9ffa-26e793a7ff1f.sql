INSERT INTO storage.buckets (id, name, public) VALUES ('avatars','avatars',true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "avatars public read" ON storage.objects FOR SELECT USING (bucket_id='avatars');
CREATE POLICY "avatars admin write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='avatars' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "avatars admin update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='avatars' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "avatars admin delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id='avatars' AND public.has_role(auth.uid(),'admin'));