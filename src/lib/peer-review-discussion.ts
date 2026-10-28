export function discussionOutcome(score: number | null, minimum: number, deduction: number) {
  if (score == null || !Number.isFinite(score)) return { canAccept: false, canDeduct: false, adjustment: 0 };
  return { canAccept: score >= minimum, canDeduct: score < minimum && deduction < 0, adjustment: score < minimum ? deduction : 0 };
}

export function discussionScore(assessment: { score: number | null; detailed_regrade?: unknown }) {
  const detail = assessment.detailed_regrade;
  if (detail && typeof detail === 'object' && 'precise_score' in detail && typeof detail.precise_score === 'number' && Number.isFinite(detail.precise_score)) return detail.precise_score;
  return assessment.score;
}

export function finalRegradeDecision(assessment: { attempt: number; final_submission: boolean }, preciseScore: number, actorId: string, now: string) {
  if (!assessment.final_submission || assessment.attempt !== 4 || !Number.isFinite(preciseScore)) return {};
  const accepted = preciseScore >= 7.6;
  return {
    discussion_min_score: 7.6, discussion_deduction: -10,
    accepted_at: accepted ? now : null, accepted_by: accepted ? actorId : null,
    accepted_note: accepted ? `Final detailed re-grade ${preciseScore}/10 meets the 7.6/10 threshold — complete.` : null,
    discussion_resolved_at: now, final_points_adjustment: accepted ? 0 : -10,
  };
}