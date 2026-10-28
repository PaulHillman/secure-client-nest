import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { discussionOutcome, discussionScore } from './peer-review-discussion';
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