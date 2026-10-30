import { peerReviewPass, REVISION_PEER_DUE, MEETING_PEER_DUE } from './peer-review-policy';
import { resolveOperationalRules, deadlineLabel, detroitDeadline, type OperationalRules } from './review-rulebook';

export type HealthPeerAssessment = {
  user_id: string; team_id: string; file_id: string | null; attempt: number;
  score: number | null; status: string; created_at: string;
  accepted_at?: string | null; discussion_resolved_at?: string | null;
  discussion_held_at?: string | null;
  policy_snapshot?: unknown; changes?: unknown;
};
export type HealthPeerMeeting = { scheduled_at: string; booking_topic?: string | null };

export function latestHealthPeerAssessments(rows: HealthPeerAssessment[]) {
  const latest = new Map<string, HealthPeerAssessment>();
  for (const row of rows) {
    if (row.status === 'ownership_invalid' || !row.file_id || row.status === 'missing' || row.status === 'incomplete') continue;
    const key = `${row.team_id}:${row.user_id}`;
    const previous = latest.get(key);
    if (!previous || row.attempt > previous.attempt || (row.attempt === previous.attempt && row.created_at > previous.created_at)) latest.set(key, row);
  }
  return [...latest.values()];
}

/** Weekly next steps only; detailed assessment feedback stays in individual records. */
export function healthPeerSummary(a: HealthPeerAssessment, meetings: HealthPeerMeeting[], now: number, presentation?: OperationalRules) {
  const p = resolveOperationalRules(a.policy_snapshot);
  const view = presentation ?? p;
  const revisionDue = detroitDeadline(p.revision_due);
  const meetingDue = detroitDeadline(p.meeting_due);
  // Already scoped to this student and team by the caller. Legacy/webhook
  // bookings can omit the topic; an absent answer must not erase a booking.
  // Explicit unrelated topics remain excluded.
  const booked = meetings.filter(m => {
    const topic = m.booking_topic?.trim() ?? '';
    return Date.parse(m.scheduled_at) > now && (!topic || /^topic not specified$/i.test(topic) || /peer[\s-]*review|peer[\s-]*evaluation/i.test(topic));
  }).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0];
  const prefix = `Peer review · submission ${a.attempt}${a.score === null ? ' · awaiting assessment' : ` · ${a.score}/10`}.`;
  if (a.accepted_at || a.discussion_resolved_at) return { action: 'resolved', level: null, reason: `${prefix} Instructor decision recorded; no resubmission or booking required.`, revisionDue, meetingDue } as const;
  if (a.score === null) return { action: 'unverified', level: null, reason: `${prefix} Instructor review needed; no score assumed.`, revisionDue, meetingDue } as const;
  if (peerReviewPass(a.score, a.attempt, p)) return { action: 'complete', level: null, reason: `${prefix} Complete; no resubmission or meeting required.`, revisionDue, meetingDue } as const;
  const level = a.score < 4 ? 'red' : 'yellow';
  if (a.discussion_held_at) return { action: 'meeting_held', level, reason: `${prefix} Meeting held; follow the instructor’s final-submission instructions.`, revisionDue, meetingDue } as const;
  if (booked) {
    const date = new Date(booked.scheduled_at).toLocaleString('en-US', { timeZone: 'America/Detroit', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    return { action: 'booked', level, reason: `${prefix} Meeting booked ${date} Detroit time${Date.parse(booked.scheduled_at) > Date.parse(meetingDue) ? ` — reschedule by ${deadlineLabel(p.meeting_due)}` : `; prepare your changes toward ${p.revision_pass}/10+`}.`, revisionDue, meetingDue } as const;
  }
  const needsMeeting = a.attempt >= p.max_submissions;
  const fixes = view.summary_mode === 'with_fixes' && Array.isArray(a.changes) ? a.changes.filter((s): s is string => typeof s === 'string').slice(0, view.summary_fixes).join('; ') : '';
  return { action: needsMeeting ? 'book_meeting' : 'revise_or_book', level, reason: `${prefix} ${needsMeeting ? `${view.missing_meeting_warning ? `Required meeting not scheduled after ${p.max_submissions === 3 ? 'three' : p.max_submissions} submissions. ` : 'Meeting required. '}Book by ${deadlineLabel(p.revision_due)}; meet by ${deadlineLabel(p.meeting_due)}.` : `Resubmit to reach ${p.revision_pass}/10+ or book a meeting by ${deadlineLabel(p.revision_due)}; meet by ${deadlineLabel(p.meeting_due)}.`} Detroit time.${fixes ? ` Priority fixes: ${fixes}` : ''}`, revisionDue, meetingDue } as const;
}