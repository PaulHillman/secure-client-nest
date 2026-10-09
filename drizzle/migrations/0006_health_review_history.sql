CREATE TABLE public.health_review_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL,
  scope_label text NOT NULL,
  run_by uuid,
  teams_checked integer NOT NULL DEFAULT 0,
  good_count integer NOT NULL DEFAULT 0,
  bad_count integer NOT NULL DEFAULT 0,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.health_review_reports TO authenticated;
GRANT ALL ON public.health_review_reports TO service_role;
ALTER TABLE public.health_review_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read health reports" ON public.health_review_reports FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.health_review_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.health_review_reports(id) ON DELETE CASCADE,
  team_id uuid NOT NULL,
  team_label text NOT NULL,
  section text,
  good integer NOT NULL DEFAULT 0,
  bad integer NOT NULL DEFAULT 0,
  red integer NOT NULL DEFAULT 0,
  yellow integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.health_review_scores (team_id, created_at DESC);
GRANT SELECT ON public.health_review_scores TO authenticated;
GRANT ALL ON public.health_review_scores TO service_role;
ALTER TABLE public.health_review_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read health scores" ON public.health_review_scores FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));