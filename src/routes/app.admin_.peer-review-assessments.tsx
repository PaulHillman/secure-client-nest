import { createFileRoute, Navigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { listPeerReviewAssessments, sendPeerReviewAssessment } from '@/lib/peer-review-assessments.functions';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
export const Route = createFileRoute('/app/admin_/peer-review-assessments')({ head: () => ({ meta: [
  { title: 'Individual Peer Review Results — ClientVault Admin' }, { name: 'description', content: 'Retained individual peer-review scores, feedback and email outcomes.' }, { property: 'og:title', content: 'Individual Peer Review Results — ClientVault Admin' }, { property: 'og:description', content: 'Instructor review of individual peer-review assessments and saved messages.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
] }), component: Page });
function Page() {
  const { isAdmin, loading } = useAuth();
  const list = useServerFn(listPeerReviewAssessments);
  const send = useServerFn(sendPeerReviewAssessment);
  const query = useQuery({ queryKey: ['peer-review-assessments'], queryFn: () => list({}), enabled: isAdmin });
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  if (loading) return null;
  if (!isAdmin) return <Navigate to="/app/dashboard" />;
  const sendOne = async (id: string, copy: 'student' | 'instructor' | 'pm') => {
    setBusy(`${id}-${copy}`);
    try { const result = await send({ data: { id, copy } }); toast.success(result.status); await qc.invalidateQueries({ queryKey: ['peer-review-assessments'] }); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Send failed'); }
    finally { setBusy(null); }
  };
  return <main className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6"><h1 className="font-display text-3xl">Individual Peer Review Results</h1>{query.error && <p role="alert">{query.error.message}</p>}<p className="text-muted-foreground">{query.data?.length ?? 0} retained assessments</p><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Student</th><th className="p-2">Team</th><th className="p-2">Score</th><th className="p-2">Email copies</th></tr></thead><tbody>{query.data?.map(row => <tr key={row.id} data-assessment-id={row.id} className="border-b align-top"><td className="p-2 min-w-48">{row.profiles?.name}<details className="mt-2"><summary className="cursor-pointer text-primary">Saved feedback</summary><div className="whitespace-pre-wrap mt-3 max-w-xl">{row.email_body}</div></details></td><td className="p-2">{row.teams?.display_name} · {row.teams?.section}</td><td className="p-2">{row.score === null ? row.status : `${row.score}/10`}</td><td className="p-2"><div className="flex flex-col gap-2">{(['student', 'instructor', 'pm'] as const).map(copy => { const status = copy === 'student' ? row.student_email_status : copy === 'instructor' ? row.instructor_email_status : row.pm_email_status; return <Button key={copy} variant="outline" size="sm" aria-label={`Send ${copy} copy for ${row.profiles?.name}`} disabled={busy !== null || status !== 'pending'} onClick={() => sendOne(row.id, copy)}>{copy}: {status}</Button>; })}</div></td></tr>)}</tbody></table></div></main>;
}