import { StudentAvatar } from "@/components/student-avatar";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { getSluggoReport } from "@/lib/sluggo.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Flag } from "lucide-react";

function relative(iso: string | null) {
  if (!iso) return "Never";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function SluggoFlagCard() {
  const [windowDays, setWindowDays] = useState<"7" | "14" | "30">("7");
  const [severityFilter, setSeverityFilter] = useState<"all" | "high" | "medium">("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");

  const fetchReport = useServerFn(getSluggoReport);
  const { data, isLoading } = useQuery({
    queryKey: ["sluggo-flags", windowDays],
    queryFn: () => fetchReport({ data: { windowDays: Number(windowDays) } }),
  });

  const teams = data?.teams ?? [];
  const rows = useMemo(() => {
    let r = data?.rows ?? [];
    if (teamFilter !== "all") r = r.filter((x) => x.team === teamFilter);
    if (severityFilter !== "all") r = r.filter((x) => x.flags.some((f) => f.severity === severityFilter));
    const sev = (s: "high" | "medium") => (s === "high" ? 3 : 2);
    return [...r].sort((a, b) => {
      const aMax = Math.max(0, ...a.flags.map((f) => sev(f.severity)));
      const bMax = Math.max(0, ...b.flags.map((f) => sev(f.severity)));
      if (bMax !== aMax) return bMax - aMax;
      if (b.flags.length !== a.flags.length) return b.flags.length - a.flags.length;
      return a.name.localeCompare(b.name);
    });
  }, [data, teamFilter, severityFilter]);

  const highCount = rows.filter((r) => r.flags.some((f) => f.severity === "high")).length;

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 flex-wrap">
        <div>
          <CardTitle className="font-display text-2xl flex items-center gap-2">
            <Flag className="h-5 w-5 text-destructive" />
            Sluggo report
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {isLoading
              ? "Scanning…"
              : `${rows.length} of ${data?.totalStudents ?? 0} students flagged · ${highCount} high severity`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={windowDays} onValueChange={(v) => setWindowDays(v as typeof windowDays)}>
            <SelectTrigger className="h-8 w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Activity window: 7d</SelectItem>
              <SelectItem value="14">Activity window: 14d</SelectItem>
              <SelectItem value="30">Activity window: 30d</SelectItem>
            </SelectContent>
          </Select>
          <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as typeof severityFilter)}>
            <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severities</SelectItem>
              <SelectItem value="high">High only</SelectItem>
              <SelectItem value="medium">Medium only</SelectItem>
            </SelectContent>
          </Select>
          <Select value={teamFilter} onValueChange={setTeamFilter}>
            <SelectTrigger className="h-8 w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All teams</SelectItem>
              {teams.map((t) => (
                <SelectItem key={t.id} value={t.label}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
            <AlertTriangle className="h-4 w-4" />
            No students flagged — everyone is meeting baseline activity.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Student</th>
                  <th className="py-2 pr-4 font-medium">Section</th>
                  <th className="py-2 pr-4 font-medium">Team</th>
                  <th className="py-2 pr-4 font-medium">Role</th>
                  <th className="py-2 pr-4 font-medium">Last active</th>
                  <th className="py-2 pr-2 font-medium text-right">Actions ({windowDays}d)</th>
                  <th className="py-2 pr-2 font-medium text-right">Practice</th>
                  <th className="py-2 pr-2 font-medium text-right">Uploads</th>
                  <th className="py-2 pr-4 font-medium">Flags</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.userId} className="border-b border-border/40">
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        <StudentAvatar name={r.name} email={r.email} avatarUrl={r.avatarUrl} />
                        <div>
                          <div className="font-medium text-foreground">{r.name}</div>
                          <div className="text-xs text-muted-foreground">{r.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">{r.section ?? "—"}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{r.team ?? "—"}</td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {!r.role || r.role === "Unassigned" ? "—" : r.role}
                    </td>
                    <td className="py-2 pr-4 text-xs text-muted-foreground whitespace-nowrap">
                      {relative(r.lastActive)}
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums">{r.eventsInWindow}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{r.practiceDone}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{r.uploads}</td>
                    <td className="py-2 pr-4">
                      <div className="flex flex-wrap gap-1">
                        {r.flags.map((f) => (
                          <span
                            key={f.key}
                            className={
                              f.severity === "high"
                                ? "rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive"
                                : "rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400"
                            }
                          >
                            {f.label}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
