ALTER TABLE public.team_members ALTER COLUMN job_title SET DEFAULT 'Unassigned';
UPDATE public.team_members SET job_title = 'Unassigned' WHERE job_title = 'Researcher';