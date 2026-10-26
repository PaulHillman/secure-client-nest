export function finalUploadState(permission: { consumed_at: string | null } | null | undefined) {
  return !permission ? 'locked' : permission.consumed_at ? 'used' : 'allowed';
}

export function canAssessPeerAttempt(attempt: number, authorizedVersion: boolean) {
  return attempt <= 3 || authorizedVersion;
}

export function bookingIdentity<T extends { id: string; name: string; email: string | null }>(people: T[], email: string, name: string) {
  const exact = people.filter(p => p.email?.toLowerCase() === email.toLowerCase());
  if (exact.length === 1) return { person: exact[0], match: 'email' };
  const named = people.filter(p => p.name.trim().toLowerCase() === name.trim().toLowerCase());
  return named.length === 1 ? { person: named[0], match: 'name — booking email differs' } : null;
}