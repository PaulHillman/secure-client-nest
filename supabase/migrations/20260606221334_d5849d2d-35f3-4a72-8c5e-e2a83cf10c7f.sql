
DO $$ BEGIN
  CREATE TYPE public.vault_status AS ENUM (
    'Submitted','Awaiting Review','Reviewed','Needs Revision','Resolved','Missing'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.files
  ADD COLUMN IF NOT EXISTS section TEXT,
  ADD COLUMN IF NOT EXISTS subsection TEXT,
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status public.vault_status NOT NULL DEFAULT 'Submitted';

UPDATE public.files
  SET section = COALESCE(section, 'Team Documents'),
      subsection = COALESCE(subsection, 'Other')
  WHERE section IS NULL OR subsection IS NULL;

ALTER TABLE public.files
  ALTER COLUMN section SET NOT NULL,
  ALTER COLUMN subsection SET NOT NULL,
  ALTER COLUMN section SET DEFAULT 'Team Documents',
  ALTER COLUMN subsection SET DEFAULT 'Other';

CREATE INDEX IF NOT EXISTS idx_files_team_section ON public.files(team_id, section, subsection);
