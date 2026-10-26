import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { peerEmailAction, revisionEmailBody, meetingConfirmedEmailBody, PEER_MEETING_LINK, PEER_REVISION_EXAMPLE_LINK } from './peer-review-email';

describe('revision email next-step rules', () => {
  test('first revision below 8 has exactly one submission remaining', () => {
    assert.deepEqual(peerEmailAction(7, 2), { target: 8, complete: false, remainingSubmissions: 1, meetingRequired: false });
  });
  test('second revision below 8 requires a meeting with no submissions left', () => {
    assert.deepEqual(peerEmailAction(7, 3), { target: 8, complete: false, remainingSubmissions: 0, meetingRequired: true });
  });
  test('revision reaching 8 requires no further action', () => {
    assert.equal(peerEmailAction(8, 3).complete, true);
    assert.equal(peerEmailAction(8, 3).meetingRequired, false);
  });
  test('email changes do not revoke an original 7 pass', () => {
    assert.equal(peerEmailAction(7, 1).complete, true);
  });
  test('first-revision email omits the meeting link', () => {
    const body = revisionEmailBody('Alex', 2, 6, { strengths: [], concerns: [], changes: ['Fix one'] });
    assert.ok(body.includes('submission 3 of 3'));
    assert.ok(!body.includes(PEER_MEETING_LINK));
    assert.ok(!body.includes('book a meeting'));
  });
  test('second-revision email includes the meeting link', () => {
    const body = revisionEmailBody('Alex', 3, 7, { strengths: [], concerns: [], changes: ['Fix one'] });
    assert.ok(body.includes(PEER_MEETING_LINK));
    assert.ok(body.includes('A meeting with me is now required'));
  });
});
describe('meeting confirmed email', () => {
  test('includes score, meeting time, preparation warning, and example link', () => {
    const body = meetingConfirmedEmailBody('Alex', 7, 'Monday, November 2, 2026 at 3:30 PM EDT', 'https://zoom.us/j/123');
    assert.ok(body.includes('confirmed for Monday, November 2, 2026 at 3:30 PM EDT'));
    assert.ok(body.includes('currently stands at 7/10'));
    assert.ok(body.includes('MUST be prepared to show me the changes'));
    assert.ok(body.includes('points deducted'));
    assert.ok(body.includes(PEER_REVISION_EXAMPLE_LINK));
    assert.ok(body.includes('https://zoom.us/j/123'));
    assert.ok(body.includes(PEER_MEETING_LINK));
  });
  test('falls back to calendar invitation when no zoom link', () => {
    const body = meetingConfirmedEmailBody('Alex', 6, 'Monday, November 2, 2026 at 3:30 PM EDT', null);
    assert.ok(body.includes('Zoom link is in your calendar invitation'));
  });
});
