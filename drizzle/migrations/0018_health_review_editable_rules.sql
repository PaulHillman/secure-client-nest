CREATE TABLE public.health_review_rules (
  id text primary key,
  meeting_yellow_days integer not null default 7,
  meeting_red_days integer not null default 13,
  meetings_start_week integer not null default 3,
  activity_window_days integer not null default 7,
  low_engagement_weeks integer not null default 3,
  low_engagement_start date not null default '2026-10-17',
  research_required_early integer not null default 2,
  research_required_late integer not null default 4,
  research_due date not null default '2026-10-18',
  comms_grace_weeks integer not null default 3,
  comms_expected_files integer not null default 2,
  interview_questions_percent integer not null default 47,
  video_percent integer not null default 60,
  video_final_percent integer not null default 90,
  minutes_template_from date not null default '2026-09-27',
  minutes_min_markers integer not null default 6,
  escalate_red_after integer not null default 2,
  escalate_grade_after integer not null default 3,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

GRANT SELECT, UPDATE ON public.health_review_rules TO authenticated;
GRANT ALL ON public.health_review_rules TO service_role;

ALTER TABLE public.health_review_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read health review rules"
  ON public.health_review_rules FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update health review rules"
  ON public.health_review_rules FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER health_review_rules_set_updated_at
  BEFORE UPDATE ON public.health_review_rules
  FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();

INSERT INTO public.health_review_rules (id) VALUES ('global') ON CONFLICT (id) DO NOTHING;