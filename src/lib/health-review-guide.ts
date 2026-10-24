/** The weekly guide needs a fresh review once 7 days have passed since it was last marked reviewed. */
export function guideReviewDue(now: Date, reviewedAt: string | null) {
  if (!reviewedAt) return true;
  return now.getTime() - new Date(reviewedAt).getTime() >= 7 * 24 * 60 * 60 * 1000;
}
