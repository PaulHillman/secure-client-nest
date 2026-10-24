import { createFileRoute, Navigate, Link } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getHealthReviewGuide, saveHealthReviewGuide } from '@/lib/health-review-guide.functions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Save, Check } from 'lucide-react';
import { toast } from 'sonner';

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
    <p className="text-sm text-muted-foreground mb-4">The settings below are the numbers the <Link to="/app/health-review" search={{ report: undefined }} className="text-primary underline">Team Health Review</Link> applies — saving one here changes what the next report checks. The document underneath records those rules in words and is not what the review reads.</p>
    {error && <p role="alert" className="text-destructive">{error.message}</p>}
    <HealthReviewRulesEditor />
    {data ? <GuideEditor key={data.updated_at} document={data} /> : !error && <p>Loading…</p>}
  </div>;
}

function GuideEditor({ document }: { document: Awaited<ReturnType<typeof getHealthReviewGuide>> }) {
  const [content, setContent] = useState(document.content);
  const save = useServerFn(saveHealthReviewGuide);
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (markReviewed: boolean) => save({ data: { content, expected_updated_at: document.updated_at, markReviewed } }),
    onSuccess: (saved, markReviewed) => {
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
    {mutation.error && <p role="alert" className="text-destructive">{mutation.error.message}</p>}
  </section>;
}
