
CREATE TABLE public.file_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  recipient_ids UUID[] NOT NULL DEFAULT '{}',
  to_entire_team BOOLEAN NOT NULL DEFAULT false,
  related_status public.vault_status,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_file_comments_file ON public.file_comments(file_id, created_at);
CREATE INDEX idx_file_comments_team ON public.file_comments(team_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.file_comments TO authenticated;
GRANT ALL ON public.file_comments TO service_role;

ALTER TABLE public.file_comments ENABLE ROW LEVEL SECURITY;

-- Read: team members of the file's team, admins, or recipients
CREATE POLICY "Team members and admins can read comments"
  ON public.file_comments FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.is_team_member(team_id, auth.uid())
  );

-- Insert: any authenticated user who is admin or a member of the team
CREATE POLICY "Team members and admins can add comments"
  ON public.file_comments FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.is_team_member(team_id, auth.uid())
    )
  );

-- Update/Delete: author or admin
CREATE POLICY "Authors and admins can update comments"
  ON public.file_comments FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authors and admins can delete comments"
  ON public.file_comments FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
