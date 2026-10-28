import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { getPeerWorkspace, savePeerDiscussion } from '@/lib/peer-review-workspace.functions';
import { discussionOutcome, discussionScore } from '@/lib/peer-review-discussion';
import { toast } from 'sonner';

type Assessment = Awaited<ReturnType<typeof getPeerWorkspace>>['assessments'][number];
export function PeerDiscussionPanel({ assessment, meetings, notesOnly = false }: { assessment: Assessment; meetings: Awaited<ReturnType<typeof getPeerWorkspace>>['meetings']; notesOnly?: boolean }) {
  const [held, setHeld] = useState(!!assessment.discussion_held_at);
  const [note, setNote] = useState(assessment.discussion_note ?? assessment.accepted_note ?? '');
  const [busy, setBusy] = useState(false);
  const save = useServerFn(savePeerDiscussion);
  const qc = useQueryClient();
  const score = discussionScore(assessment);
  const outcome = discussionOutcome(score, assessment.discussion_min_score, assessment.discussion_deduction);
  const resolved = !!assessment.accepted_at || !!assessment.discussion_resolved_at;
  const act = async (decision: 'note' | 'accept' | 'deduct' | 'reopen') => {
    if (decision === 'deduct' && !window.confirm(`Record ${assessment.discussion_deduction} points against final totals? The peer-review score remains unchanged.`)) return;
    setBusy(true);
    try {
      await save({ data: { assessmentId: assessment.id, held, note, decision } });
      toast.success(decision === 'note' ? 'Meeting and comment saved.' : decision === 'reopen' ? 'Decision reopened.' : 'Decision saved — removed from Awaiting Review.');
      await qc.invalidateQueries();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Unable to save decision'); }
    finally { setBusy(false); }
  };
  return <section className="border-y py-4 space-y-3" aria-label="Meeting and instructor decision">
    <h3 className="font-display text-xl">Meeting &amp; decision · submission {assessment.attempt}</h3>
    {meetings.filter(m => m.student_id === assessment.user_id && m.team_id === assessment.team_id).map(m => <p key={m.id} className="text-sm text-muted-foreground">Calendar: {new Date(m.scheduled_at).toLocaleString('en-US', { timeZone: 'America/Detroit' })} Eastern{m.booking_topic ? ` · ${m.booking_topic}` : ''}</p>)}
    <label className="flex items-center gap-2 text-sm"><Checkbox checked={held} onCheckedChange={v => setHeld(v === true)} />We have met</label>
    {assessment.discussion_held_at && <p className="text-sm text-success">Meeting held · {new Date(assessment.discussion_held_at).toLocaleDateString('en-US', { timeZone: 'America/Detroit' })}</p>}
    {assessment.discussion_deduction < 0 && <p className="text-sm">Final acceptance threshold: {assessment.discussion_min_score}/10. Below that: {assessment.discussion_deduction} points against the student’s personal project total. The final fourth-submission re-grade saves this decision automatically.</p>}
    <p className="text-sm">Official score: {assessment.score ?? 'Not scored'}/10{score !== assessment.score ? ` · Detailed re-grade: ${score}/10` : ''}</p>
    {resolved && <p className={assessment.accepted_at ? 'text-success font-medium' : 'text-destructive font-medium'}>{assessment.accepted_at ? 'Accepted after discussion — no further revision needed.' : `Resolved · ${assessment.final_points_adjustment} points recorded against the student’s personal project total.`}</p>}
    <label htmlFor={`discussion-${assessment.id}`} className="block text-sm font-medium">Instructor comment</label>
    <Textarea id={`discussion-${assessment.id}`} value={note} maxLength={2000} onChange={e => setNote(e.target.value)} />
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={busy} onClick={() => act('note')}>Save meeting &amp; comment</Button>
      {!notesOnly && !resolved && <Button disabled={busy || !held || !note.trim() || assessment.status !== 'assessed' || (assessment.discussion_deduction < 0 && !outcome.canAccept)} onClick={() => act('accept')}>Accept as OK — move on</Button>}
      {!notesOnly && !resolved && outcome.canDeduct && <Button variant="destructive" disabled={busy || !held || !note.trim() || !assessment.detailed_regrade} onClick={() => act('deduct')}>Record {assessment.discussion_deduction} points &amp; close</Button>}
      {!notesOnly && resolved && <Button variant="outline" disabled={busy} onClick={() => act('reopen')}>Reopen decision</Button>}
    </div>
  </section>;
}