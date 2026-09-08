CREATE TABLE public.student_availability (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  busy_slots TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_availability TO authenticated;
GRANT ALL ON public.student_availability TO service_role;

ALTER TABLE public.student_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own availability manage"
  ON public.student_availability FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Teammates and admins can view availability"
  ON public.student_availability FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.shares_team(auth.uid(), user_id)
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE TRIGGER student_availability_set_updated_at
  BEFORE UPDATE ON public.student_availability
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();