import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { compareTeamsBySectionThenNumber, teamLineLabel } from "@/lib/team-label";
import { runTeamHealthReview, type HealthCheck, type HealthScope, type CheckStatus } from "@/lib/team-health-review.functions";

export const Route = createFileRoute("/app/health-review")({
  head: () => ({
    meta: [
      { title: "Team Health Review — ClientVault" },
      { name: "description", content: "Read-only five-check health review across teams, sections, PMs and Video Specialists." },
      { property: "og:title", content: "Team Health Review — ClientVault" },
      { property: "og:description", content: "Read-only five-check health review with an exception list." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HealthReviewPage,
});

const CHECKS: Record<HealthCheck, string> = {
  gaps: "Dashboard Gaps",
  readiness: "Team Readiness",
  meetings: "Weekly Meetings",
  activity: "Login / upload activity",
  vault: "File Vault requirements",
};
const SCOPES: [HealthScope, string][] = [
  ["team", "One team"], ["section", "One section"], ["all", "All teams"], ["pm", "All PMs"], ["video", "All Video Specialists"],
];

function HealthReviewPage() {
  const { isAdmin, loading } = useAuth();
  const [scope, setScope] = useState<HealthScope>("all");
  const [teamId, setTeamId] = useState("");
  const [section, setSection] = useState("");
  const [filter, setFilter] = useState<HealthCheck | "all">("all");
  const run = useServerFn(runTeamHealthReview);

  const { data: teams = [] } = useQuery({
    queryKey: ["health-teams"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("teams").select("id, name, display_name, section, is_test");
      if (error) throw error;
      return (data ?? []).filter((t) => !t.is_test).sort(compareTeamsBySectionThenNumber);
    },
  });
  const sections = useMemo(() => [...new Set(teams.map((t) => t.section).filter(Boolean))] as string[], [teams]);

  const m = useMutation({ mutationFn: () => run({ data: { scope, teamId: teamId || undefined, section: section || undefined } }) });
  const ex = (m.data?.exceptions ?? []).filter((e) => filter === "all" || e.check === filter);
  const CHECK_KEYS: HealthCheck[] = ["gaps", "readiness", "meetings", "activity", "vault"];
  const levelFor = (teamId: string, check: HealthCheck) =>
    m.data?.exceptions.some((e) => e.teamId === teamId && e.check === check && e.level === "red") ? "red" : "yellow";

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/app/dashboard" />;

  const canRun = (scope !== "team" || teamId) && (scope !== "section" || section);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="font-display text-4xl">Team Health Review</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Read-only. Runs five checks and lists only the exceptions — nothing is changed, sent, or emailed.
        </p>
      </header>

      <Card className="border-border/60">
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-wrap gap-2">
            {SCOPES.map(([k, l]) => (
              <Button key={k} size="sm" variant={scope === k ? "default" : "outline"} onClick={() => setScope(k)}>{l}</Button>
            ))}
          </div>
          {scope === "team" && (
            <select className="w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              <option value="">Choose a team…</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{teamLineLabel(t)}</option>)}
            </select>
          )}
          {scope === "section" && (
            <select className="w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm" value={section} onChange={(e) => setSection(e.target.value)}>
              <option value="">Choose a section…</option>
              {sections.map((s) => <option key={s} value={s}>Section {s}</option>)}
            </select>
          )}
          <Button disabled={!canRun || m.isPending} onClick={() => m.mutate()}>
            {m.isPending ? "Running…" : "Run review"}
          </Button>
          {m.error && <p className="text-sm text-destructive">{(m.error as Error).message}</p>}
        </CardContent>
      </Card>

      {m.data && (
        <Card className="mt-6 border-border/60">
          <CardHeader>
            <CardTitle className="font-display text-2xl">What was checked</CardTitle>
            <p className="text-xs text-muted-foreground">
              {m.data.teamsChecked} teams · {m.data.peopleChecked} people · semester week {m.data.week} ({Math.round(m.data.progress * 100)}% through) · run {new Date(m.data.generatedAt).toLocaleString()}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs">
              {CHECK_KEYS.map((k) => {
                const passed = m.data!.teamResults.filter((t) => t.results[k] === "pass").length;
                const flagged = m.data!.teamResults.filter((t) => t.results[k] === "flagged").length;
                return (
                  <span key={k}>
                    {CHECKS[k]}: <span className="text-success">{passed} passed</span>
                    {flagged > 0 && <>, <span className="text-destructive">{flagged} flagged</span></>}
                  </span>
                );
              })}
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3">Team</th>
                    {CHECK_KEYS.map((k) => <th key={k} className="pr-3 whitespace-nowrap">{CHECKS[k]}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {m.data.teamResults.map((t) => (
                    <tr key={t.teamId} className="border-t border-border/40">
                      <td className="py-2 pr-3 whitespace-nowrap">{t.teamLabel}</td>
                      {CHECK_KEYS.map((k) => (
                        <td key={k} className="pr-3">
                          {t.results[k] === "skipped" ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <span className={`inline-block h-2.5 w-2.5 rounded-full ${t.results[k] === "pass" ? "bg-success" : levelFor(t.teamId, k) === "red" ? "bg-destructive" : "bg-gold"}`} aria-label={t.results[k] === "pass" ? "Passed" : "Flagged"} />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Green = checked and passed · gold/red = flagged (details in Concerns below) · — = not applicable to this scope.</p>
          </CardContent>
        </Card>
      )}

      {m.data && (
        <Card className="mt-6 border-border/60">
          <CardHeader>
            <CardTitle className="font-display text-2xl">Concerns ({m.data.exceptions.length})</CardTitle>
            <p className="text-xs text-muted-foreground">
              {m.data.teamsChecked} teams · {m.data.peopleChecked} people checked · semester week {m.data.week} ({Math.round(m.data.progress * 100)}% through) · run {new Date(m.data.generatedAt).toLocaleString()}
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              {(["all", ...Object.keys(CHECKS)] as (HealthCheck | "all")[]).map((k) => {
                const n = k === "all" ? m.data!.exceptions.length : m.data!.exceptions.filter((e) => e.check === k).length;
                return (
                  <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} onClick={() => setFilter(k)}>
                    {k === "all" ? "All" : CHECKS[k]} ({n})
                  </Button>
                );
              })}
            </div>
          </CardHeader>
          <CardContent>
            {ex.length === 0 ? (
              <p className="text-sm text-muted-foreground">No exceptions — everything checked looks healthy.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr><th className="py-2 pr-3"></th><th className="pr-3">Team</th><th className="pr-3">Check</th><th className="pr-3">Person</th><th>Exception</th></tr>
                  </thead>
                  <tbody>
                    {ex.map((e, i) => (
                      <tr key={i} className="border-t border-border/40 align-top">
                        <td className="py-2 pr-3">
                          <span className={`inline-block h-2.5 w-2.5 rounded-full ${e.level === "red" ? "bg-destructive" : "bg-gold"}`} aria-label={e.level === "red" ? "Action required" : "Attention needed"} />
                        </td>
                        <td className="pr-3 whitespace-nowrap">{e.teamLabel}</td>
                        <td className="pr-3 whitespace-nowrap text-muted-foreground">{CHECKS[e.check]}</td>
                        <td className="pr-3">{e.person ? <>{e.person}{e.role && <span className="text-xs text-muted-foreground"> · {e.role}</span>}</> : "—"}</td>
                        <td>{e.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
