// Three-week "low engagement" cycle: a student who only signs in / opens the health report,
// without any meaningful contribution, builds a consecutive-week streak.
// Week 1 = note only, week 2 = yellow, week 3+ = red. Any meaningful action in a week resets it.
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Meaningful actions: uploads, file comments, attending/logging a meeting, proof submissions,
 *  or opening team materials (any page other than the dashboard / health report). */
export type Contribution = { userId: string; at: string };

/** Number of consecutive weeks (most recent first, up to `weeks`) without a meaningful contribution. */
/** Page-visit tracking only began recording reliably on this date; weeks before it can't be judged. */
export const LOW_ENGAGEMENT_START = Date.parse("2026-10-17T04:00:00Z");

export function lowEngagementStreak(userId: string, contributions: Contribution[], now: number, weeks = 3, trackingStart = 0): number {
  let streak = 0;
  for (let w = 0; w < weeks; w++) {
    const end = now - w * WEEK_MS, start = end - WEEK_MS;
    if (start < trackingStart) break;
    const hit = contributions.some(c => c.userId === userId && Date.parse(c.at) > start && Date.parse(c.at) <= end);
    if (hit) break;
    streak++;
  }
  return streak;
}

/**
 * `weeks` is the configured cycle length: the final week is red, the week before it
 * is yellow, and a single empty week is only a note. With the default of 3 this is
 * exactly the original note / yellow / red escalation.
 */
export function lowEngagementLevel(streak: number, weeks = 3): "note" | "yellow" | "red" | null {
  const redAt = Math.max(2, weeks);
  return streak >= redAt ? "red" : streak === redAt - 1 ? "yellow" : streak >= 1 ? "note" : null;
}

/** Page views that count as reviewing team materials (not just the dashboard or health report). */
export function isMaterialView(path: string | null, label: string | null): boolean {
  if (!path) return false;
  if (/health/i.test(label ?? "") || /health/i.test(path)) return false;
  return !/^\/app\/?(dashboard)?\/?$/.test(path);
}
