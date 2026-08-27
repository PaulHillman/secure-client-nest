import { teamLabel } from "@/lib/team-label";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Flag } from "lucide-react";

type Flag = {
  key: string;
  label: string;
  severity: "high" | "medium" | "low";
};

type Row = {
  user_id: string;
  name: string;
  email: string;
  section: string | null;
  team: string | null;
  logins7: number;
  loginsAll: number;
  uploadsAll: number;
  commentsAll: number;
  lastLogin: string | null;
  flags: Flag[];
};

export function SluggoFlagCard() {
  const [loginWindow, setLoginWindow] = useState<"7" | "14" | "30">("7");
  const [severityFilter, setSeverityFilter] = useState<"all" | "high" | "medium">("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["sluggo-flags", loginWindow],
    queryFn: async (): Promise<{ rows: Row[]; teams: { id: string; name: string }[] }> => {
      const since = new Date();
      since.setDate(since.getDate() - Number(loginWindow));
      const sinceIso = since.toISOString();

      const [profilesRes, membersRes, teamsRes, authRes, fileRes, commentsRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("id, name, email, section"),
        supabase.from("team_members").select("user_id, team_id"),
        supabase.from("teams").select("id, name, section"),
        supabase.from("auth_audit_log").select("user_id, event, created_at").eq("event", "signin"),
        supabase.from("file_audit_log").select("actor_id, action").eq("action", "insert"),
        supabase.from("file_comments").select("author_id"),
        supabase.from("user_roles").select("user_id, role"),
      ]);

      const teams = teamsRes.data ?? [];
      const teamById = new Map(teams.map((t) => [t.id, teamLabel(t)]));
      const teamByUser = new Map<string, string>();
      (membersRes.data ?? []).forEach((m) => {
        if (m.user_id && m.team_id) teamByUser.set(m.user_id, teamById.get(m.team_id) ?? "");
      });

      const studentIds = new Set(
        (rolesRes.data ?? []).filter((r) => r.role === "student").map((r) => r.user_id),
      );

      const logins7 = new Map<string, number>();
      const loginsAll = new Map<string, number>();
      const lastLogin = new Map<string, string>();
      (authRes.data ?? []).forEach((r) => {
        if (!r.user_id) return;
        loginsAll.set(r.user_id, (loginsAll.get(r.user_id) ?? 0) + 1);
        if (r.created_at >= sinceIso) {
          logins7.set(r.user_id, (logins7.get(r.user_id) ?? 0) + 1);
        }
        const prev = lastLogin.get(r.user_id);
        if (!prev || r.created_at > prev) lastLogin.set(r.user_id, r.created_at);
      });

      const uploadsAll = new Map<string, number>();
      (fileRes.data ?? []).forEach((r) => {
        if (!r.actor_id) return;
        uploadsAll.set(r.actor_id, (uploadsAll.get(r.actor_id) ?? 0) + 1);
      });

      const commentsAll = new Map<string, number>();
      (commentsRes.data ?? []).forEach((r) => {
        if (!r.author_id) return;
        commentsAll.set(r.author_id, (commentsAll.get(r.author_id) ?? 0) + 1);
      });

      const rows: Row[] = (profilesRes.data ?? [])
        .filter((p) => studentIds.has(p.id))
        .map((p) => {
          const l7 = logins7.get(p.id) ?? 0;
          const lAll = loginsAll.get(p.id) ?? 0;
          const uAll = uploadsAll.get(p.id) ?? 0;
          const cAll = commentsAll.get(p.id) ?? 0;
          const flags: Flag[] = [];
          if (lAll === 0) flags.push({ key: "no-login-ever", label: "Never signed in", severity: "high" });
          else if (l7 === 0) flags.push({ key: "no-login-window", label: `0 logins in ${loginWindow}d`, severity: "high" });
          if (uAll === 0) flags.push({ key: "no-uploads", label: "0 uploads all semester", severity: "high" });
          if (cAll === 0) flags.push({ key: "no-comments", label: "0 comments all semester", severity: "medium" });
          if (!teamByUser.has(p.id)) flags.push({ key: "no-team", label: "Not on any team", severity: "medium" });
          return {
            user_id: p.id,
            name: p.name ?? "—",
            email: p.email ?? "",
            section: p.section ?? null,
            team: teamByUser.get(p.id) ?? null,
            logins7: l7,
            loginsAll: lAll,
            uploadsAll: uAll,
            commentsAll: cAll,
            lastLogin: lastLogin.get(p.id) ?? null,
            flags,
          };
        })
        .filter((r) => r.flags.length > 0);

      return { rows, teams };
    },
  });

  const teams = data?.teams ?? [];
  const rows = useMemo(() => {
    let r = data?.rows ?? [];
    if (teamFilter !== "all") r = r.filter((x) => x.team === teamFilter);
    if (severityFilter !== "all") {
      r = r.filter((x) => x.flags.some((f) => f.severity === severityFilter));
    }
    const sev = (s: "high" | "medium" | "low") => (s === "high" ? 3 : s === "medium" ? 2 : 1);
    return [...r].sort((a, b) => {
      const aMax = Math.max(...a.flags.map((f) => sev(f.severity)));
      const bMax = Math.max(...b.flags.map((f) => sev(f.severity)));
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
            {isLoading ? "Scanning…" : `${rows.length} student${rows.length === 1 ? "" : "s"} flagged · ${highCount} high severity`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={loginWindow} onValueChange={(v) => setLoginWindow(v as typeof loginWindow)}>
            <SelectTrigger className="h-8 w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Login window: 7d</SelectItem>
              <SelectItem value="14">Login window: 14d</SelectItem>
              <SelectItem value="30">Login window: 30d</SelectItem>
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
                <SelectItem key={t.id} value={teamLabel(t)}>{teamLabel(t)}</SelectItem>
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
                  <th className="py-2 pr-4 font-medium">Last login</th>
                  <th className="py-2 pr-2 font-medium text-right">Logins ({loginWindow}d)</th>
                  <th className="py-2 pr-2 font-medium text-right">Uploads</th>
                  <th className="py-2 pr-2 font-medium text-right">Comments</th>
                  <th className="py-2 pr-4 font-medium">Flags</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.user_id} className="border-b border-border/40">
                    <td className="py-2 pr-4">
                      <div className="font-medium text-foreground">{r.name}</div>
                      <div className="text-xs text-muted-foreground">{r.email}</div>
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">{r.section ?? "—"}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{r.team ?? "—"}</td>
                    <td className="py-2 pr-4 text-xs text-muted-foreground whitespace-nowrap">
                      {r.lastLogin ? new Date(r.lastLogin).toLocaleDateString() : "Never"}
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums">{r.logins7}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{r.uploadsAll}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{r.commentsAll}</td>
                    <td className="py-2 pr-4">
                      <div className="flex flex-wrap gap-1">
                        {r.flags.map((f) => (
                          <span
                            key={f.key}
                            className={
                              f.severity === "high"
                                ? "rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive"
                                : f.severity === "medium"
                                  ? "rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400"
                                  : "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
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
