CREATE OR REPLACE FUNCTION public.auth_activity_since(_since timestamptz)
RETURNS TABLE(user_id uuid, active_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth
AS $$
  SELECT s.user_id, x.t
  FROM auth.sessions s
  CROSS JOIN LATERAL (VALUES (s.created_at), (s.updated_at), (s.refreshed_at::timestamptz)) AS x(t)
  WHERE public.has_role(auth.uid(), 'admin') AND x.t IS NOT NULL AND x.t >= _since
  UNION
  SELECT u.id, u.last_sign_in_at FROM auth.users u
  WHERE public.has_role(auth.uid(), 'admin') AND u.last_sign_in_at >= _since;
$$;
REVOKE ALL ON FUNCTION public.auth_activity_since(timestamptz) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.auth_activity_since(timestamptz) TO authenticated;