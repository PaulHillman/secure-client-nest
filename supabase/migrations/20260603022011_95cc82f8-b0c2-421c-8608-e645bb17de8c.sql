-- Add is_template flag and tighten template writes to admins
ALTER TABLE public.files ADD COLUMN IF NOT EXISTS is_template boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_files_team_template ON public.files(team_id, is_template);

-- Replace generic write policy with one that protects templates
DROP POLICY IF EXISTS "files write" ON public.files;

CREATE POLICY "files insert"
ON public.files FOR INSERT TO authenticated
WITH CHECK (
  (is_team_member(team_id, auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  AND (is_template = false OR has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "files update"
ON public.files FOR UPDATE TO authenticated
USING (
  CASE WHEN is_template THEN has_role(auth.uid(), 'admin'::app_role)
       ELSE (is_team_member(team_id, auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  END
)
WITH CHECK (
  CASE WHEN is_template THEN has_role(auth.uid(), 'admin'::app_role)
       ELSE (is_team_member(team_id, auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  END
);

CREATE POLICY "files delete"
ON public.files FOR DELETE TO authenticated
USING (
  CASE WHEN is_template THEN has_role(auth.uid(), 'admin'::app_role)
       ELSE (is_team_member(team_id, auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  END
);