import { createFileRoute, Navigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getPeerReviewCriteria, savePeerReviewCriteria } from '@/lib/peer-review-criteria.functions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, Check } from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/app/admin_/peer-review-criteria')({
  head: () => ({ meta: [
    { title: 'Peer Review Criteria — ClientVault Admin' },
    { name: 'description', content: 'Instructor-editable peer-review evaluation criteria and annual review reminder.' },
    { property: 'og:title', content: 'Peer Review Criteria — ClientVault Admin' },
    { property: 'og:description', content: 'Review and maintain the instructor’s peer-review evaluation criteria.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary' },
  ] }),
  component: CriteriaPage,
});

function CriteriaPage() {
  const { isAdmin, loading } = useAuth();
  const get = useServerFn(getPeerReviewCriteria);
  const { data, error } = useQuery({ queryKey: ['peer-review-criteria'], queryFn: () => get({}), enabled: isAdmin });
  if (loading) return null;
  if (!isAdmin) return <Navigate to="/app/dashboard" />;
  return <div className="p-4 sm:p-8 max-w-6xl mx-auto">
    <h1 className="font-display text-3xl mb-2">Peer Review Evaluation Criteria</h1>
    {error && <p role="alert" className="text-destructive">{error.message}</p>}
    {data ? <CriteriaEditor key={data.updated_at} document={data} /> : !error && <p>Loading criteria…</p>}
  </div>;
}

function CriteriaEditor({ document }: { document: Awaited<ReturnType<typeof getPeerReviewCriteria>> }) {
  const [content, setContent] = useState(document.content);
  const [reminder, setReminder] = useState(document.reminder_month_day);
  const save = useServerFn(savePeerReviewCriteria);
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (markReviewed: boolean) => save({ data: { content, reminder_month_day: reminder, expected_updated_at: document.updated_at, markReviewed } }),
    onSuccess: (saved) => {
      qc.setQueryData(['peer-review-criteria'], saved);
      toast.success(saved.reviewed_year ? `Saved and reviewed for ${saved.reviewed_year}` : 'Criteria saved');
    },
  });
  return <section className="space-y-4">
    <p className="text-sm text-muted-foreground">{document.reviewed_year ? `Reviewed for ${document.reviewed_year}.` : 'Yearly review not yet confirmed.'} Last saved {new Date(document.updated_at).toLocaleString()}.</p>
    <Label htmlFor="criteria-document">Criteria and instructor notes</Label>
    <Textarea id="criteria-document" value={content} onChange={e => setContent(e.target.value)} className="min-h-[600px] text-sm leading-relaxed" />
    <div className="flex flex-wrap items-end gap-4">
      <div className="space-y-1">
        <Label htmlFor="criteria-reminder-date">Annual reminder starts (MM-DD)</Label>
        <Input id="criteria-reminder-date" value={reminder} onChange={e => setReminder(e.target.value)} className="w-28" maxLength={5} />
      </div>
      <Button disabled={mutation.isPending || !content.trim()} onClick={() => mutation.mutate(false)}><Save className="h-4 w-4 mr-2" />Save changes</Button>
      <Button variant="outline" disabled={mutation.isPending || !content.trim()} onClick={() => mutation.mutate(true)}><Check className="h-4 w-4 mr-2" />Save & mark reviewed for this year</Button>
    </div>
    {mutation.error && <p role="alert" className="text-destructive">{mutation.error.message}</p>}
  </section>;
}