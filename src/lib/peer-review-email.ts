import { resolveOperationalRules, deadlineLabel } from './review-rulebook';
import { peerReviewPass } from './peer-review-policy';

export const PEER_REVISION_EXAMPLE_LINK = 'https://clientvault.immersivebusiness.net/peer-review-revision-example.docx';
export const PEER_MEETING_LINK = 'https://calendly.com/hillman-gvsu/15-minute-meeting-clone-1';

export function peerEmailAction(score: number, attempt: number, policy?: unknown) {
  const p = resolveOperationalRules(policy);
  return {
    target: attempt === 1 ? p.original_pass : p.revision_pass,
    complete: peerReviewPass(score, attempt, p),
    remainingSubmissions: Math.max(0, p.max_submissions - attempt),
    meetingRequired: attempt >= p.max_submissions && score < p.revision_pass,
  };
}

export type PeerEmailVerdict = { strengths: string[]; concerns: string[]; changes: string[] };

export function revisionEmailBody(name: string, attempt: number, score: number, v: PeerEmailVerdict, finalSubmission = false, policy?: unknown) {
  const p = resolveOperationalRules(policy);
  const action = peerEmailAction(score, attempt, p);
  const revision = finalSubmission || attempt > 1;
  const label = finalSubmission ? 'instructor-authorized final submission` : revision ? `${attempt === 2 ? `first' : 'second`} revision (submission ${attempt} of ${p.max_submissions})` : `original';
  let next: string;
  if (finalSubmission) next = score >= p.revision_pass ? `Your final peer review has reached the required ${p.revision_pass}/10 target. No further action is required.` : `Your final peer review has not reached the required ${p.revision_pass}/10 target. Your instructor will determine the next step. Do not upload another submission unless your instructor authorizes it.`;
  else if (action.complete) next = revision ? `Your peer review has reached the required ${p.revision_pass}/10 target. No further action is required.` : 'No further action is required.';
  else if (action.meetingRequired) next = `You have used all ${p.max_submissions === 3 ? "three" : p.max_submissions} submissions and have not yet delivered an ${p.revision_pass}/10 peer review. A meeting with me is now required. Book it by ${deadlineLabel(p.revision_due, true)} Eastern and hold it by ${deadlineLabel(p.meeting_due, true)} Eastern. Bring this latest submission. Do not upload further revisions before the meeting.\nSchedule: ${PEER_MEETING_LINK}\n\nUnless you want to spend more time on this, follow the abundant suggestions already provided and fix the specific issues above before our meeting. Use truthful observations; do not invent examples.\n\nExample of how changes should look: ${PEER_REVISION_EXAMPLE_LINK}\n\nYou MUST be prepared to show me the changes you have made and the changes you expect will get your peer review to ${p.revision_pass}/10 or higher. Do not come to our meeting unprepared; I have dozens of these meetings. Failure to demonstrate that you have prepared will likely result in the meeting being cancelled and points deducted from your final score for failing to use our time efficiently.`;
  else next = revision
    ? `You have not yet delivered an ${p.revision_pass}/10 peer review. Your next submission—submission ${attempt + 1} of ${p.max_submissions}—is your last chance to reach ${p.revision_pass}/10 before a meeting with me is required. Unless you want to spend more time on this, follow the abundant suggestions already provided and fix the specific issues above. Submit by ${deadlineLabel(p.revision_due, true)} Eastern.`
    : `Revise your peer review to reach ${p.revision_pass}/10 or higher. Submit by ${deadlineLabel(p.revision_due, true)} Eastern.\nSchedule: ${PEER_MEETING_LINK}`;
  const feedback = revision
    ? `What improved or remains strong:\n${v.strengths.map(s => `- ${s}`).join('\n')}`
    : `What you did well:\n${v.strengths.map(s => `- ${s}`).join('\n`)}\n\nWhat needs attention:\n${v.concerns.map(s => `- ${s}`).join(`\n')}`;
  const fixes = revision && action.complete ? '` : `\n\n${score >= p.revision_pass ? `Optional further improvements' : `Top three fixes to work toward ${p.revision_pass}/10`}:\n${v.changes.slice(0, 3).map((s, i) => `${i + 1}. ${s}`).join('\n')}`;
  return `Hi ${name},\n\nYour mid-semester peer-review ${label} quality score is ${score}/10${revision && !action.complete ? ` — the required ${p.revision_pass}/10 target has not yet been met` : ''}. This evaluates the quality of your written review, not the scores you gave teammates.\n\n${feedback}${fixes}\n\n${next}\n\nCopies are sent separately to hillmanp@gvsu.edu and your Project Manager.\n\nPaul W. Hillman`;
}

/** Confirmation sent when a student with a required peer-review meeting books it on Calendly. */
export function meetingConfirmedEmailBody(name: string, score: number, meetingTime: string, zoomLink: string | null, policy?: unknown) {
  const p = resolveOperationalRules(policy);
  return `Hi ${name},\n\nYour meeting with me about your peer review is confirmed for ${meetingTime}.${zoomLink ? `\nJoin: ${zoomLink}` : ' The Zoom link is in your calendar invitation.'}\n\nYour peer review currently stands at ${score}/10. The required target is ${p.revision_pass}/10.\n\nYou MUST be prepared to show me the changes you have made and the changes you expect will get your peer review to ${p.revision_pass}/10 or higher. Do not come to our meeting unprepared; I have dozens of these meetings. Failure to demonstrate that you have prepared will likely result in the meeting being cancelled and points deducted from your final score for failing to use our time efficiently.\n\nExample of how changes should look: ${PEER_REVISION_EXAMPLE_LINK}\n\nIf you need to reschedule, use the booking page: ${PEER_MEETING_LINK}\n\nCopies are sent separately to hillmanp@gvsu.edu and your Project Manager.\n\nPaul W. Hillman`;
}