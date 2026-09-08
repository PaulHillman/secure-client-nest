CREATE TABLE public.profile_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'profile_incomplete',
  last_sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  missing TEXT[] NOT NULL DEFAULT '{}',
  send_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind)
);

GRANT SELECT ON public.profile_reminders TO authenticated;
GRANT ALL ON public.profile_reminders TO service_role;

ALTER TABLE public.profile_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see their own reminder history"
ON public.profile_reminders FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER profile_reminders_set_updated_at
BEFORE UPDATE ON public.profile_reminders
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();