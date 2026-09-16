CREATE TABLE public.email_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template text NOT NULL,
  recipient text NOT NULL,
  subject text NOT NULL,
  body_text text,
  status text NOT NULL DEFAULT 'sent',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.email_log TO authenticated;
GRANT ALL ON public.email_log TO service_role;
ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view the email log" ON public.email_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));