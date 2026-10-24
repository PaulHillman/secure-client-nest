import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Link } from '@tanstack/react-router';
import { useAuth } from '@/lib/auth-context';
import { getHealthReviewGuide } from '@/lib/health-review-guide.functions';
import { guideReviewDue } from '@/lib/health-review-guide';

/** Health Review page: link to the weekly document, highlighted when a weekly review is due. */
export function HealthReviewGuideReminder() {
  const { isAdmin } = useAuth();
  const get = useServerFn(getHealthReviewGuide);
  const { data } = useQuery({ queryKey: ['health-review-guide'], queryFn: () => get({}), enabled: isAdmin });
  if (!isAdmin || !data) return null;
  const due = guideReviewDue(new Date(), data.reviewed_at);
  return <aside role="status" className={`mb-6 border-l-4 p-4 text-sm bg-muted/30 ${due ? 'border-gold' : 'border-border'}`}>
    <strong>{due ? 'Weekly Health Check Review document needs this week’s update.' : 'Weekly Health Check Review document is up to date.'}</strong>{' '}
    It records what this review checks and what changed this week.{' '}
    <Link to="/app/admin/health-review-guide" className="text-primary underline">Open document</Link>
  </aside>;
}
