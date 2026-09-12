UPDATE public.proof_materials
SET answer_key = $answer_key$Primary purpose: getting everyone ready for the onsite client interview.

Score one point for each expected agenda topic clearly identified, for a maximum of five points:

1. Review the previous two meetings' minutes to recover decisions and unfinished commitments relevant to interview preparation.

2. Finalize interview questions: collect missing submissions, review them together, and select questions to ask.

3. Assign and complete the research brief: confirm the responsible person and when it will be ready to inform the interview.

4. Confirm interview logistics and team responsibilities: attendance, arrival arrangements, who asks questions, who takes notes, and coverage for absent members.

5. Confirm follow-up commitments: each remaining preparation task has an owner and deadline before the interview.

Grade for identifying these topics, not for writing a fully detailed agenda, reproducing every supporting phrase, or exact wording. Accept equivalent wording and combined or reordered topics where coverage is clear. Do not create a separate sixth point. Do not add an independent attendance-discipline item. Do not require or penalize missing time allocations. Center feedback on interview readiness.$answer_key$,
    updated_at = now()
WHERE proof_key = 'pm_agenda';

DROP POLICY IF EXISTS "Anyone signed in can read proof materials" ON public.proof_materials;
CREATE POLICY "Students read non-agenda proof materials"
  ON public.proof_materials
  FOR SELECT
  TO authenticated
  USING (proof_key <> 'pm_agenda');