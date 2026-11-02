import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { peerBookingAllowed, regularPeerRevisionAllowed } from './peer-deadline';
test('regular revisions accept all of November 1 11:59 p.m. Detroit, but not November 2', () => {
  assert.equal(regularPeerRevisionAllowed(Date.parse('2026-11-02T04:59:59.999Z')), true);
  assert.equal(regularPeerRevisionAllowed(Date.parse('2026-11-02T05:00:00Z')), false);
});
test('only instructor-authorized final submissions bypass the revision closure', () => {
  assert.equal(regularPeerRevisionAllowed(Date.parse('2026-11-02T16:27:00Z'), true), true);
  assert.equal(regularPeerRevisionAllowed(Date.parse('2026-11-02T16:27:00Z'), false), false);
});
test('new bookings close at the November 2 16:27 UTC instruction, regardless of meeting date', () => {
  assert.equal(peerBookingAllowed('2026-11-02T16:27:00Z', false), true);
  assert.equal(peerBookingAllowed('2026-11-02T16:27:00.001Z', false), false);
});
test('existing bookings survive and missing provider timestamps never admit a new booking', () => {
  assert.equal(peerBookingAllowed(null, true), true);
  assert.equal(peerBookingAllowed(null, false), false);
});