ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS skills_have text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS skills_learn text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS top_skills text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS work_style text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_skills_have_limit,
  DROP CONSTRAINT IF EXISTS profiles_skills_learn_limit,
  DROP CONSTRAINT IF EXISTS profiles_top_skills_limit,
  DROP CONSTRAINT IF EXISTS profiles_top_skills_subset,
  DROP CONSTRAINT IF EXISTS profiles_work_style_length;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_skills_have_limit CHECK (cardinality(skills_have) <= 8),
  ADD CONSTRAINT profiles_skills_learn_limit CHECK (cardinality(skills_learn) <= 5),
  ADD CONSTRAINT profiles_top_skills_limit CHECK (cardinality(top_skills) <= 3),
  ADD CONSTRAINT profiles_top_skills_subset CHECK (top_skills <@ skills_have),
  ADD CONSTRAINT profiles_work_style_length CHECK (char_length(work_style) <= 400);

COMMENT ON COLUMN public.profiles.skills_have IS 'Up to 8 skills the student can contribute to their team.';
COMMENT ON COLUMN public.profiles.skills_learn IS 'Up to 5 skills the student wants to develop.';
COMMENT ON COLUMN public.profiles.top_skills IS 'Up to 3 highlighted strengths; must be included in skills_have.';
COMMENT ON COLUMN public.profiles.work_style IS 'Student-authored summary of how they work best, up to 400 characters.';
