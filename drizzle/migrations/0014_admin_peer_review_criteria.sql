CREATE TABLE public.peer_review_criteria (
  id text PRIMARY KEY DEFAULT 'peer-review' CHECK (id = 'peer-review'),
  content text NOT NULL DEFAULT '',
  reminder_month_day text NOT NULL DEFAULT '10-16' CHECK (reminder_month_day ~ '^[0-9]{2}-[0-9]{2}$'),
  reviewed_year integer,
  reviewed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE ON public.peer_review_criteria TO authenticated;
GRANT ALL ON public.peer_review_criteria TO service_role;
ALTER TABLE public.peer_review_criteria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read peer review criteria" ON public.peer_review_criteria FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins create peer review criteria" ON public.peer_review_criteria FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins edit peer review criteria" ON public.peer_review_criteria FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));