import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { canAssessPeerAttempt, finalUploadState, bookingIdentity } from './peer-review-workspace';
test('a fourth submission requires exact-version instructor authorization', () => {
  assert.equal(canAssessPeerAttempt(4, false), false);
  assert.equal(canAssessPeerAttempt(4, true), true);
});
test('one final upload remains closed after its permission is consumed', () => {
  assert.equal(finalUploadState(null), 'locked');
  assert.equal(finalUploadState({ consumed_at: null }), 'allowed');
  assert.equal(finalUploadState({ consumed_at: '2026-10-26T18:00:00Z' }), 'used');
});
test('Sky booking with personal email matches her unique full name explicitly', () => {
  const people = [{ id: 'sky', name: 'Sky Lin', email: 'linsk@mail.gvsu.edu' }];
  assert.equal(bookingIdentity(people, 'skylin742@gmail.com', 'Sky Lin')?.person.id, 'sky');
  assert.equal(bookingIdentity([...people, { ...people[0], id: 'other' }], 'unknown@example.com', 'Sky Lin'), null);
});