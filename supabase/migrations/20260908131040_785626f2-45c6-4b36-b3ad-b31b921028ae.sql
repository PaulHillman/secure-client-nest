ALTER TABLE public.semester_schedule
  ADD COLUMN IF NOT EXISTS profile_reminders_start date,
  ADD COLUMN IF NOT EXISTS profile_reminders_end date;

UPDATE public.semester_schedule SET profile_reminders_start = '2026-09-10' WHERE id = true AND profile_reminders_start IS NULL;

INSERT INTO public.semester_schedule (id, profile_reminders_start)
SELECT true, '2026-09-10'
WHERE NOT EXISTS (SELECT 1 FROM public.semester_schedule WHERE id = true);