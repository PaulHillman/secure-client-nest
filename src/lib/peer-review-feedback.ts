/** Priority order is supplied by the assessment, never inferred from the filename or score. */
export function peerPriorityFixes(score: number | null | undefined, changes: unknown, target = 8): string[] {
  if (score == null || score >= target || !Array.isArray(changes)) return [];
  return changes.filter((change): change is string => typeof change === "string" && !!change.trim())
    .map((change) => change.trim()).slice(0, 3);
}