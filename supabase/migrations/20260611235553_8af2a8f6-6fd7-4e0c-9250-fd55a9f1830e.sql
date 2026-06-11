
-- Add initials to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS initials TEXT;

-- Helper: is user the PM of a team?
CREATE OR REPLACE FUNCTION public.is_team_pm(_team_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = _team_id AND user_id = _user_id AND job_title = 'PM'
  );
$$;

-- Proposals (one active per team)
CREATE TABLE public.team_meeting_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL UNIQUE REFERENCES public.teams(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  meeting_time TIME NOT NULL,
  proposed_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_meeting_proposals TO authenticated;
GRANT ALL ON public.team_meeting_proposals TO service_role;

ALTER TABLE public.team_meeting_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view proposals"
  ON public.team_meeting_proposals FOR SELECT TO authenticated
  USING (public.is_team_member(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only PM can insert proposal"
  ON public.team_meeting_proposals FOR INSERT TO authenticated
  WITH CHECK (public.is_team_pm(team_id, auth.uid()) AND proposed_by = auth.uid());

CREATE POLICY "Only PM can update proposal"
  ON public.team_meeting_proposals FOR UPDATE TO authenticated
  USING (public.is_team_pm(team_id, auth.uid()))
  WITH CHECK (public.is_team_pm(team_id, auth.uid()));

CREATE POLICY "Only PM can delete proposal"
  ON public.team_meeting_proposals FOR DELETE TO authenticated
  USING (public.is_team_pm(team_id, auth.uid()));

CREATE TRIGGER set_proposal_updated_at
  BEFORE UPDATE ON public.team_meeting_proposals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Agreements
CREATE TABLE public.team_meeting_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.team_meeting_proposals(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  initials TEXT NOT NULL CHECK (char_length(initials) BETWEEN 2 AND 4),
  status TEXT NOT NULL CHECK (status IN ('agreed','declined')),
  responded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proposal_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_meeting_agreements TO authenticated;
GRANT ALL ON public.team_meeting_agreements TO service_role;

ALTER TABLE public.team_meeting_agreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members view agreements"
  ON public.team_meeting_agreements FOR SELECT TO authenticated
  USING (public.is_team_member(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members manage own agreement insert"
  ON public.team_meeting_agreements FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_team_member(team_id, auth.uid()));

CREATE POLICY "Members manage own agreement update"
  ON public.team_meeting_agreements FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Members delete own agreement"
  ON public.team_meeting_agreements FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- When a proposal is updated (new day/time), clear prior agreements so consensus resets
CREATE OR REPLACE FUNCTION public.reset_agreements_on_proposal_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.day_of_week IS DISTINCT FROM OLD.day_of_week
     OR NEW.meeting_time IS DISTINCT FROM OLD.meeting_time THEN
    DELETE FROM public.team_meeting_agreements WHERE proposal_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER reset_agreements_after_proposal_update
  AFTER UPDATE ON public.team_meeting_proposals
  FOR EACH ROW EXECUTE FUNCTION public.reset_agreements_on_proposal_change();
