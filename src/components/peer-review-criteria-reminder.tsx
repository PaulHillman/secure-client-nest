import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Link } from '@tanstack/react-router';
import { useAuth } from '@/lib/auth-context';
import { getPeerReviewCriteria } from '@/lib/peer-review-criteria.functions';
import { criteriaReminderDue } from '@/lib/peer-review-criteria';

export function PeerReviewCriteriaReminder() {
  const { isAdmin } = useAuth();
  const get = useServerFn(getPeerReviewCriteria);
  const { data } = useQuery({ queryKey: ['peer-review-criteria'], queryFn: () => get({}), enabled: isAdmin });
  if (!isAdmin || !data || !criteriaReminderDue(new Date(), data.reminder_month_day, data.reviewed_year)) return null;
  return <aside role="status" className="mb-6 border-l-4 border-gold bg-muted/30 p-4 text-sm">
    <strong>Peer-review criteria need your yearly review.</strong>{' '}
    The evaluation criteria are stored in Admin. Review them for this year before evaluating submitted peer reviews.{' '}
    <Link to="/app/admin/peer-review-criteria" className="text-primary underline">Review criteria</Link>
  </aside>;
}