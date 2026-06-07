
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  file_id UUID REFERENCES public.files(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.file_comments(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'comment',
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread
  ON public.notifications(user_id, read, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users update their own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users delete their own notifications"
  ON public.notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Inserts come from the trigger (security definer) and admin paths
CREATE POLICY "Admins can insert notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid());

-- Trigger function: fan out notifications on each new file comment
CREATE OR REPLACE FUNCTION public.fanout_file_comment_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient UUID;
  author_name TEXT;
  file_name TEXT;
  msg TEXT;
BEGIN
  SELECT COALESCE(p.name, p.email, 'Someone') INTO author_name
    FROM public.profiles p WHERE p.id = NEW.author_id;
  SELECT f.file_name INTO file_name FROM public.files f WHERE f.id = NEW.file_id;

  msg := COALESCE(author_name, 'Someone') || ' commented on "' ||
         COALESCE(file_name, 'a file') || '"' ||
         CASE WHEN NEW.related_status IS NOT NULL
              THEN ' (' || NEW.related_status::text || ')'
              ELSE '' END;

  IF NEW.to_entire_team THEN
    FOR recipient IN
      SELECT user_id FROM public.team_members WHERE team_id = NEW.team_id
    LOOP
      IF recipient <> NEW.author_id THEN
        INSERT INTO public.notifications
          (user_id, team_id, file_id, comment_id, actor_id, kind, message)
        VALUES
          (recipient, NEW.team_id, NEW.file_id, NEW.id, NEW.author_id, 'comment', msg);
      END IF;
    END LOOP;
  ELSIF array_length(NEW.recipient_ids, 1) IS NOT NULL THEN
    FOREACH recipient IN ARRAY NEW.recipient_ids
    LOOP
      IF recipient <> NEW.author_id THEN
        INSERT INTO public.notifications
          (user_id, team_id, file_id, comment_id, actor_id, kind, message)
        VALUES
          (recipient, NEW.team_id, NEW.file_id, NEW.id, NEW.author_id, 'comment', msg);
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_fanout_file_comment_notifications
AFTER INSERT ON public.file_comments
FOR EACH ROW EXECUTE FUNCTION public.fanout_file_comment_notifications();

-- Enable realtime
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
