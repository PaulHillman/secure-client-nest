CREATE OR REPLACE FUNCTION public.copy_pm_on_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pm UUID;
BEGIN
  IF NEW.team_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Do not fan out copies of a message already addressed to a PM of this team
  IF EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = NEW.team_id AND user_id = NEW.user_id AND job_title = 'PM'
  ) THEN
    RETURN NULL;
  END IF;

  FOR pm IN
    SELECT user_id FROM public.team_members
    WHERE team_id = NEW.team_id AND job_title = 'PM'
  LOOP
    IF pm <> NEW.user_id AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = pm
        AND n.team_id = NEW.team_id
        AND n.kind = NEW.kind
        AND n.created_at > now() - interval '10 minutes'
        AND (n.message = NEW.message OR n.message = 'PM copy: ' || NEW.message)
    ) THEN
      INSERT INTO public.notifications
        (user_id, team_id, file_id, comment_id, actor_id, kind, message)
      VALUES
        (pm, NEW.team_id, NEW.file_id, NEW.comment_id, NEW.actor_id, NEW.kind,
         'PM copy: ' || NEW.message);
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_copy_pm_on_notifications ON public.notifications;
CREATE TRIGGER trg_copy_pm_on_notifications
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.copy_pm_on_notifications();