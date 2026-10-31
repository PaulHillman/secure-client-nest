CREATE OR REPLACE FUNCTION public.student_health_report_history(_student_id uuid DEFAULT NULL)
RETURNS TABLE(id uuid, team_id uuid, team_label text, generated_at timestamptz, shared_at timestamptz, good integer, fair integer, bad integer, vault_file_id uuid, vault_version_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
 SELECT s.id, s.team_id, s.payload->'team'->>'teamLabel', s.generated_at, s.shared_at,
 (SELECT count(*)::integer FROM jsonb_each_text(COALESCE(s.payload->'team'->'results', '{}'::jsonb)) r WHERE r.value = 'pass'),
 (SELECT count(*)::integer FROM jsonb_array_elements(COALESCE(s.payload->'exceptions', '[]'::jsonb)) e WHERE e->>'level' = 'yellow'),
 (SELECT count(*)::integer FROM jsonb_array_elements(COALESCE(s.payload->'exceptions', '[]'::jsonb)) e WHERE e->>'level' = 'red'),
 f.id, v.id
 FROM public.health_review_shares s
 JOIN public.teams t ON t.id = s.team_id
 LEFT JOIN public.files f ON f.id = s.vault_file_id AND f.team_id = s.team_id AND f.subsection = 'Health Reports'
 LEFT JOIN public.file_versions v ON v.id = s.vault_version_id AND v.file_id = f.id
 WHERE auth.uid() IS NOT NULL AND NOT t.is_test
 AND (_student_id IS NULL OR _student_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
 AND EXISTS (SELECT 1 FROM public.team_members m WHERE m.team_id = s.team_id AND m.user_id = COALESCE(_student_id, auth.uid()))
 ORDER BY s.generated_at DESC, s.shared_at DESC, s.id DESC;
$$;
REVOKE ALL ON FUNCTION public.student_health_report_history(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.student_health_report_history(uuid) TO authenticated;
COMMENT ON FUNCTION public.student_health_report_history(uuid) IS 'Student-safe received-report summaries only; team membership is required, admin view-as is authorized, private snapshot payloads remain instructor-only.';