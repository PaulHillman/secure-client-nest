import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { getPeerWorkspace } from '@/lib/peer-review-workspace.functions';
import { PeerReviewStudentWorkspace } from '@/components/peer-review-student-workspace';
import type { AwaitingPeerDecision } from '@/lib/awaiting-review';

export function PeerDecisionReviewDialog({ item, onClose }: { item: AwaitingPeerDecision; onClose: () => void }) {
  const get = useServerFn(getPeerWorkspace);
  const query = useQuery({ queryKey: ['peer-workspace'], queryFn: () => get() });
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="max-w-5xl max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>Review &amp; decide · {item.studentName}</DialogTitle><DialogDescription>{item.teamName} · Latest submission, meeting record and instructor decision</DialogDescription></DialogHeader>
    {query.isPending && <p role="status">Loading submission history…</p>}
    {query.error && <p role="alert">{query.error.message}</p>}
    {query.data && <PeerReviewStudentWorkspace data={query.data} studentId={item.studentId} teamId={item.teamId} />}
  </DialogContent></Dialog>;
}