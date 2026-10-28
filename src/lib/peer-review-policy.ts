export const ORIGINAL_PEER_DUE = '2026-10-26T03:59:59Z';
export const REVISION_PEER_DUE = '2026-11-02T04:59:59Z';
export const MEETING_PEER_DUE = '2026-11-09T04:59:59Z';
export function peerReviewPass(score: number, attempt = 1) { return score >= (attempt === 1 ? 7 : 8); }
export function peerOriginalFiled(status: string, fileId: string | null) {
  return fileId !== null && status !== 'missing' && status !== 'incomplete';
}

import { discussionScore } from './peer-review-discussion';
export type PeerBadgeInfo = { score: number | null; status: string; attempt: number; accepted_at?: string | null; detailed_regrade?: unknown };
export function peerBadgeScore(a: PeerBadgeInfo) { return a.accepted_at ? discussionScore(a) : a.score; }

// After Sunday 11/8 11:59 p.m. ET any latest score below 8 shows red.
export function peerBadgeLabel(a: PeerBadgeInfo) {
  if (a.score === null) return a.status === 'missing' ? 'Not submitted' : a.status;
  if (a.accepted_at) return `Accepted after discussion ${peerBadgeScore(a)}/10`;
  return `${a.attempt <= 1 ? 'Original' : 'Updated'} Peer Review ${a.score}/10`;
}

export function peerBadgeTone(score: number | null, now: Date = new Date(), attempt = 1, acceptedAt?: string | null) {
  if (score === null) return 'bg-muted text-muted-foreground border-border';
  if (acceptedAt) return 'bg-success/15 text-success border-success/30';
  if (now > new Date(MEETING_PEER_DUE) && score < 8)
    return 'bg-destructive/15 text-destructive border-destructive/30';
  if (peerReviewPass(score, attempt)) return 'bg-success/15 text-success border-success/30';
  if (score >= 4) return 'bg-gold/15 text-gold border-gold/30';
  return 'bg-destructive/15 text-destructive border-destructive/30';
}