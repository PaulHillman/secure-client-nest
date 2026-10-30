import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { healthPeerSummary, latestHealthPeerAssessments, type HealthPeerAssessment } from './health-peer-summary';
const row: HealthPeerAssessment = { user_id: 'student', team_id: 'team', file_id: 'file', attempt: 1, score: 6, status: 'assessed', created_at: '2026-10-23T12:00:00Z' };
const now = Date.parse('2026-10-30T22:53:00Z');
test('original 7 passes without revisions', () => assert.equal(healthPeerSummary({ ...row, score: 7 }, [], now).action, 'complete'));
test('revision 7 still needs 8 or a booked meeting', () => assert.equal(healthPeerSummary({ ...row, attempt: 2, score: 7 }, [], now).action, 'revise_or_book'));
test('revision 8 is complete', () => assert.equal(healthPeerSummary({ ...row, attempt: 2, score: 8 }, [], now).action, 'complete'));
test('third submission below 8 explicitly requires booking', () => assert.equal(healthPeerSummary({ ...row, attempt: 3 }, [], now).action, 'book_meeting'));
test('a real future peer meeting satisfies booking, unrelated appointments do not', () => {
  const a = { ...row, attempt: 3 };
  assert.equal(healthPeerSummary(a, [{ scheduled_at: '2026-11-06T15:00:00Z', booking_topic: 'Peer review' }], now).action, 'booked');
  assert.equal(healthPeerSummary(a, [{ scheduled_at: '2026-11-06T15:00:00Z', booking_topic: 'Course registration' }], now).action, 'book_meeting');
});
test('Izzy’s November 5 11:45 EST booking counts with a null topic', () => {
  const summary = healthPeerSummary({ ...row, attempt: 3, score: 7 }, [{ scheduled_at: '2026-11-05T16:45:00Z', booking_topic: null }], now);
  assert.equal(summary.action, 'booked');
});
test('an empty topic does not hide an existing future booking', () => {
  assert.equal(healthPeerSummary({ ...row, attempt: 3, score: 7 }, [{ scheduled_at: '2026-11-05T16:45:00Z', booking_topic: '  ' }], now).action, 'booked');
});
test('Calendly’s unspecified-topic placeholder does not hide an existing booking', () => {
  assert.equal(healthPeerSummary({ ...row, attempt: 3, score: 7 }, [{ scheduled_at: '2026-11-05T16:45:00Z', booking_topic: 'Topic not specified' }], now).action, 'booked');
});
test('a past booking with no topic does not satisfy an upcoming meeting requirement', () => {
  assert.equal(healthPeerSummary({ ...row, attempt: 3, score: 7 }, [{ scheduled_at: '2026-10-29T16:45:00Z', booking_topic: null }], now).action, 'book_meeting');
});
test('accepted decimal discussion result does not require another revision', () => assert.equal(healthPeerSummary({ ...row, attempt: 4, accepted_at: '2026-10-30T12:00:00Z' }, [], now).action, 'resolved'));
test('unreadable assessment is not scored or given revision instructions', () => assert.equal(healthPeerSummary({ ...row, score: null }, [], now).action, 'unverified'));
test('uses latest valid source, not original, invalid proxy, or deleted source', () => {
  const latest = latestHealthPeerAssessments([row, { ...row, attempt: 2, score: 8 }, { ...row, attempt: 3, status: 'ownership_invalid' }, { ...row, attempt: 4, file_id: null }]);
  assert.equal(latest.length, 1); assert.equal(latest[0]?.attempt, 2); assert.equal(latest[0]?.score, 8);
});
test('November deadlines remain Sunday 11:59 p.m. Detroit after DST change', () => {
  const summary = healthPeerSummary(row, [], now);
  assert.equal(summary.revisionDue, '2026-11-02T04:59:59Z');
  assert.equal(summary.meetingDue, '2026-11-09T04:59:59Z');
});