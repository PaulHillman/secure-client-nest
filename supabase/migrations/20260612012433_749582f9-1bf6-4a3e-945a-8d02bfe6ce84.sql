
ALTER TABLE public.semester_archives
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS tag_date date;

ALTER TABLE public.semester_archives DROP CONSTRAINT IF EXISTS semester_archives_kind_check;
ALTER TABLE public.semester_archives
  ADD CONSTRAINT semester_archives_kind_check CHECK (kind IN ('manual','daily','weekly'));

CREATE INDEX IF NOT EXISTS semester_archives_kind_tag_date_idx
  ON public.semester_archives (kind, tag_date);

CREATE TABLE IF NOT EXISTS public.semester_schedule (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  start_date date,
  end_date date,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.semester_schedule TO authenticated;
GRANT ALL ON public.semester_schedule TO service_role;

ALTER TABLE public.semester_schedule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins manage schedule" ON public.semester_schedule;
CREATE POLICY "admins manage schedule" ON public.semester_schedule
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.semester_schedule (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
