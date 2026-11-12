import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { meetingExemption, expectedMeetingDocuments, isExcusedHistoricalShortfall } from './health-meeting-exemption';
import { compareConcerns } from './health-review-comparison';

const team = 'bc3300e0-0d16-4ec5-be52-f4e74cab2048';
const rows = [{ team_id: team, semester_start: '2026-08-31', excused_count: 1, reason: 'Fall break' }];
test('Upper Mismanagement has exactly one excused fall-2026 meeting, not another team or semester', () => {
  assert.equal(meetingExemption(team, '2026-08-31', rows)?.excused_count, 1);
  assert.equal(meetingExemption('other-team', '2026-08-31', rows), undefined);
  assert.equal(meetingExemption(team, '2027-01-01', rows), undefined);
});
test('one excused meeting reduces both document expectations from eight to seven without fabricating a meeting', () => {
  assert.equal(expectedMeetingDocuments(11, 3, 1), 7);
  assert.equal(expectedMeetingDocuments(11, 3), 8);
  assert.equal(expectedMeetingDocuments(3, 3, 1), 0);
});
test('only the excused shortfall loses historical escalation; unrelated deficits remain', () => {
  const old = { check: 'vault', level: 'red' as const, reason: 'Minutes: 6 posted, 7 expected by week 10. Prior warning.', ruleId: 'vault:Minutes:team' };
  assert.equal(isExcusedHistoricalShortfall(old, 1), true);
  assert.equal(isExcusedHistoricalShortfall({ ...old, reason: 'Minutes: 5 posted, 7 expected by week 10.' }, 1), false);
  assert.equal(isExcusedHistoricalShortfall({ ...old, ruleId: 'vault:research' }, 1), false);
  assert.equal(isExcusedHistoricalShortfall({ ...old, reason: old.reason.replace('Minutes', 'Agendas'), ruleId: 'vault:Agendas:team' }, 1), true);
});
test('excused meeting clears a previous document finding as a reporting correction, not student-earned progress', () => {
  const old = { check: 'vault', level: 'red' as const, reason: 'Minutes: 6 posted, 7 expected by week 10.', ruleId: 'vault:Minutes:team' };
  assert.equal(compareConcerns([old], [], [{ ruleId: old.ruleId, evidence: 'Instructor excused one meeting.', remaining: 0, verified: true, reportingCorrection: true }])[0]?.status, 'Reporting correction');
});