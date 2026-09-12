DROP POLICY IF EXISTS "file_tags select" ON public.file_tags;
CREATE POLICY "file_tags select follows file" ON public.file_tags
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.files f
    WHERE f.id = file_tags.file_id
      AND (
        ((f.team_id IS NULL) AND f.is_template AND public.has_role(auth.uid(), 'admin'::app_role))
        OR ((f.team_id IS NOT NULL) AND (public.is_team_member(f.team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role)))
      )
  )
);