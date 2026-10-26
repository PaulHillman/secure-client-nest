create table if not exists public.peer_review_meetings (
  id uuid primary key default gen_random_uuid(),
  calendly_event_uri text not null unique,
  student_id uuid not null references public.profiles(id),
  team_id uuid references public.teams(id),
  scheduled_at timestamptz not null,
  zoom_url text,
  score integer,
  attempt integer,
  created_at timestamptz not null default now()
);

GRANT SELECT ON public.peer_review_meetings TO authenticated;
GRANT ALL ON public.peer_review_meetings TO service_role;

ALTER TABLE public.peer_review_meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view peer-review meetings"
  ON public.peer_review_meetings
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));