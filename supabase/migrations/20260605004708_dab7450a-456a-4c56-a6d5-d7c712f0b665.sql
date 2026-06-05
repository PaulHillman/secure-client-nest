
-- Helper: do two users share any team?
CREATE OR REPLACE FUNCTION public.shares_team(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members tm1
    JOIN public.team_members tm2 ON tm1.team_id = tm2.team_id
    WHERE tm1.user_id = _a AND tm2.user_id = _b
  );
$$;

-- TEAMS
DROP POLICY IF EXISTS "teams select" ON public.teams;
CREATE POLICY "teams select" ON public.teams FOR SELECT
USING (public.is_team_member(id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- TEAM MEMBERS
DROP POLICY IF EXISTS "team_members select" ON public.team_members;
CREATE POLICY "team_members select" ON public.team_members FOR SELECT
USING (public.is_team_member(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- COMPANY FOCUS
DROP POLICY IF EXISTS "company_focus select" ON public.company_focus;
CREATE POLICY "company_focus select" ON public.company_focus FOR SELECT
USING (public.is_team_member(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- FILES
DROP POLICY IF EXISTS "files select" ON public.files;
CREATE POLICY "files select" ON public.files FOR SELECT
USING (
  is_template
  OR public.is_team_member(team_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

-- FILE VERSIONS
DROP POLICY IF EXISTS "file_versions select" ON public.file_versions;
CREATE POLICY "file_versions select" ON public.file_versions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.files f
    WHERE f.id = file_versions.file_id
      AND (f.is_template
           OR public.is_team_member(f.team_id, auth.uid())
           OR public.has_role(auth.uid(), 'admin'))
  )
);

-- PROFILES: self, admin, or shares a team
DROP POLICY IF EXISTS "profiles select" ON public.profiles;
CREATE POLICY "profiles select" ON public.profiles FOR SELECT
USING (
  id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.shares_team(auth.uid(), id)
);
