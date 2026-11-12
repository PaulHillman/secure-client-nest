import { concernKey, type Concern } from './health-review-comparison';

export type MeetingExemption = { team_id: string; semester_start: string; excused_count: number; reason: string };

export function meetingExemption(teamId: string, semesterStart: string | null | undefined, rows: MeetingExemption[]) {
  return rows.find(row => row.team_id === teamId && row.semester_start === semesterStart);
}

export function expectedMeetingDocuments(week: number, startWeek: number, excused = 0) {
  return Math.max(0, week - startWeek - excused);
}

/** Only the historical shortfall covered by the exception loses its escalation history. */
export function isExcusedHistoricalShortfall(concern: Concern, excused: number) {
  if (excused <= 0 || !['vault:Minutes:team', 'vault:Agendas:team'].includes(concernKey(concern) ?? '')) return false;
  const match = /^(?:Minutes|Agendas): (\d+) posted, (\d+) expected by week \d+\./.exec(concern.reason);
  return !!match && Number(match[2]) > Number(match[1]) && Number(match[2]) - Number(match[1]) <= excused;
}