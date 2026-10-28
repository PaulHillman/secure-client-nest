import { createFileRoute, Link, Navigate } from '@tanstack/react-router';
import { useAuth } from '@/lib/auth-context';
import { competitionGradingReferences } from '@/lib/competition-grading-references';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, BookOpen } from 'lucide-react';

export const Route = createFileRoute('/app/admin_/competition-grading')({
  head: () => ({ meta: [
    { title: 'Competition Grading References — ClientVault Admin' },
    { name: 'description', content: 'Instructor historical grading references for Competitions 1, 2 and 3.' },
    { property: 'og:title', content: 'Competition Grading References — ClientVault Admin' },
    { property: 'og:description', content: 'Historical competition rubrics, grading safeguards and instructor decisions.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary' },
  ] }),
  component: CompetitionGradingPage,
});

function CompetitionGradingPage() {
  const { isAdmin, loading } = useAuth();
  if (loading) return null;
  if (!isAdmin) return <Navigate to="/app/dashboard" />;
  return <div className="mx-auto max-w-5xl p-4 sm:p-8">
    <Button asChild variant="ghost" size="sm" className="mb-4"><Link to="/app/admin"><ArrowLeft className="mr-2 h-4 w-4" />Admin</Link></Button>
    <h1 className="font-display text-3xl mb-3">Competition Grading References</h1>
    <p className="text-sm text-muted-foreground mb-6">Historical references only. Confirm the current semester’s assignment, rubric, deadlines and instructor decisions before grading. These references do not change peer-review or Health Review rules.</p>
    <Tabs defaultValue="2">
      <TabsList className="flex w-full sm:w-fit">
        {competitionGradingReferences.map(reference => <TabsTrigger key={reference.number} value={reference.number} className="flex-1">Competition {reference.number}</TabsTrigger>)}
      </TabsList>
      {competitionGradingReferences.map(reference => <TabsContent key={reference.number} value={reference.number} className="mt-6">
        <header className="flex flex-wrap items-center gap-3 mb-6">
          <BookOpen className="h-5 w-5 text-gold" />
          <h2 className="font-display text-2xl">{reference.title}</h2>
          <Badge variant="secondary">{reference.sections.length ? 'Historical reference' : 'Not yet provided'}</Badge>
        </header>
        {reference.sections.length ? <div className="space-y-6">
          {reference.sections.map(section => <section key={section.title} className="border-t border-border pt-5">
            <h3 className="font-semibold mb-2">{section.title}</h3>
            <p className="whitespace-pre-line text-sm leading-7">{section.text}</p>
          </section>)}
        </div> : <p className="text-sm text-muted-foreground">No Competition {reference.number} assignment or grading reference has been provided yet.</p>}
      </TabsContent>)}
    </Tabs>
  </div>;
}