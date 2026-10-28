export function discussionOutcome(score: number | null, minimum: number, deduction: number) {
  if (score == null || !Number.isFinite(score)) return { canAccept: false, canDeduct: false, adjustment: 0 };
  return { canAccept: score >= minimum, canDeduct: score < minimum && deduction < 0, adjustment: score < minimum ? deduction : 0 };
}

export function discussionScore(assessment: { score: number | null; detailed_regrade?: unknown }) {
  const detail = assessment.detailed_regrade;
  if (detail && typeof detail === 'object' && 'precise_score' in detail && typeof detail.precise_score === 'number' && Number.isFinite(detail.precise_score)) return detail.precise_score;
  return assessment.score;
}