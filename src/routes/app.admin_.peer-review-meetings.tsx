import { createFileRoute, Navigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getPeerWorkspace, syncPeerMeetings } from '@/lib/peer-review-workspace.functions';
import { PeerReviewStudentWorkspace } from '@/components/peer-review-student-workspace';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CalendarClock, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { peerBadgeScore, peerBadgeTone } from '@/lib/peer-review-policy';
import { nextDetroitCalendarCheck } from '@/lib/peer-calendar-policy';

export const Route = createFileRoute('/app/admin_/peer-review-meetings')({
  head: () => ({ meta: [
    { title: 'Peer Reviews — ClientVault Admin' },
    { name: 'description', content: 'Student peer-review meetings, submission histories, scores, changes and instructor-authorized final uploads.' },
    { property: 'og:title', content: 'Peer Reviews — ClientVault Admin' },
    { property: 'og:description', content: 'Instructor peer-review meetings and exact student submission progress.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }), component: Page,
});
function easternDateTime(iso: string) {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'America/Detroit', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(iso));
}
function calendarChangeDescription(details: unknown) {
  const d = details as { change?: string; before?: { scheduled_at?: string; zoom_url?: string; booking_topic?: string }; after?: { scheduled_at?: string; zoom_url?: string; booking_topic?: string }; message?: string } | null;
  const before = d?.before?.scheduled_at;
  const after = d?.after?.scheduled_at;
  if (before && after && new Date(before).getTime() === new Date(after).getTime()) {
    const fields = [d?.before?.zoom_url !== d?.after?.zoom_url ? 'Zoom link updated' : '', d?.before?.booking_topic !== d?.after?.booking_topic ? `Topic: ${d?.after?.booking_topic || 'Not specified'}` : ''].filter(Boolean);
    return `${d?.change || 'Booking changed'} · ${fields.join(' · ')}`;
  }
  return `${d?.change || d?.message || 'Calendar checked'}${before ? ` · ${easternDateTime(before)}` : ''}${after ? ` → ${easternDateTime(after)}` : ''}`;
}
function Page() {
  const { isAdmin, loading } = useAuth();
  const fetch = useServerFn(getPeerWorkspace);
  const sync = useServerFn(syncPeerMeetings);
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['peer-workspace'], queryFn: () => fetch(), enabled: isAdmin, refetchInterval: 30000 });
  const [selected, setSelected] = useState<{ studentId: string; teamId: string } | null>(null);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'upcoming' | 'past' | 'students'>('upcoming');
  const [busy, setBusy] = useState(false);
  if (loading) return null;
  if (!isAdmin) return <Navigate to="/app/dashboard" />;
  const refresh = async () => {
    setBusy(true);
    try { const result = await sync(); toast.success(`${result.imported} calendar bookings checked and saved.${result.unmatched.length ? ` ${result.unmatched.length} unmatched bookings were not imported.` : ''}`); await qc.invalidateQueries({ queryKey: ['peer-workspace'] }); await qc.invalidateQueries({ queryKey: ['upcoming-peer-meetings'] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Calendar sync failed'); }
    finally { setBusy(false); }
  };
  // A meeting stays "upcoming" until 2 hours after its start, so it remains visible during and just after the call.
  const twoHours = 2 * 60 * 60 * 1000;
  const meetings = (query.data?.meetings ?? []).filter(m => tab === 'past' ? new Date(m.scheduled_at).getTime() + twoHours < Date.now() : new Date(m.scheduled_at).getTime() + twoHours >= Date.now());
  const students = Array.from(new Map((query.data?.assessments ?? []).filter(a => a.status === 'assessed').map(a => [`${a.team_id}:${a.user_id}`, a])).values()).filter(a => a.profiles?.name.toLowerCase().includes(search.toLowerCase())).sort((a,b) => (a.profiles?.name ?? '').localeCompare(b.profiles?.name ?? ''));
  return <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><h1 className="font-display text-3xl flex items-center gap-2"><CalendarClock className="h-6 w-6 text-gold" />Peer Reviews</h1><Button variant="outline" disabled={busy} onClick={refresh}><RefreshCw className="h-4 w-4 mr-2" />{busy ? 'Checking calendar…' : 'Sync Calendly'}</Button></header>
    {query.error && <p role="alert" className="text-destructive">{query.error.message}</p>}
    <details className="border-y py-3">
      <summary className="cursor-pointer text-sm font-medium">Calendar changes & daily checks</summary>
      <p className="text-sm text-muted-foreground py-2">Daily check: 1:00 a.m. Detroit time · Next: {easternDateTime(nextDetroitCalendarCheck(new Date()).toISOString())}</p>
      <div className="divide-y">{(query.data?.calendarLog ?? []).map(entry => <div key={entry.id} className="py-2 text-sm"><span className="font-medium">{entry.archive_name}</span><p>{calendarChangeDescription(entry.details)}</p><p className="text-xs text-muted-foreground">{easternDateTime(entry.created_at)}</p></div>)}</div>
    </details>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Peer review views">{(['upcoming', 'past', 'students'] as const).map(t => <Button key={t} size="sm" variant={tab === t ? 'default' : 'outline'} onClick={() => setTab(t)}>{t === 'upcoming' ? 'Upcoming meetings' : t === 'past' ? 'Past scheduled meetings' : 'All students'}</Button>)}</div>
    {tab === 'students' ? <><Input aria-label="Search students" placeholder="Search student name" value={search} onChange={e => setSearch(e.target.value)} /><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">{students.map(a => <Button key={`${a.user_id}-${a.team_id}`} variant="outline" className="h-auto min-h-14 justify-between whitespace-normal text-left" onClick={() => setSelected({ studentId: a.user_id, teamId: a.team_id })}><span>{a.profiles?.name}<span className="block text-xs text-muted-foreground">{a.teams?.display_name || a.teams?.name} · Section {a.teams?.section}</span></span><Badge className={`shrink-0 ml-2 ${peerBadgeTone(peerBadgeScore(a), undefined, a.attempt, a.accepted_at, a.policy_snapshot)}`}>{peerBadgeScore(a)}/10</Badge></Button>)}</div></> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Student</th><th className="p-2">Team</th><th className="p-2">When</th><th className="p-2">Booking topic</th><th className="p-2">Zoom</th></tr></thead><tbody>{meetings.map(m => <tr key={m.id} className="border-b align-top"><td className="p-2"><Button variant="link" className="p-0 h-auto text-left whitespace-normal" onClick={() => m.team_id && setSelected({ studentId: m.student_id, teamId: m.team_id })}>{m.profiles?.name}</Button>{m.identity_match !== 'email' && <p className="text-xs text-muted-foreground">Matched by full name; calendar email differs</p>}</td><td className="p-2">{m.teams?.display_name || m.teams?.name} · {m.teams?.section}</td><td className="p-2 whitespace-nowrap">{easternDateTime(m.scheduled_at)}</td><td className="p-2 max-w-sm">{m.booking_topic || 'Peer-review meeting'}</td><td className="p-2">{m.zoom_url ? <a href={m.zoom_url} target="_blank" rel="noreferrer" className="text-primary underline">Join Zoom</a> : 'In calendar invite'}</td></tr>)}</tbody></table>{meetings.length === 0 && <p className="py-4 text-sm text-muted-foreground">No meetings in this view.</p>}</div>}
    {selected && query.data && <PeerReviewStudentWorkspace key={`${selected.studentId}-${selected.teamId}`} data={query.data} {...selected} />}
  </main>;
}
