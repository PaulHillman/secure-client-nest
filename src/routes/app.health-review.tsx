import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { compareTeamsBySectionThenNumber, teamLineLabel } from "@/lib/team-label";
import { saveOrSendHealthReport } from "@/lib/team-health-report.functions";
import { runTeamHealthReview, ROLE_SCOPES, type HealthCheck, type HealthScope, type CheckStatus } from "@/lib/team-health-review.functions";

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
  validateSearch: (s: Record<string, unknown>) => ({ report: typeof s.report === "string" ? s.report : undefined }),
  component: HealthReviewPage,
});

const CHECKS: Record<HealthCheck, string> = {
  gaps: "Dashboard Gaps",
  readiness: "Team Readiness",
  meetings: "Weekly Meetings",
  activity: "Login / upload activity",
  vault: "File Vault requirements",
};
const CHECK_DESCRIPTIONS: Record<HealthCheck, string> = {
  gaps: "Group Norms signed & locked; weekly meeting time agreed.",
  readiness: "Every readiness-report check (client, roles, norms, files, activities).",
  meetings: "Per team: meetings logged, last meeting within 7 days (13 = action required), minutes posted for each logged meeting, a reason recorded for each absence.",
  activity: "Per student vs. teammates over the last 7 days: active days, uploads, any activity at all.",
  vault: "Minutes & agendas vs. semester week, client research (2 now, 4 by 10/18), misfiled research, interview questions, video files at semester milestones.",
};
const SCOPES: [HealthScope, string][] = [
  ["team", "One team"], ["section", "One section"], ["all", "All teams"], ["role", "One role"],
];

function HealthReviewPage() {
  const { isAdmin, loading } = useAuth();
  const [scope, setScope] = useState<HealthScope>("all");
  const [teamId, setTeamId] = useState("");
  const [section, setSection] = useState("");
  const [role, setRole] = useState("");
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

  const { report } = Route.useSearch();
  const navigate = Route.useNavigate();
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => run({ data: { scope, teamId: teamId || undefined, section: section || undefined, role: role || undefined } }),
    onSuccess: () => {
      navigate({ search: { report: undefined } });
      qc.invalidateQueries({ queryKey: ["health-history"] });
    },
  });
  const { data: savedRow } = useQuery({
    queryKey: ["health-report", report],
    enabled: isAdmin && !!report,
    queryFn: async () => {
      const { data, error } = await supabase.from("health_review_reports").select("payload, scope_label, created_at").eq("id", report!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const saved = report && savedRow ? (savedRow.payload as unknown as NonNullable<typeof m.data>) : null;
  const { data: history } = useQuery({
    queryKey: ["health-history"],
    enabled: isAdmin,
    queryFn: async () => {
      const [r, s] = await Promise.all([
        supabase.from("health_review_reports").select("id, scope_label, created_at, teams_checked, good_count, bad_count").order("created_at", { ascending: false }).limit(50),
        supabase.from("health_review_scores").select("id, report_id, team_label, section, good, bad, red, yellow, created_at").order("created_at", { ascending: false }).limit(300),
      ]);
      if (r.error) throw r.error;
      if (s.error) throw s.error;
      return { reports: r.data ?? [], scores: s.data ?? [] };
    },
  });
  const d = (saved ?? m.data) as typeof m.data;
  const saveSend = useServerFn(saveOrSendHealthReport);
  const [ranScope, setRanScope] = useState<{ scope: HealthScope; label: string } | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const act = useMutation({
    mutationFn: (action: "save" | "send" | "both") =>
      saveSend({ data: { action, scope: ranScope!.scope, scopeLabel: ranScope!.label, payload: m.data! as never } }),
    onSuccess: (r, action) => {
      qc.invalidateQueries({ queryKey: ["health-history"] });
      const parts: string[] = [];
      if (action !== "send") parts.push("Report saved.");
      if (action !== "save") parts.push(`Emailed ${r.emailsSent} people across ${r.teamsSent} team${r.teamsSent === 1 ? "" : "s"}${r.emailsFailed ? ` (${r.emailsFailed} failed)` : ""}.`);
      setDone(parts.join(" "));
    },
  });
  const doAct = (action: "save" | "send" | "both") => {
    if (action !== "save" && !window.confirm(`Email this report as a PDF to every member of the ${m.data?.teamsChecked} team(s) in it? Each team only gets its own results.`)) return;
    act.mutate(action);
  };
  const ex = (d?.exceptions ?? []).filter((e) => filter === "all" || e.check === filter);
  const CHECK_KEYS: HealthCheck[] = ["gaps", "readiness", "meetings", "activity", "vault"];
  const levelFor = (teamId: string, check: HealthCheck) =>
    d?.exceptions.some((e) => e.teamId === teamId && e.check === check && e.level === "red") ? "red" : "yellow";

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/app/dashboard" />;

  const canRun = (scope !== "team" || teamId) && (scope !== "section" || section) && (scope !== "role" || role);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="font-display text-4xl">Team Health Review</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Read-only. Shows what was checked and passed, then the concerns at the end — nothing is changed, sent, or emailed.
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
          {scope === "role" && (
            <select className="w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">Choose a role…</option>
              {ROLE_SCOPES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          )}
          <Button disabled={!canRun || m.isPending} onClick={() => {
            setDone(null);
            const label = scope === "all" ? "All teams" : scope === "section" ? `Section ${section}` : scope === "team" ? teamLineLabel(teams.find((t) => t.id === teamId) ?? { name: "One team", display_name: null, section: null }) : role;
            setRanScope({ scope, label });
            m.mutate();
          }}>
            {m.isPending ? "Running…" : "Run review"}
          </Button>
          {m.error && <p className="text-sm text-destructive">{(m.error as Error).message}</p>}
        </CardContent>
      </Card>

      {!saved && m.data && ranScope && ranScope.scope !== "role" && (
        <Card className="mt-6 border-border/60">
          <CardContent className="pt-6 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground mr-2">Reviewed it? Keep or share it:</span>
            <Button size="sm" variant="outline" disabled={act.isPending} onClick={() => doAct("save")}>Save</Button>
            <Button size="sm" variant="outline" disabled={act.isPending} onClick={() => doAct("send")}>Send to team(s)</Button>
            <Button size="sm" disabled={act.isPending} onClick={() => doAct("both")}>{act.isPending ? "Working…" : "Save & send"}</Button>
            {done && <span className="text-sm text-success">{done}</span>}
            {act.error && <span className="text-sm text-destructive">{(act.error as Error).message}</span>}
          </CardContent>
        </Card>
      )}
      {saved && savedRow && (
        <p className="mt-6 text-sm text-muted-foreground">
          Viewing saved report: {savedRow.scope_label} · {new Date(savedRow.created_at).toLocaleString()} ·{" "}
          <button className="underline" onClick={() => navigate({ search: { report: undefined } })}>close</button>
        </p>
      )}
      {d && (
        <Card className="mt-6 border-border/60">
          <CardHeader>
            <CardTitle className="font-display text-2xl">What was checked</CardTitle>
            <p className="text-xs text-muted-foreground">
              {d.teamsChecked} teams · {d.peopleChecked} people · semester week {d.week} ({Math.round(d.progress * 100)}% through) · run {new Date(d.generatedAt).toLocaleString()}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs">
              {CHECK_KEYS.map((k) => {
                const passed = d!.teamResults.filter((t) => t.results[k] === "pass").length;
                const flagged = d!.teamResults.filter((t) => t.results[k] === "flagged").length;
                const itemsPassed = d!.teamResults.reduce((n, t) => n + (t.passNotes?.[k] ?? []).filter((note) => !note.includes("sub-checks:")).length, 0);
                const itemsFlagged = d!.exceptions.filter((e) => e.check === k).length;
                return (
                  <span key={k} title={CHECK_DESCRIPTIONS[k]}>
                    {CHECKS[k]}: <span className="text-success">{itemsPassed} items passed</span>
                    {itemsFlagged > 0 && <>, <span className="text-destructive">{itemsFlagged} flagged</span></>}
                    <span className="text-muted-foreground"> ({passed}/{passed + flagged} teams clean)</span>
                  </span>
                );
              })}
            </div>
            <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
              {CHECK_KEYS.map((k) => (
                <p key={k}><span className="font-medium text-foreground">{CHECKS[k]}:</span> {CHECK_DESCRIPTIONS[k]}</p>
              ))}
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
                  {d.teamResults.map((t) => {
                    const passCount = CHECK_KEYS.filter((k) => t.results[k] === "pass").length;
                    const noteCount = CHECK_KEYS.reduce((n, k) => n + (t.passNotes?.[k]?.length ?? 0), 0);
                    return (
                      <Fragment key={t.teamId}>
                        <tr className="border-t border-border/40">
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
                        {noteCount > 0 && (
                          <tr className="border-t border-border/20">
                            <td colSpan={CHECK_KEYS.length + 1} className="py-1.5 pr-3">
                              <details>
                                <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                                  Why it passed — {passCount} check{passCount === 1 ? "" : "s"} passed
                                </summary>
                                <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                                  {CHECK_KEYS.map((k) =>
                                    (t.passNotes?.[k] ?? []).map((note, i) => (
                                      <li key={`${k}-${i}`}><span className="font-medium text-foreground">{CHECKS[k]}:</span> {note}</li>
                                    )),
                                  )}
                                </ul>
                              </details>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Green = checked and passed · gold/red = flagged (details in Concerns below) · — = not applicable to this scope.</p>
          </CardContent>
        </Card>
      )}

      {d && d.ranking.length > 0 && (
        <Card className="mt-6 border-border/60">
          <CardHeader>
            <CardTitle className="font-display text-2xl">Individual ranking</CardTitle>
            <p className="text-xs text-muted-foreground">
              Everyone holding this role, ranked from most problems identified (top) to fewest (bottom). People with zero problems are marked clean.
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr><th className="py-2 pr-3">#</th><th className="pr-3">Person</th><th className="pr-3">Team</th><th className="pr-3">Action required</th><th className="pr-3">Attention</th><th>Total problems</th></tr>
                </thead>
                <tbody>
                  {d.ranking.map((p, i) => (
                    <tr key={p.userId} className="border-t border-border/40">
                      <td className="py-2 pr-3 text-muted-foreground">{i + 1}</td>
                      <td className="pr-3 whitespace-nowrap">
                        <span className={`inline-block h-2.5 w-2.5 rounded-full mr-2 ${p.red > 0 ? "bg-destructive" : p.yellow > 0 ? "bg-gold" : "bg-success"}`} aria-hidden />
                        {p.name}
                      </td>
                      <td className="pr-3 whitespace-nowrap text-muted-foreground">{p.teamLabel}</td>
                      <td className="pr-3">{p.red > 0 ? <span className="text-destructive">{p.red}</span> : "0"}</td>
                      <td className="pr-3">{p.yellow > 0 ? <span className="text-gold">{p.yellow}</span> : "0"}</td>
                      <td>{p.total === 0 ? <span className="text-success">Clean</span> : p.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {d && (
        <Card className="mt-6 border-border/60">
          <CardHeader>
            <CardTitle className="font-display text-2xl">Concerns ({d.exceptions.length})</CardTitle>
            <p className="text-xs text-muted-foreground">
              {d.teamsChecked} teams · {d.peopleChecked} people checked · semester week {d.week} ({Math.round(d.progress * 100)}% through) · run {new Date(d.generatedAt).toLocaleString()}
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              {(["all", ...Object.keys(CHECKS)] as (HealthCheck | "all")[]).map((k) => {
                const n = k === "all" ? d!.exceptions.length : d!.exceptions.filter((e) => e.check === k).length;
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
      {history && (
        <>
          <Card className="mt-6 border-border/60">
            <CardHeader><CardTitle className="font-display text-2xl">Saved reports ({history.reports.length})</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted-foreground"><th className="py-1">Date</th><th>Scope</th><th>Teams</th><th>Good</th><th>Bad</th><th></th></tr></thead>
                <tbody>
                  {history.reports.map((r) => (
                    <tr key={r.id} className="border-t border-border/40">
                      <td className="py-1">{new Date(r.created_at).toLocaleString()}</td>
                      <td>{r.scope_label}</td><td>{r.teams_checked}</td>
                      <td className="text-success">{r.good_count}</td><td className="text-destructive">{r.bad_count}</td>
                      <td><button className="underline" onClick={() => { navigate({ search: { report: r.id } }); window.scrollTo(0, 0); }}>Open report</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
          <Card className="mt-6 border-border/60">
            <CardHeader><CardTitle className="font-display text-2xl">Team scores history</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <p className="text-xs text-muted-foreground mb-2">Good = checks passed. Bad = concerns still to fix (Action required + Attention).</p>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted-foreground"><th className="py-1">Date</th><th>Team</th><th>Good</th><th>Bad</th><th>Action required</th><th>Attention</th><th></th></tr></thead>
                <tbody>
                  {history.scores.map((x) => (
                    <tr key={x.id} className="border-t border-border/40">
                      <td className="py-1">{new Date(x.created_at).toLocaleDateString()}</td>
                      <td>{x.team_label}</td>
                      <td className="text-success">{x.good}</td><td className="text-destructive">{x.bad}</td>
                      <td>{x.red}</td><td>{x.yellow}</td>
                      <td><button className="underline" onClick={() => { navigate({ search: { report: x.report_id } }); window.scrollTo(0, 0); }}>View problems</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
