import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeStudentMembers, excludesWithdrawnConcern, isWithdrawnRecipient } from './student-withdrawal';

const profiles = [{ id: 'withdrawn', name: 'Former Student', email: 'Former@example.edu', is_withdrawn: true }, { id: 'active', name: 'Current Student', email: 'current@example.edu', is_withdrawn: false }];
test('withdrawal excludes current expectations without mutating retained memberships', () => {
  const members = [{ user_id: 'withdrawn', job_title: 'PM' }, { user_id: 'active', job_title: 'Researcher' }];
  assert.deepEqual(activeStudentMembers(members, profiles), [members[1]]);
  assert.equal(members.length, 2);
});
test('withdrawn email addresses are blocked regardless of case or recipient copy role', () => {
  assert.equal(isWithdrawnRecipient(' former@EXAMPLE.edu ', profiles), true);
  assert.equal(isWithdrawnRecipient('current@example.edu', profiles), false);
  assert.equal(isWithdrawnRecipient('instructor@example.edu', profiles), false);
});
test('reinstatement restores eligibility and email delivery', () => {
  const restored = profiles.map(p => ({ ...p, is_withdrawn: false }));
  assert.equal(activeStudentMembers([{ user_id: 'withdrawn' }], restored).length, 1);
  assert.equal(isWithdrawnRecipient('former@example.edu', restored), false);
});
test('withdrawn concerns do not earn comparison credit or erase team-level concerns', () => {
  assert.equal(excludesWithdrawnConcern({ userId: 'withdrawn' }, profiles), true);
  assert.equal(excludesWithdrawnConcern({ person: 'Former Student' }, profiles), true);
  assert.equal(excludesWithdrawnConcern({ userId: 'active' }, profiles), false);
  assert.equal(excludesWithdrawnConcern({ person: null }, profiles), false);
});