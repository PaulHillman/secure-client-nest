import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { peerReviewPass, peerOriginalFiled, ORIGINAL_PEER_DUE, REVISION_PEER_DUE, MEETING_PEER_DUE } from './peer-review-policy';
describe('instructor peer-review rules', () => {
  it('original 7 passes', () => assert.equal(peerReviewPass(7, 1), true));
  it('original 6 requires revision', () => assert.equal(peerReviewPass(6, 1), false));
  it('revision 7 does not pass', () => assert.equal(peerReviewPass(7, 2), false));
  it('revision 8 passes', () => assert.equal(peerReviewPass(8, 2), true));
  it('partial appendix is not a complete original', () => assert.equal(peerOriginalFiled('incomplete', 'appendix-file'), false));
  it('named original counts even when another teammate uploaded it', () => assert.equal(peerOriginalFiled('assessed', 'shared-upload'), true));
  it('original due Sunday October 25 at 11:59 Eastern', () => assert.equal(ORIGINAL_PEER_DUE, '2026-10-26T03:59:59Z'));
  it('revision due Sunday November 1 at 11:59 Eastern after DST', () => assert.equal(REVISION_PEER_DUE, '2026-11-02T04:59:59Z'));
  it('meeting due Sunday November 8 at 11:59 Eastern', () => assert.equal(MEETING_PEER_DUE, '2026-11-09T04:59:59Z'));
});