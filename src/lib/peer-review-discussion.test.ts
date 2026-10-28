import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { discussionOutcome, discussionScore, finalRegradeDecision } from './peer-review-discussion';
test('Sky final review accepts 7.6 or higher', () => {
  assert.equal(discussionOutcome(7.6, 7.6, -10).canAccept, true);
  assert.equal(discussionOutcome(7.5, 7.6, -10).canAccept, false);
});
test('Sky below 7.6 records minus ten, not a changed peer score', () => {
  assert.equal(discussionOutcome(7.5, 7.6, -10).adjustment, -10);
  assert.equal(discussionOutcome(7.6, 7.6, -10).adjustment, 0);
  assert.equal(discussionOutcome(null, 7.6, -10).canDeduct, false);
});
test('saved decimal analysis takes precedence over the integer score', () => {
  assert.equal(discussionScore({ score: 7, detailed_regrade: { precise_score: 7.6 } }), 7.6);
});
test('final fourth submission at 7.6 completes automatically without a deduction', () => {
  const result = finalRegradeDecision({ attempt: 4, final_submission: true }, 7.6, 'instructor', 'now');
  assert.equal(result.accepted_at, 'now');
  assert.equal(result.final_points_adjustment, 0);
  assert.equal(result.discussion_resolved_at, 'now');
});
test('final fourth submission below 7.6 records minus ten personal project points', () => {
  const result = finalRegradeDecision({ attempt: 4, final_submission: true }, 7.5, 'instructor', 'now');
  assert.equal(result.accepted_at, null);
  assert.equal(result.final_points_adjustment, -10);
});
test('no automatic final decision on earlier attempts or invalid scores', () => {
  assert.deepEqual(finalRegradeDecision({ attempt: 3, final_submission: false }, 7.6, 'instructor', 'now'), {});
  assert.deepEqual(finalRegradeDecision({ attempt: 4, final_submission: true }, NaN, 'instructor', 'now'), {});
});