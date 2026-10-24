import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { guideReviewDue } from './health-review-guide';

describe('guideReviewDue', () => {
  const now = new Date('2026-10-24T17:00:00Z');
  it('is due when never reviewed', () => assert.equal(guideReviewDue(now, null), true));
  it('is not due 6 days after review', () => assert.equal(guideReviewDue(now, '2026-10-18T17:00:00Z'), false));
  it('is due 7 days after review', () => assert.equal(guideReviewDue(now, '2026-10-17T17:00:00Z'), true));
});
