export function peerCloseoutComment(assessment: { accepted_note?: string | null; discussion_note?: string | null }) {
  return assessment.accepted_note?.trim() || assessment.discussion_note?.trim() || null;
}

export function peerCloseoutBody(input: { firstName: string; score: number | null; meetingLine: string; comment: string | null }) {
  return [
    `Hi ${input.firstName},`,
    `Your mid-semester peer review has been accepted${input.score != null ? ` (${input.score}/10)` : ''}. You are done with this assignment — no further revisions are needed.`,
    input.comment,
    input.meetingLine,
    'Thank you for the work you put into your revisions.',
    'Prof. Hillman',
  ].filter(Boolean).join('\n\n');
}