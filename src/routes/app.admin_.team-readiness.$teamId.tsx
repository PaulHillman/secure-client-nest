import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { getTeamReadinessAssessment } from "@/lib/team-readiness-assessment.functions";
import { TeamReadinessReport } from "@/components/team-readiness-report";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Printer, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/app/admin_/team-readiness/$teamId")({
  head: () => ({
    meta: [
      { title: "Team readiness report — ClientVault" },
      {
        name: "description",
        content: "The full pre-kickoff readiness report for one consulting team, with every reason behind its status.",
      },
      { property: "og:title", content: "Team readiness report — ClientVault" },
      {
        property: "og:description",
        content: "The full pre-kickoff readiness report for one consulting team, with every reason behind its status.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TeamReadinessDetail,
});

function TeamReadinessDetail() {
  const { teamId } = Route.useParams();
  const { isAdmin, loading } = useAuth();
  const fetchOne = useServerFn(getTeamReadinessAssessment);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["team-readiness-assessment", teamId],
    queryFn: () => fetchOne({ data: { teamId } }),
    enabled: isAdmin,
  });

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/app/dashboard" />;

  return (
    <div className="mx-auto max-w-5xl p-8 print:max-w-none print:p-0">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          to="/app/admin/team-readiness"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> All teams
        </Link>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-1 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-1 h-4 w-4" /> Print / Save as PDF
          </Button>
        </div>
      </header>

      <div className="mb-3 hidden print:block">
        <h1 className="font-display text-2xl">Team Readiness Assessment — pre-kickoff</h1>
      </div>

      {isLoading && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Building this team&apos;s report…
          </CardContent>
        </Card>
      )}

      {isError && (
        <Card className="border-rose-500/40">
          <CardContent className="py-10 text-center text-sm text-rose-400">
            This report could not be loaded: {(error as Error).message}
          </CardContent>
        </Card>
      )}

      {data && <TeamReadinessReport a={data.assessment} />}
    </div>
  );
}
