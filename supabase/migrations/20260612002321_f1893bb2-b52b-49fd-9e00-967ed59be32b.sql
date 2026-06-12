
CREATE TYPE public.backlog_status AS ENUM ('todo','in_progress','done');
CREATE TYPE public.backlog_priority AS ENUM ('low','medium','high');

CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.backlog_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  notes TEXT,
  status public.backlog_status NOT NULL DEFAULT 'todo',
  priority public.backlog_priority NOT NULL DEFAULT 'medium',
  order_index INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.backlog_items TO authenticated;
GRANT ALL ON public.backlog_items TO service_role;

ALTER TABLE public.backlog_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view backlog"
  ON public.backlog_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert backlog"
  ON public.backlog_items FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins can update backlog"
  ON public.backlog_items FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins can delete backlog"
  ON public.backlog_items FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER backlog_items_set_updated_at
  BEFORE UPDATE ON public.backlog_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.backlog_items (title, notes, status, priority, order_index) VALUES
  ('Semester Reset & Archive System', 'Built — verify end-to-end before next semester rollover.', 'done', 'high', 10),
  ('Dashboard "needs attention" counts', 'Shows teams missing signed norms, meeting time, approved client contact.', 'done', 'medium', 20),
  ('Org chart detection ignores template file', 'A team has an org chart only if a non-template file exists in their vault.', 'done', 'medium', 30);
