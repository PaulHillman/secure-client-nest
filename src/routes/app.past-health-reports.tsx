import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FileText, HeartPulse } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { FileViewerDialog } from "@/components/file-viewer-dialog";
import { newestHealthReports, isCurrentHealthWeek, type StudentHealthReport } from "@/lib/student-health-history";

export const Route = createFileRoute("/app/past-health-reports")({
  head: () => ({ meta: [
    { title: "Past Health Reports · ClientVault" },
    { name: "description", content: "Your team's current and previous shared Health Reports, newest first." },
    { property: "og:title", content: "Past Health Reports · ClientVault" },
    { property: "og:description", content: "Review your team's weekly Good, Fair and Bad summaries and received reports." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: PastHealthReports,
});

function PastHealthReports() {
  const { user } = useAuth();
  const [selected, setSelected] = useState<StudentHealthReport | null>(null);
  const { data: reports, isPending, error, refetch } = useQuery({
    queryKey: ["student-health-history", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.rpc("student_health_report_history", { _student_id: user.id });
      if (error) throw error;
      return newestHealthReports(data ?? []);
    },
  });
  const now = new Date().toISOString();
  return (
    <section className="mx-auto max-w-5xl p-4 sm:p-8">
      <header className="mb-6 flex items-center gap-3">
        <HeartPulse className="h-7 w-7 shrink-0 text-gold" />
        <h1 className="font-display text-3xl">Past Health Reports</h1>
      </header>
      {isPending ? <p className="text-sm text-muted-foreground">Loading your reports…</p> : error ? (
        <div className="space-y-3"><p className="text-sm text-destructive">Your reports could not be loaded right now.</p><Button variant="outline" onClick={() => void refetch()}>Try again</Button></div>
      ) : !reports?.length ? <p className="text-sm text-muted-foreground">No Health Reports have been shared with your team yet.</p> : (
        <div className="divide-y divide-border border-y border-border">
          {reports.map(report => (
            <article key={report.id} className="flex flex-wrap items-center justify-between gap-4 py-5">
              <div className="min-w-0 basis-full sm:basis-auto sm:flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h2 className="font-semibold">{new Date(report.generated_at).toLocaleDateString("en-US", { timeZone: "America/Detroit", month: "long", day: "numeric", year: "numeric" })}</h2>
                  {isCurrentHealthWeek(report, now) && <span className="text-xs font-medium text-primary">This week</span>}
                </div>
                <p className="mt-1 break-words text-sm text-muted-foreground">{report.team_label}</p>
              </div>
              <dl className="grid grid-cols-3 gap-5 text-center text-sm">
                <div><dt className="text-success">Good</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{report.good}</dd></div>
                <div><dt className="text-gold">Fair</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{report.fair}</dd></div>
                <div><dt className="text-destructive">Bad</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{report.bad}</dd></div>
              </dl>
              {report.vault_version_id ? <Button variant="outline" size="sm" onClick={() => setSelected(report)}><FileText className="mr-2 h-4 w-4" />Open report</Button> : <span className="text-xs text-muted-foreground">Historical PDF not retained</span>}
            </article>
          ))}
        </div>
      )}
      <FileViewerDialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}
        version={selected?.vault_version_id ? { id: selected.vault_version_id, storage_path: "", mime_type: "application/pdf" } : null}
        fileName={`Team Health Review ${selected?.generated_at.slice(0, 10) ?? ""}.pdf`} />
    </section>
  );
}