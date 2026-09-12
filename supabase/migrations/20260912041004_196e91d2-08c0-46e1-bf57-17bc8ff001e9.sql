ALTER TABLE public.proof_submissions
  ADD COLUMN review_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN review_note text,
  ADD COLUMN reviewed_at timestamptz,
  ADD COLUMN reviewed_by uuid,
  ADD COLUMN resubmit_count integer NOT NULL DEFAULT 0;

GRANT UPDATE ON public.proof_submissions TO authenticated;

CREATE POLICY "Students revise a submission that was sent back"
  ON public.proof_submissions FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND review_status = 'sent_back')
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins review submissions"
  ON public.proof_submissions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));