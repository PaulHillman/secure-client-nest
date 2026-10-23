export const ORIGINAL_PEER_DUE = '2026-10-26T03:59:59Z';
export const REVISION_PEER_DUE = '2026-11-02T04:59:59Z';
export const MEETING_PEER_DUE = '2026-11-09T04:59:59Z';
export function peerReviewPass(score: number, attempt = 1) { return score >= (attempt === 1 ? 7 : 8); }