CREATE OR REPLACE FUNCTION public.admin_student_login_report()
RETURNS TABLE(user_id uuid, student_name text, email text, section text, teams text, roles text[], last_login_at timestamptz, recent_logins timestamptz[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth
AS $$
BEGIN
 IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501'; END IF;
 RETURN QUERY
 WITH login_events AS (
  SELECT s.user_id AS uid, s.created_at AS logged_at FROM auth.sessions s
  UNION SELECT a.user_id, a.created_at FROM public.auth_audit_log a WHERE a.event = 'signin'
  UNION SELECT u.id, u.last_sign_in_at FROM auth.users u WHERE u.last_sign_in_at IS NOT NULL
 ), login_summary AS (
  SELECT e.uid, max(e.logged_at) AS latest,
   array_agg(DISTINCT e.logged_at ORDER BY e.logged_at DESC) FILTER (WHERE e.logged_at >= now() - interval '21 days') AS recent
  FROM login_events e GROUP BY e.uid
 )
 SELECT p.id, p.name, p.email, p.section,
  coalesce((SELECT string_agg(coalesce(t.display_name,t.name) || ' (Section ' || coalesce(t.section,'—') || ')', ', ' ORDER BY coalesce(t.display_name,t.name)) FROM public.team_members m JOIN public.teams t ON t.id=m.team_id WHERE m.user_id=p.id AND NOT t.is_test),'No team'),
  coalesce((SELECT array_agg(DISTINCT m.job_title::text ORDER BY m.job_title::text) FROM public.team_members m JOIN public.teams t ON t.id=m.team_id WHERE m.user_id=p.id AND NOT t.is_test), ARRAY['Unassigned']::text[]),
  l.latest, coalesce(l.recent, ARRAY[]::timestamptz[])
 FROM public.profiles p LEFT JOIN login_summary l ON l.uid=p.id
 WHERE EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=p.id AND r.role='student')
 AND NOT EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=p.id AND r.role='admin')
 AND lower(trim(p.name)) <> 'parfunkel hillman'
 AND NOT EXISTS(SELECT 1 FROM public.team_members m JOIN public.teams t ON t.id=m.team_id WHERE m.user_id=p.id AND t.is_test)
 ORDER BY l.latest DESC NULLS LAST, p.name;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_student_login_report() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_student_login_report() TO authenticated;
COMMENT ON FUNCTION public.admin_student_login_report() IS 'Admin-only actual sign-in summary using session creation, sign-in audit events and latest auth sign-in; never session refresh or page activity.';