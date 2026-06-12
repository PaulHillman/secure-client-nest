
ALTER TABLE public.backlog_items
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

UPDATE public.backlog_items
  SET completed_at = updated_at
  WHERE status = 'done' AND completed_at IS NULL;

CREATE OR REPLACE FUNCTION public.set_backlog_completed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'done' AND (OLD.status IS DISTINCT FROM 'done' OR NEW.completed_at IS NULL) THEN
    NEW.completed_at = COALESCE(NEW.completed_at, now());
  ELSIF NEW.status <> 'done' THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_backlog_completed_at ON public.backlog_items;
CREATE TRIGGER trg_backlog_completed_at
  BEFORE INSERT OR UPDATE ON public.backlog_items
  FOR EACH ROW EXECUTE FUNCTION public.set_backlog_completed_at();
