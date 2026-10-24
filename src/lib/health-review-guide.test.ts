import { describe, expect, it } from 'vitest';
import { guideReviewDue } from './health-review-guide';

describe('guideReviewDue', () => {
  const now = new Date('2026-10-24T17:00:00Z');
  it('is due when never reviewed', () => expect(guideReviewDue(now, null)).toBe(true));
  it('is not due 6 days after review', () => expect(guideReviewDue(now, '2026-10-18T17:00:00Z')).toBe(false));
  it('is due 7 days after review', () => expect(guideReviewDue(now, '2026-10-17T17:00:00Z')).toBe(true));
});
