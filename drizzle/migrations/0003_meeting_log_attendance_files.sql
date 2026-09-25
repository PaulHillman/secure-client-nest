ALTER TABLE public.meeting_logs ADD COLUMN IF NOT EXISTS attendance jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.files ADD COLUMN IF NOT EXISTS meeting_log_id uuid REFERENCES public.meeting_logs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS files_meeting_log_id_idx ON public.files(meeting_log_id);