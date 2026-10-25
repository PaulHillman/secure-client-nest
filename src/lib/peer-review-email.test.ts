import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { peerEmailAction } from './peer-review-email';

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
});