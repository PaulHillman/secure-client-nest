import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { getReviewRulebook, saveReviewRulebook } from '@/lib/review-rulebook.functions';
import { OPERATIONAL_DEFAULTS, operationalSchema, rulebookEffects, type OperationalRules, resolveOperationalRules } from '@/lib/review-rulebook';
import { runTeamHealthReview } from '@/lib/team-health-review.functions';
import { type GuideImpact } from '@/lib/health-review-guide-impact.functions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, FlaskConical, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
export const RULEBOOK_KEY = ['review-rulebook'];
type Loaded = Awaited<ReturnType<typeof getReviewRulebook>>;
const fields: { key: keyof OperationalRules; label: string; type: 'number' | 'date'; min?: number; max?: number; step?: number }[] = [
  { key: 'original_pass', label: 'Original passing score', type: 'number', min: 1, max: 10 },
  { key: 'revision_pass', label: 'Revision target', type: 'number', min: 1, max: 10 },
  { key: 'max_submissions', label: 'Submissions before a meeting is required', type: 'number', min: 2, max: 6 },
  { key: 'original_due', label: 'Original due Sunday', type: 'date' },
  { key: 'revision_due', label: 'Revision or booking due Sunday', type: 'date' },
  { key: 'meeting_due', label: 'Meeting completed by Sunday', type: 'date' },
  { key: 'final_pass', label: 'Final discussion passing score', type: 'number', min: 0, max: 10, step: 0.1 },
  { key: 'final_deduction', label: 'Personal project points below final threshold', type: 'number', min: -100, max: 0 },
];
export function ReviewRulebookEditor() {
  const get = useServerFn(getReviewRulebook);
  const query = useQuery({ queryKey: RULEBOOK_KEY, queryFn: () => get() });
  if (query.error) return <p role="alert" className="text-destructive">{query.error.message}</p>;
  if (!query.data) return <p>Loading rulebook…</p>;
  return <RulebookForm key={query.data.updatedAt} loaded={query.data} />;
}
function RulebookForm({ loaded }: { loaded: Loaded }) {
  const [draft, setDraft] = useState(loaded.operational);
  const [reviewing, setReviewing] = useState(false);
  const [team, setTeam] = useState(loaded.teams[0]?.id ?? '');
  const save = useServerFn(saveReviewRulebook);
  const run = useServerFn(runTeamHealthReview);
  const qc = useQueryClient();
  const mutation = useMutation({ mutationFn: () => save({ data: { operational: operationalSchema.parse(draft), thresholds: loaded.thresholds, expectedUpdatedAt: loaded.updatedAt } }), onSuccess: async () => { toast.success('Rules applied to future reviews and new submissions.'); await qc.invalidateQueries(); } });
  const trial = useMutation({ mutationFn: () => run({ data: { scope: 'team', teamId: team, trialRules: { operational: operationalSchema.parse(draft), thresholds: loaded.thresholds } } }) });
  const set = <K extends keyof OperationalRules>(key: K, value: OperationalRules[K]) => { setReviewing(false); setDraft(d => ({ ...d, [key]: value })); };
  const parsed = operationalSchema.safeParse(draft);
  const effects = rulebookEffects(loaded.operational, draft);
  return <section className="border-y py-6 mb-6 space-y-6" aria-label="Editable review rulebook">
    <h2 className="font-display text-2xl">Peer reviews & evidence rules</h2>
    <fieldset className="space-y-3"><legend className="font-semibold">Peer-review scores, deadlines & final submissions</legend><div className="grid sm:grid-cols-2 gap-4">{fields.map(f => <div key={f.key} className="space-y-1"><Label htmlFor={`book-${f.key}`}>{f.label}</Label><Input id={`book-${f.key}`} type={f.type} value={String(draft[f.key])} min={f.min} max={f.max} step={f.step ?? 1} onChange={e => set(f.key, (f.type === 'number' ? Number(e.target.value) : e.target.value) as never)} /></div>)}</div><p className="text-xs text-muted-foreground">All deadlines: Sunday, 11:59 p.m. Detroit time. Existing scores, decisions and emailed instructions retain their original rules.</p></fieldset>
    <fieldset className="space-y-3"><legend className="font-semibold">Weekly peer-review summaries</legend><Label htmlFor="book-summary">Summary length</Label><Select value={draft.summary_mode} onValueChange={v => set('summary_mode', v as OperationalRules['summary_mode'])}><SelectTrigger id="book-summary"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="brief">Score and next step only</SelectItem><SelectItem value="with_fixes">Score, next step and saved priority fixes</SelectItem></SelectContent></Select><Label htmlFor="book-fixes">Maximum saved fixes in weekly summary</Label><Input id="book-fixes" type="number" min={1} max={3} value={draft.summary_fixes} onChange={e => set('summary_fixes', Number(e.target.value))} /><div className="flex gap-2 items-center"><Checkbox id="book-warning" checked={draft.missing_meeting_warning} onCheckedChange={v => set('missing_meeting_warning', v === true)} /><Label htmlFor="book-warning">Explicitly call out a missing required meeting booking</Label></div></fieldset>
    <fieldset className="space-y-3"><legend className="font-semibold">Required client research topics</legend>{draft.research_topics.map((t, i) => <div key={i} className="grid sm:grid-cols-[1fr_2fr_auto] gap-2 border-b pb-3"><div><Label htmlFor={`topic-${i}`}>Topic {i + 1}</Label><Input id={`topic-${i}`} value={t.topic} onChange={e => set('research_topics', draft.research_topics.map((v, n) => n === i ? { ...v, topic: e.target.value } : v))} /></div><div><Label htmlFor={`phrases-${i}`}>Evidence phrases, separated by commas</Label><Input id={`phrases-${i}`} value={t.keywords.join(', ')} onChange={e => set('research_topics', draft.research_topics.map((v, n) => n === i ? { ...v, keywords: e.target.value.split(',').map(s => s.trim()) } : v))} /></div><Button size="icon" variant="ghost" aria-label={`Remove topic ${i + 1}`} title="Remove topic" onClick={() => set('research_topics', draft.research_topics.filter((_, n) => i !== n))}><Trash2 className="h-4 w-4" /></Button></div>)}<Button variant="outline" size="sm" onClick={() => set('research_topics', [...draft.research_topics, { topic: '', keywords: [''] }])}><Plus className="h-4 w-4 mr-2" />Add research topic</Button></fieldset>
    <div className="space-y-2"><Label htmlFor="book-markers">Minutes-template section labels — one per line</Label><Textarea id="book-markers" value={draft.minutes_markers.join('\n')} onChange={e => set('minutes_markers', e.target.value.split('\n'))} rows={7} /></div>
    {!parsed.success && <p role="alert" className="text-destructive text-sm">{parsed.error.issues.map(i => i.message).join(' ')}</p>}
    <div className="flex gap-3 flex-wrap"><Button disabled={!effects.length || !parsed.success || mutation.isPending} onClick={() => setReviewing(true)}><Save className="h-4 w-4 mr-2" />Review rule changes</Button></div>
    {reviewing && <div className="border-l-4 border-primary pl-4 space-y-3"><h3 className="font-semibold">Effect of these changes</h3><ul className="list-disc pl-5 text-sm space-y-2">{effects.map(e => <li key={e}>{e}</li>)}</ul><p className="text-sm">Effective when applied. Past reports and grades are not rewritten.</p><Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>Apply rule changes</Button></div>}
    {mutation.error && <p role="alert" className="text-destructive">{mutation.error.message}</p>}
    <details className="border-t pt-4">
      <summary className="font-semibold cursor-pointer">Preview changes before applying</summary>
      <div className="space-y-4 pt-4">
        <div className="flex gap-3 flex-wrap"><Select value={team} onValueChange={setTeam}><SelectTrigger className="w-full sm:w-72" aria-label="Trial review team"><SelectValue /></SelectTrigger><SelectContent>{loaded.teams.map(t => <SelectItem value={t.id} key={t.id}>{t.display_name || t.name} · {t.section}</SelectItem>)}</SelectContent></Select><Button variant="outline" disabled={!team || !parsed.success || trial.isPending} onClick={() => trial.mutate()}><FlaskConical className="h-4 w-4 mr-2" />{trial.isPending ? 'Running trial…' : 'Trial review — no save or email'}</Button></div>
    {trial.error && <p role="alert" className="text-destructive">{trial.error.message}</p>}
    {trial.data && <div aria-live="polite" className="border-t pt-4 space-y-2"><h3 className="font-semibold">Trial results — not saved or emailed</h3><p>{trial.data.teamsChecked} team · {trial.data.exceptions.filter(e => e.level === 'red').length} Bad · {trial.data.exceptions.filter(e => e.level === 'yellow').length} Fair</p><ul className="list-disc pl-5 space-y-1 text-sm">{trial.data.exceptions.map((e, i) => <li key={i}>{e.person ? `${e.person}: ` : ''}{e.reason}</li>)}</ul><details><summary>Passed checks</summary>{trial.data.teamResults.map(t => <ul key={t.teamId} className="list-disc pl-5 text-sm">{Object.values(t.passNotes).flat().map((n, i) => <li key={i}>{n}</li>)}</ul>)}</details></div>}
      </div>
    </details>
    <details><summary className="font-semibold cursor-pointer">Rule change history ({loaded.history.length})</summary><div className="divide-y">{loaded.history.map(h => <div key={h.id} className="py-3 text-sm"><p>{new Date(h.effective_at).toLocaleString('en-US', { timeZone: 'America/Detroit' })} Detroit · {h.actorName}</p><ul className="list-disc pl-5">{historyChanges(h.before_rules, h.after_rules).map((s, i) => <li key={i}>{s}</li>)}</ul></div>)}{!loaded.history.length && <p className="text-sm py-2">No rule changes recorded yet.</p>}</div></details>
    <p className="text-xs text-muted-foreground">Protected: privacy, instructor and PM copies, retained submission history, verified ownership, unreadable-evidence safeguards, and one-use final-upload permission.</p>
  </section>;
}
function historyChanges(before: unknown, after: unknown) {
  const b = before as Record<string, unknown> | null; const a = after as Record<string, unknown> | null;
  if (!a) return [];
  const labels: Record<string, string> = { operational_rules: 'Peer-review and evidence rules', disabled_checks: 'Disabled checks' };
  return Object.keys(a).filter(k => !['updated_at', 'updated_by', 'id'].includes(k) && JSON.stringify(b?.[k]) !== JSON.stringify(a[k])).map(k => `${labels[k] ?? k.replaceAll('_', ' ')}: ${JSON.stringify(b?.[k])} → ${JSON.stringify(a[k])}`);
}
export function ApplyGuideProposal({ impact }: { impact: GuideImpact }) {
  const get = useServerFn(getReviewRulebook); const save = useServerFn(saveReviewRulebook); const qc = useQueryClient();
  const query = useQuery({ queryKey: RULEBOOK_KEY, queryFn: () => get() });
  const [applied, setApplied] = useState(false);
  const mutation = useMutation({ mutationFn: async () => {
    const current = query.data; if (!current) throw new Error('Wait for the current rules to load.');
    if (current.updatedAt !== impact.expectedUpdatedAt) throw new Error('Rules changed since this proposal was checked. Check the narrative again before applying.');
    const operational: Record<string, unknown> = { ...current.operational }; const thresholds: Record<string, number | string> = { ...current.thresholds };
    for (const c of impact.settings_to_change) { const value = JSON.parse(c.value_json); if (c.key in OPERATIONAL_DEFAULTS) operational[c.key] = value; else if (c.key in thresholds && (typeof value === 'number' || typeof value === 'string')) thresholds[c.key] = value; else throw new Error('This suggestion cannot be applied safely.'); }
    return save({ data: { operational: operationalSchema.parse(operational), thresholds, expectedUpdatedAt: current.updatedAt } });
  }, onSuccess: async () => { setApplied(true); toast.success('Proposed rules applied.'); await qc.invalidateQueries(); } });
  if (impact.verdict !== 'settings_change' || !impact.settings_to_change.length) return null;
  return <div className="space-y-2"><Button disabled={applied || mutation.isPending || !query.data} onClick={() => mutation.mutate()}>{applied ? 'Proposed changes applied' : 'Apply proposed changes'}</Button><Button variant="outline" onClick={() => toast.success('Wording saved; active rules unchanged.')} disabled={applied}>Keep wording only</Button>{mutation.error && <p role="alert" className="text-destructive">{mutation.error.message}</p>}</div>;
}