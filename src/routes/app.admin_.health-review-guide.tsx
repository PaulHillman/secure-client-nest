import { HealthCheckSwitchesEditor } from "@/components/health-check-switches";
import { createFileRoute, Navigate, Link } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getHealthReviewGuide, saveHealthReviewGuide } from '@/lib/health-review-guide.functions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { reviewHealthGuideChange, type GuideImpact } from '@/lib/health-review-guide-impact.functions';
import { HealthReviewRulesEditor } from '@/components/health-review-rules-editor';
import { Save, Check } from 'lucide-react';
import { toast } from 'sonner';
import { ReviewRulebookEditor, ApplyGuideProposal } from '@/components/review-rulebook-editor';

export const Route = createFileRoute('/app/admin_/health-review-guide')({
  head: () => ({ meta: [
    { title: 'Weekly Health Check Review — ClientVault Admin' },
    { name: 'description', content: 'Instructor document describing what the weekly Team Health Review checks.' },
    { property: 'og:title', content: 'Weekly Health Check Review — ClientVault Admin' },
    { property: 'og:description', content: 'Weekly-updated record of the Health Review rules in use.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary' },
  ] }),
  component: GuidePage,
});

export const HEALTH_GUIDE_KEY = ['health-review-guide'];

function GuidePage() {
  const { isAdmin, loading } = useAuth();
  const get = useServerFn(getHealthReviewGuide);
  const { data, error } = useQuery({ queryKey: HEALTH_GUIDE_KEY, queryFn: () => get({}), enabled: isAdmin });
  if (loading) return null;
  if (!isAdmin) return <Navigate to="/app/dashboard" />;
  return <div className="p-4 sm:p-8 max-w-6xl mx-auto">
    <h1 className="font-display text-3xl mb-2">Weekly Health Check Review</h1>
    <p className="text-sm text-muted-foreground mb-4">Review rules for the <Link to="/app/health-review" search={{ report: undefined }} className="text-primary underline">Team Health Review</Link> and new peer-review submissions. Narrative edits produce suggestions for your approval; they never silently change rules.</p>
    {error && <p role="alert" className="text-destructive">{error.message}</p>}
    <HealthReviewRulesEditor />
    <ReviewRulebookEditor />
      <HealthCheckSwitchesEditor />
    {data ? <GuideEditor key={data.id} document={data} /> : !error && <p>Loading…</p>}
  </div>;
}

function GuideEditor({ document }: { document: Awaited<ReturnType<typeof getHealthReviewGuide>> }) {
  const [content, setContent] = useState(document.content);
  const save = useServerFn(saveHealthReviewGuide);
  const qc = useQueryClient();
  const check = useServerFn(reviewHealthGuideChange);
  const impact = useMutation({ mutationFn: (v: { before: string; after: string }) => check({ data: v }) });
  const [lastPair, setLastPair] = useState<{ before: string; after: string } | null>(null);
  const mutation = useMutation({
    mutationFn: (markReviewed: boolean) => save({ data: { content, expected_updated_at: document.updated_at, markReviewed } }),
    onSuccess: (saved, markReviewed) => {
      if (document.content !== saved.content) {
        const pair = { before: document.content, after: saved.content };
        setLastPair(pair);
        impact.mutate(pair);
      }
      qc.setQueryData(HEALTH_GUIDE_KEY, saved);
      toast.success(markReviewed ? 'Saved and marked reviewed for this week' : 'Document saved');
    },
  });
  return <section className="space-y-4">
    <p className="text-sm text-muted-foreground">
      {document.reviewed_at ? `Last reviewed ${new Date(document.reviewed_at).toLocaleDateString()}.` : 'Not yet reviewed this week.'} Last saved {new Date(document.updated_at).toLocaleString()}.
    </p>
    <Label htmlFor="health-guide">Rules, schedule and weekly change log</Label>
    <Textarea id="health-guide" value={content} onChange={e => setContent(e.target.value)} className="min-h-[600px] text-sm leading-relaxed" />
    <div className="flex flex-wrap gap-3">
      <Button disabled={mutation.isPending || !content.trim()} onClick={() => mutation.mutate(false)}><Save className="h-4 w-4 mr-2" />Save changes</Button>
      <Button variant="outline" disabled={mutation.isPending || !content.trim()} onClick={() => mutation.mutate(true)}><Check className="h-4 w-4 mr-2" />Save & mark reviewed this week</Button>
    </div>
    {lastPair && <ImpactPanel impact={impact} onRetry={() => impact.mutate(lastPair)} />}
    {mutation.error && <p role="alert" className="text-destructive">{mutation.error.message}</p>}
  </section>;
}

const VERDICT: Record<GuideImpact['verdict'], string> = {
  no_rule_change: 'No rule change needed — wording only, or already matches the settings',
  settings_change: 'Proposed rule changes — review the effects before applying',
  needs_code_change: 'Cannot be done with the settings — needs a new or changed check',
  conflict: 'Conflicts with current settings or other rules',
};

function ImpactPanel({ impact, onRetry }: { impact: { isPending: boolean; error: Error | null; data?: GuideImpact }; onRetry: () => void }) {
  return <section aria-live="polite" className="rounded-md border border-border bg-muted/40 p-4 space-y-3 text-sm">
    <h2 className="font-display text-lg">Check of your change</h2>
    {impact.isPending && <p>Checking your change against the rules the report runs…</p>}
    {impact.error && <p role="alert" className="text-destructive">{impact.error.message} <Button size="sm" variant="outline" onClick={onRetry}>Check again</Button></p>}
    {impact.data && <>
      <p className="font-medium">{VERDICT[impact.data.verdict]}</p>
      <p>{impact.data.summary}</p>
      {impact.data.settings_to_change.length > 0 && <div><p className="font-medium">Settings to change</p><ul className="list-disc pl-5">{impact.data.settings_to_change.map((s, i) => <li key={i}>{s.setting}: {s.current} → {s.suggested}</li>)}</ul></div>}
      {impact.data.positives.length > 0 && <div><p className="font-medium">Likely positive effects</p><ul className="list-disc pl-5">{impact.data.positives.map((s, i) => <li key={i}>{s}</li>)}</ul></div>}
      {impact.data.negatives.length > 0 && <div><p className="font-medium">Likely negative effects</p><ul className="list-disc pl-5">{impact.data.negatives.map((s, i) => <li key={i}>{s}</li>)}</ul></div>}
      {impact.data.other_checks_affected.length > 0 && <div><p className="font-medium">Other checks affected</p><ul className="list-disc pl-5">{impact.data.other_checks_affected.map((s, i) => <li key={i}>{s}</li>)}</ul></div>}
      <ApplyGuideProposal key={JSON.stringify(impact.data.settings_to_change)} impact={impact.data} />
    </>}
  </section>;
}
