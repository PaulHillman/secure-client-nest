ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS display_name text;

CREATE POLICY "Members can rename their team"
ON public.teams FOR UPDATE TO authenticated
USING (public.is_team_member(id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.is_team_member(id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));