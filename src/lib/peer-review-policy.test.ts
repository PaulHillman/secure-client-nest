import { describe, expect, it } from 'vitest';
import { peerReviewPass, ORIGINAL_PEER_DUE, REVISION_PEER_DUE, MEETING_PEER_DUE } from './peer-review-policy';
describe('instructor peer-review rules', () => {
  it('original 7 passes', () => expect(peerReviewPass(7, 1)).toBe(true));
  it('original 6 requires revision', () => expect(peerReviewPass(6, 1)).toBe(false));
  it('revision 7 does not pass', () => expect(peerReviewPass(7, 2)).toBe(false));
  it('revision 8 passes', () => expect(peerReviewPass(8, 2)).toBe(true));
  it('original due Sunday October 25 at 11:59 Eastern', () => expect(ORIGINAL_PEER_DUE).toBe('2026-10-26T03:59:59Z'));
  it('revision due Sunday November 1 at 11:59 Eastern after DST', () => expect(REVISION_PEER_DUE).toBe('2026-11-02T04:59:59Z'));
  it('meeting due Sunday November 8 at 11:59 Eastern', () => expect(MEETING_PEER_DUE).toBe('2026-11-09T04:59:59Z'));
});