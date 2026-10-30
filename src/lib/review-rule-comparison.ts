import { HEALTH_REVIEW_RULE_DEFAULTS } from './health-review-rules';
import { OPERATIONAL_DEFAULTS } from './review-rulebook';
/** Unknown legacy baselines use the documented original requirements, never new settings. */
export function changedEvidenceRules(previous: { thresholds?: unknown; operational?: unknown } | undefined, current: { thresholds: unknown; operational: unknown }): Set<string> {
  const before = { ...HEALTH_REVIEW_RULE_DEFAULTS, ...(previous?.thresholds as object ?? {}) } as Record<string, unknown>;
  const after = current.thresholds as Record<string, unknown>;
  const p = { ...OPERATIONAL_DEFAULTS, ...(previous?.operational as object ?? {}) } as Record<string, unknown>;
  const n = current.operational as Record<string, unknown>;
  const different = (keys: string[], a: Record<string, unknown>, b: Record<string, unknown>) => keys.some(k => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
  const changed = new Set<string>();
  if (different(['research_topics'], p, n) || different(['research_required_early', 'research_required_late', 'research_due'], before, after)) changed.add('vault:research');
  return changed;
}