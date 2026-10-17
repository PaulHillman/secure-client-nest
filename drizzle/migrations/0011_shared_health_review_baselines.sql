CREATE TABLE public.health_review_shares (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 team_id uuid NOT NULL REFERENCES public.teams(id),
 shared_at timestamptz NOT NULL DEFAULT now(),
 generated_at timestamptz NOT NULL,
 shared_by uuid,
 payload jsonb NOT NULL,
 recipient_ids uuid[] NOT NULL DEFAULT '{}',
 vault_file_id uuid,
 vault_version_id uuid,
 source text NOT NULL DEFAULT 'verified_send'
);
GRANT SELECT ON public.health_review_shares TO authenticated;
GRANT ALL ON public.health_review_shares TO service_role;
ALTER TABLE public.health_review_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read shared health baselines" ON public.health_review_shares FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX health_review_shares_team_date ON public.health_review_shares(team_id, shared_at DESC);
INSERT INTO public.health_review_shares (team_id, shared_at, generated_at, payload, source)
SELECT (t.value->>'teamId')::uuid, e.created_at, (r.payload->>'generatedAt')::timestamptz,
 jsonb_build_object('team', t.value, 'exceptions', COALESCE((SELECT jsonb_agg(x.value) FROM jsonb_array_elements(r.payload->'exceptions') x WHERE x.value->>'teamId' = t.value->>'teamId'), '[]'::jsonb)),
 'legacy_email_matched'
FROM public.health_review_reports r
CROSS JOIN LATERAL jsonb_array_elements(r.payload->'teamResults') t
JOIN LATERAL (SELECT created_at FROM public.email_log WHERE template = 'health-review' AND status = 'sent' AND lower(recipient) = 'hillmanp@gvsu.edu' AND subject = 'Team Health Review: ' || (t.value->>'teamLabel') AND created_at >= r.created_at AND created_at < r.created_at + interval '2 minutes' ORDER BY created_at LIMIT 1) e ON true;