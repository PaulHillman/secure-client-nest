ALTER TABLE public.team_meeting_proposals
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS meeting_mode text,
  ADD COLUMN IF NOT EXISTS mode_choice_1 text,
  ADD COLUMN IF NOT EXISTS mode_choice_2 text,
  ADD COLUMN IF NOT EXISTS mode_choice_3 text;

ALTER TABLE public.team_meeting_agreements
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS agreement_version text,
  ADD COLUMN IF NOT EXISTS agreement_text text;

CREATE OR REPLACE FUNCTION public.reset_agreements_on_proposal_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.day_of_week IS DISTINCT FROM OLD.day_of_week
     OR NEW.meeting_time IS DISTINCT FROM OLD.meeting_time
     OR NEW.location IS DISTINCT FROM OLD.location
     OR NEW.meeting_mode IS DISTINCT FROM OLD.meeting_mode THEN
    DELETE FROM public.team_meeting_agreements WHERE proposal_id = OLD.id;
  END IF;
  RETURN NEW;
END;
$$;