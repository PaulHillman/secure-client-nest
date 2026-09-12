ALTER TABLE public.group_norms
  ADD COLUMN IF NOT EXISTS vague_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS flagged_for_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS flagged_at timestamptz;