
-- Make team_id nullable so admin templates can live without a team
ALTER TABLE public.files ALTER COLUMN team_id DROP NOT NULL;

-- Add lock + source-template link
ALTER TABLE public.files
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS template_source_id uuid REFERENCES public.files(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_files_template_source ON public.files(template_source_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_files_team_template_source
  ON public.files(team_id, template_source_id)
  WHERE template_source_id IS NOT NULL;

-- Replace files RLS policies
DROP POLICY IF EXISTS "files select" ON public.files;
DROP POLICY IF EXISTS "files insert" ON public.files;
DROP POLICY IF EXISTS "files update" ON public.files;
DROP POLICY IF EXISTS "files delete" ON public.files;

CREATE POLICY "files select" ON public.files
FOR SELECT
USING (
  -- admin templates (no team): admin only
  (team_id IS NULL AND is_template AND public.has_role(auth.uid(), 'admin'::app_role))
  OR
  -- team files visible to team or admin
  (team_id IS NOT NULL AND (public.is_team_member(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role)))
);

CREATE POLICY "files insert" ON public.files
FOR INSERT TO authenticated
WITH CHECK (
  CASE
    WHEN is_template AND team_id IS NULL THEN public.has_role(auth.uid(), 'admin'::app_role)
    WHEN team_id IS NOT NULL THEN
      (public.is_team_member(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))
      AND (is_locked = false OR public.has_role(auth.uid(), 'admin'::app_role))
    ELSE false
  END
);

CREATE POLICY "files update" ON public.files
FOR UPDATE TO authenticated
USING (
  CASE
    WHEN team_id IS NULL THEN public.has_role(auth.uid(), 'admin'::app_role)
    WHEN is_locked THEN public.has_role(auth.uid(), 'admin'::app_role)
    ELSE (public.is_team_member(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))
  END
)
WITH CHECK (
  CASE
    WHEN team_id IS NULL THEN public.has_role(auth.uid(), 'admin'::app_role)
    WHEN is_locked THEN public.has_role(auth.uid(), 'admin'::app_role)
    ELSE (public.is_team_member(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))
  END
);

CREATE POLICY "files delete" ON public.files
FOR DELETE TO authenticated
USING (
  CASE
    WHEN team_id IS NULL THEN public.has_role(auth.uid(), 'admin'::app_role)
    WHEN is_locked THEN public.has_role(auth.uid(), 'admin'::app_role)
    ELSE (public.is_team_member(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))
  END
);

-- Update file_versions write policy to respect lock
DROP POLICY IF EXISTS "file_versions write" ON public.file_versions;
CREATE POLICY "file_versions write" ON public.file_versions
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.files f
    WHERE f.id = file_versions.file_id
      AND (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR (f.team_id IS NOT NULL AND public.is_team_member(f.team_id, auth.uid()) AND f.is_locked = false)
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.files f
    WHERE f.id = file_versions.file_id
      AND (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR (f.team_id IS NOT NULL AND public.is_team_member(f.team_id, auth.uid()) AND f.is_locked = false)
      )
  )
);

-- Update file_versions SELECT to include admin templates (no team)
DROP POLICY IF EXISTS "file_versions select" ON public.file_versions;
CREATE POLICY "file_versions select" ON public.file_versions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.files f
    WHERE f.id = file_versions.file_id
      AND (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR (f.team_id IS NULL AND f.is_template AND public.has_role(auth.uid(), 'admin'::app_role))
        OR (f.team_id IS NOT NULL AND public.is_team_member(f.team_id, auth.uid()))
      )
  )
);
