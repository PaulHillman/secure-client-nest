
ALTER TYPE public.backlog_status ADD VALUE IF NOT EXISTS 'shelved';

DROP POLICY IF EXISTS "Authenticated can view backlog" ON public.backlog_items;
DROP POLICY IF EXISTS "Authenticated users can update backlog status" ON public.backlog_items;

CREATE POLICY "Admins can view backlog" ON public.backlog_items
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
