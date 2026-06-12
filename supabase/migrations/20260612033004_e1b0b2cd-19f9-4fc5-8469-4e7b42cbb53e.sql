
CREATE TABLE public.auth_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event TEXT NOT NULL CHECK (event IN ('signin','signout')),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.auth_audit_log TO authenticated;
GRANT ALL ON public.auth_audit_log TO service_role;

ALTER TABLE public.auth_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own auth events"
  ON public.auth_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can read all auth events"
  ON public.auth_audit_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can read their own auth events"
  ON public.auth_audit_log
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_auth_audit_log_user_id ON public.auth_audit_log(user_id);
CREATE INDEX idx_auth_audit_log_created_at ON public.auth_audit_log(created_at DESC);
