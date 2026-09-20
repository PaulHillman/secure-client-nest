import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { getReadinessAssessments } from "@/lib/team-readiness-assessment.functions";
import { ReadinessStatusBadge, TestFixtureBadge } from "@/components/readiness-status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUpDown, Printer, RefreshCw, Search } from "lucide-react";

export const Route = createFileRoute("/app/admin_/team-readiness/")({
  head: () => ({
    meta: [
      { title: "Team Readiness Assessment — ClientVault" },
      {
        name: "description",
        content: "Pre-kickoff readiness for every consulting team, with the exact reasons behind each status.",
      },
      { property: "og:title", content: "Team Readiness Assessment — ClientVault" },
      {
        property: "og:description",
        content: "Pre-kickoff readiness for every consulting team, with the exact reasons behind each status.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TeamReadinessList,
});

type ColorFilter = "all" | "green" | "yellow" | "red";
type SortMode = "status" | "section" | "team-number" | "team-name";

const URGENCY = { red: 0, yellow: 1, green: 2 } as const;

function TeamReadinessList() {
  const { isAdmin, loading } = useAuth();
  const fetchAll = useServerFn(getReadinessAssessments);
  const [color, setColor] = useState<ColorFilter>("all");
  const [section, setSection] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("status");

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["team-readiness-assessments"],
    queryFn: () => fetchAll({}),
    enabled: isAdmin,
  });

  const rows = useMemo(() => {
    let list = (data?.teams ?? []).slice();
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) =>
          t.teamName.toLowerCase().includes(q) ||
          t.teamRecordName.toLowerCase().includes(q) ||
          String(t.teamNumber ?? "").includes(q) ||
          (t.section ?? "").toLowerCase().includes(q) ||
          t.members.some((m) => m.name.toLowerCase().includes(q)),
      );
    }
    if (color !== "all") list = list.filter((t) => t.color === color);
    if (section !== "all") list = list.filter((t) => t.section === section);
    list.sort((a, b) => {
      if (sort === "status" || sort === "team-number") {
        if (sort === "status" && URGENCY[a.color] !== URGENCY[b.color]) {
          return URGENCY[a.color] - URGENCY[b.color];
        }
        return (a.teamNumber ?? Infinity) - (b.teamNumber ?? Infinity);
      }
      if (sort === "section") {
        const sa = a.section ?? "";
        const sb = b.section ?? "";
        if (sa !== sb) return sa.localeCompare(sb);
        return (a.teamNumber ?? Infinity) - (b.teamNumber ?? Infinity);
      }
      return a.teamName.localeCompare(b.teamName);
    });
    return list;
  }, [data, search, color, section, sort]);

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/app/dashboard" />;

  return (
    <div className="mx-auto max-w-6xl p-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl">Team Readiness Assessment</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pre-kickoff readiness only. Attendance and meeting history are not part of this report.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Last refreshed: {data ? new Date(data.generatedAt).toLocaleString() : "—"}
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-1 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-1 h-4 w-4" /> Print / Save as PDF
          </Button>
        </div>
      </header>

      {isLoading && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Working out where every team stands…
          </CardContent>
        </Card>
      )}

      {isError && (
        <Card className="border-rose-500/40">
          <CardContent className="py-10 text-center text-sm text-rose-400">
            The readiness figures could not be loaded: {(error as Error).message}
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-4">
            {(
              [
                ["Teams assessed", data.totals.teams],
                ["Ready", data.totals.green],
                ["Attention needed", data.totals.yellow],
                ["Blocked", data.totals.red],
              ] as const
            ).map(([label, value]) => (
              <Card key={label}>
                <CardHeader className="pb-1">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 font-display text-3xl">{value}</CardContent>
              </Card>
            ))}
          </div>

          {data.excluded.length > 0 && (
            <p className="mb-4 text-xs text-muted-foreground">
              Excluded from these totals: {data.excluded.map((t) => t.name).join(", ")} (test fixtures).
            </p>
          )}

          <div className="mb-4 flex flex-col gap-3 sm:flex-row print:hidden">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search team name, number, member or section…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={color} onValueChange={(v) => setColor(v as ColorFilter)}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="green">Ready</SelectItem>
                <SelectItem value="yellow">Attention needed</SelectItem>
                <SelectItem value="red">Blocker</SelectItem>
              </SelectContent>
            </Select>
            <Select value={section} onValueChange={setSection}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sections</SelectItem>
                {data.sections.map((s) => (
                  <SelectItem key={s} value={s}>
                    Section {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort(v as SortMode)}>
              <SelectTrigger className="w-full sm:w-52">
                <ArrowUpDown className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="status">Most urgent first</SelectItem>
                <SelectItem value="section">Section</SelectItem>
                <SelectItem value="team-number">Team number</SelectItem>
                <SelectItem value="team-name">Team name A–Z</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {rows.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No teams match these filters.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {rows.map((t) => (
                <Card key={t.teamId} className="break-inside-avoid">
                  <CardContent className="flex flex-wrap items-start justify-between gap-3 py-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-lg">{t.teamName}</span>
                        {t.isTest ? <TestFixtureBadge /> : <ReadinessStatusBadge color={t.color} />}
                        {t.section && (
                          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                            Section {t.section}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{t.headline}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t.blockers.length} {t.blockers.length === 1 ? "blocker" : "blockers"} ·{" "}
                        {t.warnings.length} {t.warnings.length === 1 ? "warning" : "warnings"} ·{" "}
                        {t.proofsCompleted}/{t.proofsRequired} activities submitted
                      </p>
                    </div>
                    <Link
                      to="/app/admin/team-readiness/$teamId"
                      params={{ teamId: t.teamId }}
                      className="shrink-0 rounded-md border px-3 py-1.5 text-sm hover:bg-accent print:hidden"
                    >
                      Open report
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
