
CREATE TABLE public.manager_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  submitted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manager_first_name text NOT NULL,
  manager_last_name text NOT NULL,
  company_name text NOT NULL,
  company_website text NOT NULL,
  industry text NOT NULL,
  num_employees integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.manager_submissions TO authenticated;
GRANT ALL ON public.manager_submissions TO service_role;

ALTER TABLE public.manager_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view their team submissions"
ON public.manager_submissions FOR SELECT TO authenticated
USING (public.is_team_member(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Team members can insert submissions for their team"
ON public.manager_submissions FOR INSERT TO authenticated
WITH CHECK (public.is_team_member(team_id, auth.uid()) AND submitted_by = auth.uid());

CREATE POLICY "Submitter or admin can update"
ON public.manager_submissions FOR UPDATE TO authenticated
USING (submitted_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (submitted_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can delete"
ON public.manager_submissions FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER manager_submissions_set_updated_at
BEFORE UPDATE ON public.manager_submissions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
