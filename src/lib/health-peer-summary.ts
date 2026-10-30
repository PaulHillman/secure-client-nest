import { peerReviewPass, REVISION_PEER_DUE, MEETING_PEER_DUE } from './peer-review-policy';

export type HealthPeerAssessment = {
  user_id: string; team_id: string; file_id: string | null; attempt: number;
  score: number | null; status: string; created_at: string;
  accepted_at?: string | null; discussion_resolved_at?: string | null;
  discussion_held_at?: string | null;
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
export function healthPeerSummary(a: HealthPeerAssessment, meetings: HealthPeerMeeting[], now: number) {
  const revisionDue = REVISION_PEER_DUE;
  const meetingDue = MEETING_PEER_DUE;
  const booked = meetings.filter(m => Date.parse(m.scheduled_at) > now && /peer[\s-]*review|peer[\s-]*evaluation/i.test(m.booking_topic ?? '')).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0];
  const prefix = `Peer review · submission ${a.attempt}${a.score === null ? ' · awaiting assessment' : ` · ${a.score}/10`}.`;
  if (a.accepted_at || a.discussion_resolved_at) return { action: 'resolved', level: null, reason: `${prefix} Instructor decision recorded; no resubmission or booking required.`, revisionDue, meetingDue } as const;
  if (a.score === null) return { action: 'unverified', level: null, reason: `${prefix} Instructor review needed; no score assumed.`, revisionDue, meetingDue } as const;
  if (peerReviewPass(a.score, a.attempt)) return { action: 'complete', level: null, reason: `${prefix} Complete; no resubmission or meeting required.`, revisionDue, meetingDue } as const;
  const level = a.score < 4 ? 'red' : 'yellow';
  if (a.discussion_held_at) return { action: 'meeting_held', level, reason: `${prefix} Meeting held; follow the instructor’s final-submission instructions.`, revisionDue, meetingDue } as const;
  if (booked) {
    const date = new Date(booked.scheduled_at).toLocaleString('en-US', { timeZone: 'America/Detroit', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    return { action: 'booked', level, reason: `${prefix} Meeting booked ${date} Detroit time${Date.parse(booked.scheduled_at) > Date.parse(meetingDue) ? ' — reschedule by Nov 8, 11:59 p.m.' : '; prepare your changes toward 8/10+'}.`, revisionDue, meetingDue } as const;
  }
  return { action: a.attempt >= 3 ? 'book_meeting' : 'revise_or_book', level, reason: `${prefix} ${a.attempt >= 3 ? 'Required meeting not scheduled after three submissions. Book by Nov 1, 11:59 p.m.; meet by Nov 8, 11:59 p.m.' : 'Resubmit to reach 8/10+ or book a meeting by Nov 1, 11:59 p.m.; meet by Nov 8, 11:59 p.m.'} Detroit time.`, revisionDue, meetingDue } as const;
}