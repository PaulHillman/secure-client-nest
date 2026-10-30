import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { diffWords } from 'diff';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileViewerDialog } from '@/components/file-viewer-dialog';
import { authorizeFinalPeerUpload, comparePeerVersions, getPeerWorkspace, regradePeerAfterDiscussion } from '@/lib/peer-review-workspace.functions';
import { finalUploadState } from '@/lib/peer-review-workspace';
import { peerBadgeScore, peerBadgeTone } from '@/lib/peer-review-policy';
import { peerPriorityFixes } from '@/lib/peer-review-feedback';
import { toast } from 'sonner';
import { FileText, Unlock, ArrowRight } from 'lucide-react';
import { PeerDiscussionPanel } from '@/components/peer-discussion-panel';

type Workspace = Awaited<ReturnType<typeof getPeerWorkspace>>;
export function PeerReviewStudentWorkspace({ data, studentId, teamId }: { data: Workspace; studentId: string; teamId: string }) {
  const rows = data.assessments.filter(a => a.user_id === studentId && a.team_id === teamId);
  const assessed = rows.filter(a => a.status === 'assessed');
  const latest = assessed.at(-1);
  const permission = data.permissions.find(p => p.student_id === studentId && p.team_id === teamId);
  const state = finalUploadState(permission);
  const authorize = useServerFn(authorizeFinalPeerUpload);
  const compare = useServerFn(comparePeerVersions);
  const qc = useQueryClient();
  const regrade = useServerFn(regradePeerAfterDiscussion);
  const [regrading, setRegrading] = useState<string | null>(null);
  const runRegrade = async (id: string) => {
    setRegrading(id);
    try { await regrade({ data: { assessmentId: id } }); toast.success('Detailed re-grade and final decision saved.'); await qc.invalidateQueries(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Re-grade failed'); }
    finally { setRegrading(null); }
  };
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<(typeof rows)[number] | null>(null);
  const [pair, setPair] = useState<{ before: string; after: string } | null>(null);
  const comparison = useQuery({ queryKey: ['peer-comparison', pair], enabled: pair !== null, queryFn: () => { if (!pair) throw new Error('Choose submissions'); return compare({ data: pair }); } });
  const allow = async () => {
    if (!window.confirm(`Allow one final peer-review upload for ${rows[0]?.profiles?.name}? Use this during your meeting.`)) return;
    setBusy(true);
    try { await authorize({ data: { studentId, teamId } }); toast.success('One final submission is now allowed in File Vault.'); await qc.invalidateQueries({ queryKey: ['peer-workspace'] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Could not allow upload'); }
    finally { setBusy(false); }
  };
  const difference = comparison.data?.before && comparison.data.after ? diffWords(comparison.data.before, comparison.data.after) : null;
  return <section className="border-t pt-5 space-y-5" aria-label="Student peer-review history">
    {latest && <PeerDiscussionPanel key={latest.id} assessment={latest} meetings={data.meetings} />}
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-display text-2xl">{rows[0]?.profiles?.name}</h2><p className="text-sm text-muted-foreground">{rows[0]?.teams?.display_name || rows[0]?.teams?.name} · Section {rows[0]?.teams?.section}</p></div><div className="flex flex-wrap gap-2"><Button disabled={busy || state !== 'locked' || !latest || (latest.score ?? 8) >= 8 || !!latest.accepted_at} onClick={allow}><Unlock className="h-4 w-4 mr-2" />{state === 'allowed' ? 'Final upload allowed' : state === 'used' ? 'Final upload used' : 'Allow final submission'}</Button><Button variant="outline" asChild><Link to="/app/vault" search={{ team: teamId, file: latest?.file_id ?? undefined }}>File Vault</Link></Button></div></div>
    <div className="grid gap-3 md:grid-cols-3">{rows.map(row => <article key={row.id} className="border rounded-md p-3 space-y-3 min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-medium">{row.final_submission ? 'Final submission' : `Submission ${row.attempt}`}</h3><Badge className={peerBadgeTone(peerBadgeScore(row), new Date(), row.attempt, row.accepted_at, row.policy_snapshot)}>{row.score === null ? row.status : `${peerBadgeScore(row)}/10`}</Badge></div><p className="text-xs text-muted-foreground">{new Date(row.file_versions?.uploaded_at ?? row.created_at).toLocaleString()}</p><p className="text-sm break-words">{row.files?.file_name ?? 'Source retained in audit history'}</p>{row.file_versions && <Button size="sm" variant="outline" onClick={() => setView(row)}><FileText className="h-4 w-4 mr-2" />Open submission {row.attempt}</Button>}{row.status === 'assessed' && (row.score === 7 || row.final_submission) && <Button size="sm" variant="secondary" disabled={regrading !== null} onClick={() => runRegrade(row.id)}>{regrading === row.id ? 'Re-grading…' : (row as any).detailed_regrade ? 'Re-grade again' : 'Re-grade after discussion'}</Button>}{(row as any).detailed_regrade && <RegradeDetail r={(row as any).detailed_regrade} accepted={!!row.accepted_at} final={row.final_submission && row.attempt === 4} />}{row.attempt === 3 && row.id !== latest?.id && <details><summary className="cursor-pointer text-sm text-primary">Meeting comment on submission 3</summary><PeerDiscussionPanel assessment={row} meetings={data.meetings} notesOnly /></details>}<details><summary className="cursor-pointer text-sm text-primary">Saved assessment and email copies</summary><div className="mt-2 space-y-2 text-sm"><p className="whitespace-pre-wrap">{row.email_body || row.summary}</p><p>Student: {row.student_email_status} · Instructor: {row.instructor_email_status} · PM: {row.pm_email_status}</p></div></details></article>)}</div>
    {latest && <div className="space-y-2"><h3 className="font-display text-xl">{latest.accepted_at ? 'Accepted after discussion — no further revision needed' : latest.discussion_resolved_at && latest.final_points_adjustment < 0 ? `Final review complete — ${latest.final_points_adjustment} personal project points` : (latest.score ?? 0) >= 8 ? '8/10 target achieved' : 'Why the latest submission is still below 8/10'}</h3><ul className="list-disc pl-5 space-y-1 text-sm">{!latest.accepted_at && !latest.discussion_resolved_at && peerPriorityFixes(latest.score, latest.changes).map((fix, i) => <li key={i}>{fix}</li>)}</ul></div>}
    <section className="space-y-3"><h3 className="font-display text-xl">Changes between submissions</h3><div className="flex flex-wrap gap-2">{assessed.map((row, i) => { const previous = assessed[i - 1]; if (!previous?.version_id || !row.version_id) return null; return <Button key={row.id} size="sm" variant={pair?.after === row.version_id ? 'default' : 'outline'} onClick={() => setPair({ before: previous.version_id as string, after: row.version_id as string })}>{previous.attempt} <ArrowRight className="h-3 w-3 mx-1" /> {row.attempt}</Button>; })}</div>{comparison.isFetching && <p role="status">Loading submitted text…</p>}{comparison.error && <p role="alert" className="text-destructive">{comparison.error.message}</p>}{difference && <><p className="text-xs text-muted-foreground">Added text is highlighted; removed text is crossed out. These are text changes, not proof that a concern was fixed.</p><div className="border rounded-md p-4 max-h-96 overflow-auto whitespace-pre-wrap text-sm leading-relaxed">{difference.map((part, i) => part.added ? <mark key={i} className="bg-success/20 text-foreground">{part.value}</mark> : part.removed ? <del key={i} className="bg-destructive/15 text-destructive">{part.value}</del> : <span key={i}>{part.value}</span>)}</div></>}{comparison.data && !difference && <p className="text-sm text-muted-foreground">Text comparison is unavailable for photographed pages or missing text. Open both submissions above and use their saved feedback; no changes have been inferred.</p>}</section>
    <FileViewerDialog open={view !== null} onOpenChange={open => { if (!open) setView(null); }} version={view?.file_versions ?? null} fileName={view?.files?.file_name ?? 'Peer review'} />
  </section>;
}
function RegradeDetail({ r, accepted, final }: { r: any; accepted: boolean; final: boolean }) {
  const tone = (x: string) => x === 'met' ? 'text-success' : x === 'partial' ? 'text-foreground' : 'text-destructive';
  return <div className="rounded-md bg-muted p-3 space-y-2 text-sm">
    <p className="font-medium">Detailed re-grade: {Number(r.precise_score).toFixed(1)}/10 · {accepted ? 'Accepted — complete' : final ? 'Below 7.6/10 — −10 personal project points' : r.gap_to_8 > 0 ? `${Number(r.gap_to_8).toFixed(1)} short of 8/10` : 'meets 8/10'}</p>
    <p className="text-xs text-muted-foreground">Official score stays {r.official_score}/10. Re-graded {new Date(r.regraded_at).toLocaleString()}.</p>
    <p>{r.verdict}</p>
    <details><summary className="cursor-pointer text-primary">Criterion by criterion</summary><ul className="mt-2 space-y-1">{r.criteria?.map((c: any, i: number) => <li key={i}><span className={`font-medium ${tone(c.rating)}`}>{c.rating}</span> — {c.criterion}: {c.evidence}</li>)}</ul></details>
    {!accepted && !final && r.to_reach_8?.length > 0 && <div><p className="font-medium">Still needed for 8/10</p><ul className="list-disc pl-5">{r.to_reach_8.map((t: string, i: number) => <li key={i}>{t}</li>)}</ul></div>}
  </div>;
}
