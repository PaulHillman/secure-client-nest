export const PEER_REVISION_CLOSED_AT = '2026-11-02T05:00:00Z';
export const PEER_BOOKING_CLOSED_AT = '2026-11-02T16:27:00Z';
export function regularPeerRevisionAllowed(now: number, finalAuthorized = false, cutoff = PEER_REVISION_CLOSED_AT) {
  return finalAuthorized || now < Date.parse(cutoff);
}
export function peerBookingAllowed(createdAt: string | null | undefined, existing: boolean, cutoff = PEER_BOOKING_CLOSED_AT) {
  if (existing) return true;
  const created = createdAt ? Date.parse(createdAt) : NaN;
  return Number.isFinite(created) && created <= Date.parse(cutoff);
}