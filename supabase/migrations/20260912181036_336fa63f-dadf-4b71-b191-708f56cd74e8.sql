ALTER TABLE public.group_norms
  ALTER COLUMN document_path DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS content jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by uuid;

ALTER TABLE public.group_norms_signatures
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

ALTER TABLE public.group_norms_signatures
  DROP CONSTRAINT IF EXISTS group_norms_signatures_group_norms_id_user_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS group_norms_signatures_unique_member_version
  ON public.group_norms_signatures (group_norms_id, user_id, version);

CREATE TABLE IF NOT EXISTS public.group_norms_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_norms_id uuid NOT NULL REFERENCES public.group_norms(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  version integer NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  saved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_norms_id, version)
);

GRANT SELECT ON public.group_norms_versions TO authenticated;
GRANT ALL ON public.group_norms_versions TO service_role;
ALTER TABLE public.group_norms_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group_norms_versions select own team" ON public.group_norms_versions
  FOR SELECT TO authenticated
  USING (public.is_team_member(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- Tighten norms + signature visibility to the member's own team
DROP POLICY IF EXISTS "group_norms select" ON public.group_norms;
CREATE POLICY "group_norms select own team" ON public.group_norms
  FOR SELECT TO authenticated
  USING (public.is_team_member(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "signatures select" ON public.group_norms_signatures;
CREATE POLICY "signatures select own team" ON public.group_norms_signatures
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_norms gn
      WHERE gn.id = group_norms_id
        AND (public.is_team_member(gn.team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))
    )
  );

-- Approvals may only be made for yourself, on the current version, while on the team
DROP POLICY IF EXISTS "signatures insert self" ON public.group_norms_signatures;
CREATE POLICY "signatures insert self current version" ON public.group_norms_signatures
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.group_norms gn
      WHERE gn.id = group_norms_id
        AND gn.version = group_norms_signatures.version
        AND public.is_team_member(gn.team_id, auth.uid())
    )
  );

ALTER TABLE public.archived_group_norms
  ALTER COLUMN document_path DROP NOT NULL,
  ALTER COLUMN archive_document_path DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS content jsonb,
  ADD COLUMN IF NOT EXISTS version integer;

ALTER TABLE public.archived_group_norms_signatures
  ADD COLUMN IF NOT EXISTS version integer;