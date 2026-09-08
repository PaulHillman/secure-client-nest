ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS skills_have text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS skills_learn text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS top_skills text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS work_style text;