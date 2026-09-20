ALTER TABLE public.files ADD COLUMN IF NOT EXISTS meeting_date DATE;

-- Backfill existing agenda rows from dates embedded in their file names
-- (e.g. "Oak & Iron Agenda 9_16", "Managment Agenda for meeting 9-16-26.pdf").
WITH matches AS (
  SELECT id,
         regexp_match(file_name, '(?:^|[^0-9])([0-9]{1,2})[-_ ]([0-9]{1,2})(?:[-_ ]([0-9]{2,4}))?(?:[^0-9]|$)') AS m
  FROM public.files
  WHERE subsection = 'Agendas' AND meeting_date IS NULL
)
UPDATE public.files f
SET meeting_date = make_date(2026, mt.m[1]::int, mt.m[2]::int)
FROM matches mt
WHERE f.id = mt.id
  AND mt.m[1]::int BETWEEN 1 AND 12
  AND mt.m[2]::int BETWEEN 1 AND 31
  AND (mt.m[3] IS NULL OR mt.m[3]::int IN (26, 2026));