import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDown, ArrowUp, Trophy, AlertTriangle } from "lucide-react";

type WindowKey = "7" | "30" | "90" | "all";
type SortField = "score" | "logins" | "uploads" | "comments" | "filesDone" | "outstanding" | "lastActivity";
type SortDir = "asc" | "desc";

interface TeamRow {
  team_id: string;
  team_name: string;
  members: number;
  logins: number;
  uploads: number;
  comments: number;
  filesDone: number;
  filesOutstanding: number;
  lastActivity: string | null;
  score: number;
  rank: number;
  percentile: number;
}

export function CrossTeamComparisonCard() {
  const [win, setWin] = useState<WindowKey>("30");
  const [sortField, setSortField] = useState<SortField>("score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const since = useMemo(() => {
    if (win === "all") return null;
    const d = new Date();
    d.setDate(d.getDate() - Number(win));
    return d.toISOString();
  }, [win]);

  const { data, isLoading } = useQuery({
    queryKey: ["cross-team-comparison", win],
    queryFn: async (): Promise<TeamRow[]> => {
      const [teamsRes, membersRes, authRes, fileAuditRes, commentsRes, filesRes] = await Promise.all([
        supabase.from("teams").select("id, name"),
        supabase.from("team_members").select("user_id, team_id"),
        since
          ? supabase.from("auth_audit_log").select("user_id, event, created_at").eq("event", "signin").gte("created_at", since)
          : supabase.from("auth_audit_log").select("user_id, event, created_at").eq("event", "signin"),
        since
          ? supabase.from("file_audit_log").select("team_id, action, created_at").eq("action", "insert").gte("created_at", since)
          : supabase.from("file_audit_log").select("team_id, action, created_at").eq("action", "insert"),
        since
          ? supabase.from("file_comments").select("team_id, created_at").gte("created_at", since)
          : supabase.from("file_comments").select("team_id, created_at"),
        supabase.from("files").select("team_id, status, updated_at"),
      ]);

      const teams = teamsRes.data ?? [];
      const teamByUser = new Map<string, string>();
      const memberCount = new Map<string, number>();
      (membersRes.data ?? []).forEach((m) => {
        if (!m.user_id || !m.team_id) return;
        teamByUser.set(m.user_id, m.team_id);
        memberCount.set(m.team_id, (memberCount.get(m.team_id) ?? 0) + 1);
      });

      const logins = new Map<string, number>();
      const lastActivity = new Map<string, string>();
      const bumpLast = (teamId: string, ts: string) => {
        const prev = lastActivity.get(teamId);
        if (!prev || ts > prev) lastActivity.set(teamId, ts);
      };

      (authRes.data ?? []).forEach((r) => {
        if (!r.user_id) return;
        const tid = teamByUser.get(r.user_id);
        if (!tid) return;
        logins.set(tid, (logins.get(tid) ?? 0) + 1);
        bumpLast(tid, r.created_at);
      });

      const uploads = new Map<string, number>();
      (fileAuditRes.data ?? []).forEach((r) => {
        if (!r.team_id) return;
        uploads.set(r.team_id, (uploads.get(r.team_id) ?? 0) + 1);
        bumpLast(r.team_id, r.created_at);
      });

      const comments = new Map<string, number>();
      (commentsRes.data ?? []).forEach((r) => {
        if (!r.team_id) return;
        comments.set(r.team_id, (comments.get(r.team_id) ?? 0) + 1);
        bumpLast(r.team_id, r.created_at);
      });

      const completed = new Map<string, number>();
      const outstanding = new Map<string, number>();
      (filesRes.data ?? []).forEach((f) => {
        if (!f.team_id) return;
        const done = f.status === "Reviewed" || f.status === "Resolved";
        if (done) {
          completed.set(f.team_id, (completed.get(f.team_id) ?? 0) + 1);
        } else {
          outstanding.set(f.team_id, (outstanding.get(f.team_id) ?? 0) + 1);
        }
      });

      const rows: TeamRow[] = teams.map((t) => {
        const l = logins.get(t.id) ?? 0;
        const u = uploads.get(t.id) ?? 0;
        const c = comments.get(t.id) ?? 0;
        const fd = completed.get(t.id) ?? 0;
        const fo = outstanding.get(t.id) ?? 0;
        const mem = memberCount.get(t.id) ?? 0;
        // per-member activity score (avoids penalizing small teams)
        const score = mem > 0 ? Math.round(((l + u * 2 + c * 1.5 + fd) / mem) * 10) : 0;
        return {
          team_id: t.id,
          team_name: t.name,
          members: mem,
          logins: l,
          uploads: u,
          comments: c,
          filesDone: fd,
          filesOutstanding: fo,
          lastActivity: lastActivity.get(t.id) ?? null,
          score,
          rank: 0,
          percentile: 0,
        };
      });

      // default sort by score desc for ranking
      rows.sort((a, b) => b.score - a.score);
      const total = rows.length;
      rows.forEach((r, i) => {
        r.rank = i + 1;
        r.percentile = total > 1 ? Math.round(((total - i - 1) / (total - 1)) * 100) : 100;
      });

      return rows;
    },
  });

  const sortedRows = useMemo(() => {
    const r = [...(data ?? [])];
    const dir = sortDir === "asc" ? 1 : -1;
    r.sort((a, b) => {
      switch (sortField) {
        case "score": return (a.score - b.score) * dir;
        case "logins": return (a.logins - b.logins) * dir;
        case "uploads": return (a.uploads - b.uploads) * dir;
        case "comments": return (a.comments - b.comments) * dir;
        case "filesDone": return (a.filesDone - b.filesDone) * dir;
        case "outstanding": return (a.filesOutstanding - b.filesOutstanding) * dir;
        case "lastActivity": {
          const aT = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
          const bT = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
          return (aT - bT) * dir;
        }
        default: return 0;
      }
    });
    return r;
  }, [data, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const fmtRel = (iso: string | null) => {
    if (!iso) return "—";
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(iso).toLocaleDateString();
  };

  const laggardCount = sortedRows.filter((r) => r.percentile <= 25).length;

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="inline-block w-3" />;
    return sortDir === "desc" ? <ArrowDown className="h-3 w-3 inline" /> : <ArrowUp className="h-3 w-3 inline" />;
  };

  const Th = ({ field, children, align = "left" }: { field: SortField; children: React.ReactNode; align?: "left" | "right" }) => (
    <th
      className={`py-2 pr-4 font-medium cursor-pointer select-none whitespace-nowrap ${align === "right" ? "text-right" : "text-left"}`}
      onClick={() => toggleSort(field)}
    >
      <span className="flex items-center gap-1">
        {children}
        <SortIcon field={field} />
      </span>
    </th>
  );

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 flex-wrap">
        <div>
          <CardTitle className="font-display text-2xl flex items-center gap-2">
            <Trophy className="h-5 w-5 text-gold" />
            Cross-team comparison
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {isLoading
              ? "Loading…"
              : `${sortedRows.length} teams · ${laggardCount} in laggard zone`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={win} onValueChange={(v) => setWin(v as WindowKey)}>
            <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : sortedRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No teams yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Rank</th>
                  <Th field="team_name" align="left">Team</Th>
                  <Th field="score" align="right">Score</Th>
                  <Th field="logins" align="right">Logins</Th>
                  <Th field="uploads" align="right">Uploads</Th>
                  <Th field="comments" align="right">Comments</Th>
                  <Th field="filesDone" align="right">Files done</Th>
                  <Th field="outstanding" align="right">Outstanding</Th>
                  <Th field="lastActivity" align="left">Last activity</Th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((r) => {
                  const isLaggard = r.percentile <= 25;
                  const isTop = r.percentile >= 75;
                  return (
                    <tr
                      key={r.team_id}
                      className={`border-b border-border/40 ${isLaggard ? "bg-destructive/5" : ""}`}
                    >
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          <span className={`font-display text-lg w-6 text-center ${isTop ? "text-gold" : isLaggard ? "text-destructive" : "text-muted-foreground"}`}>
                            {r.rank}
                          </span>
                          {isLaggard && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                        </div>
                      </td>
                      <td className="py-2 pr-4 font-medium text-foreground">
                        <div>{r.team_name}</div>
                        <div className="text-xs text-muted-foreground">{r.members} member{r.members === 1 ? "" : "s"}</div>
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums font-medium">
                        <div className={`${isTop ? "text-gold" : isLaggard ? "text-destructive" : ""}`}>{r.score}</div>
                        <div className="w-20 ml-auto h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full ${isLaggard ? "bg-destructive" : isTop ? "bg-emerald-500" : "bg-primary"}`}
                            style={{ width: `${r.percentile}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">{r.logins}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{r.uploads}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{r.comments}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{r.filesDone}</td>
                      <td className={`py-2 pr-4 text-right tabular-nums ${r.filesOutstanding > 0 ? "text-destructive" : ""}`}>
                        {r.filesOutstanding}
                      </td>
                      <td className="py-2 pr-4 text-xs text-muted-foreground whitespace-nowrap">{fmtRel(r.lastActivity)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
