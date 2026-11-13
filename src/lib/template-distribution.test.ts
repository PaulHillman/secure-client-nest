import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { templateCoverageComplete } from './template-distribution';

test('all 14 class teams are complete without requiring the fifteenth test team', () => {
  assert.equal(templateCoverageComplete(14, 14), true);
  assert.equal(templateCoverageComplete(14, 15), false);
});
test('fewer than 14 synchronized copies are incomplete', () => {
  assert.equal(templateCoverageComplete(13, 14), false);
  assert.equal(templateCoverageComplete(0, 14), false);
});
test('an empty team list cannot appear complete', () => {
  assert.equal(templateCoverageComplete(0, 0), false);
});