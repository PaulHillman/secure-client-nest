export type WithdrawalProfile = { id: string; is_withdrawn?: boolean; email?: string | null };

/** Filter expectations only; never delete membership or historical evidence. */
export function activeStudentMembers<T extends { user_id: string }>(members: T[], profiles: WithdrawalProfile[]): T[] {
  const withdrawn = new Set(profiles.filter(p => p.is_withdrawn).map(p => p.id));
  return members.filter(m => !withdrawn.has(m.user_id));
}

export function isWithdrawnRecipient(recipient: string, profiles: WithdrawalProfile[]): boolean {
  const address = recipient.trim().toLowerCase();
  return profiles.some(p => p.is_withdrawn && p.email?.trim().toLowerCase() === address);
}

export function excludesWithdrawnConcern(concern: { userId?: string | null; person?: string | null }, profiles: (WithdrawalProfile & { name?: string; first_name?: string | null; last_name?: string | null })[]): boolean {
  return profiles.some(p => p.is_withdrawn && (concern.userId === p.id || (!concern.userId && !!concern.person && [p.name, `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim()].includes(concern.person))));
}