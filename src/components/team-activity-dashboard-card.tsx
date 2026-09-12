import { StudentAvatar } from "@/components/student-avatar";
import { teamLabel } from "@/lib/team-label";
import { useQuery } from "@tanstack/react-query";
import { Fragment, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronUp } from "lucide-react";

type WindowKey = "7" | "30" | "90" | "all";

const COMPLETED_STATUSES = new Set(["Reviewed", "Resolved"]);
const WEIGHTS = { login: 1, upload: 5, comment: 3, reply: 2 } as const;

type MemberStat = {
  user_id: string;
  name: string;
  avatar_url?: string | null;
  email: string;
  logins: number;
  uploads: number;
  comments: number;
  replies: number;
  score: number;
};

type Row = {
  team_id: string;
  team_name: string;
  members: number;
  logins: number;
  uploads: number;
  comments: number;
  filesCompleted: number;
  filesOutstanding: number;
  lastActivity: string | null;
  memberStats: MemberStat[];
};

export function TeamActivityDashboardCard() {
  const [win, setWin] = useState<WindowKey>("30");
  const [sortBy, setSortBy] = useState<"activity" | "name" | "outstanding">("activity");
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);

  const since = useMemo(() => {
    if (win === "all") return null;
    const d = new Date();
    d.setDate(d.getDate() - Number(win));
    return d.toISOString();
  }, [win]);

  const { data, isLoading } = useQuery({
    queryKey: ["team-activity-dashboard", win],
    queryFn: async (): Promise<Row[]> => {
      const [teamsRes, membersRes, authRes, fileAuditRes, commentsRes, filesRes, profilesRes] = await Promise.all([
        supabase.from("teams").select("id, name, section").eq("is_test", false),
        supabase.from("team_members").select("user_id, team_id"),
        since
          ? supabase.from("auth_audit_log").select("user_id, event, created_at").eq("event", "signin").gte("created_at", since)
          : supabase.from("auth_audit_log").select("user_id, event, created_at").eq("event", "signin"),
        since
          ? supabase.from("file_audit_log").select("team_id, actor_id, action, created_at").eq("action", "insert").gte("created_at", since)
          : supabase.from("file_audit_log").select("team_id, actor_id, action, created_at").eq("action", "insert"),
        since
          ? supabase.from("file_comments").select("team_id, author_id, to_entire_team, recipient_ids, created_at").gte("created_at", since)
          : supabase.from("file_comments").select("team_id, author_id, to_entire_team, recipient_ids, created_at"),
        supabase.from("files").select("team_id, status, updated_at"),
        supabase.from("profiles").select("id, name, email, avatar_url"),
      ]);

      const teams = teamsRes.data ?? [];
      const profiles = profilesRes.data ?? [];
      const profileById = new Map(profiles.map((p) => [p.id, p]));

      const teamByUser = new Map<string, string>();
      const memberCount = new Map<string, number>();
      const membersByTeam = new Map<string, string[]>();
      (membersRes.data ?? []).forEach((m) => {
        if (!m.user_id || !m.team_id) return;
        teamByUser.set(m.user_id, m.team_id);
        memberCount.set(m.team_id, (memberCount.get(m.team_id) ?? 0) + 1);
        const list = membersByTeam.get(m.team_id) ?? [];
        list.push(m.user_id);
        membersByTeam.set(m.team_id, list);
      });

      const logins = new Map<string, number>();
      const lastActivity = new Map<string, string>();
      const bumpLast = (teamId: string, ts: string) => {
        const prev = lastActivity.get(teamId);
        if (!prev || ts > prev) lastActivity.set(teamId, ts);
      };

      const userLogins = new Map<string, number>();
      const userUploads = new Map<string, number>();
      const userComments = new Map<string, number>();
      const userReplies = new Map<string, number>();

      (authRes.data ?? []).forEach((r) => {
        if (!r.user_id) return;
        const tid = teamByUser.get(r.user_id);
        if (!tid) return;
        logins.set(tid, (logins.get(tid) ?? 0) + 1);
        bumpLast(tid, r.created_at);
        userLogins.set(r.user_id, (userLogins.get(r.user_id) ?? 0) + 1);
      });

      const uploads = new Map<string, number>();
      (fileAuditRes.data ?? []).forEach((r) => {
        if (!r.team_id) return;
        uploads.set(r.team_id, (uploads.get(r.team_id) ?? 0) + 1);
        bumpLast(r.team_id, r.created_at);
        if (r.actor_id) {
          userUploads.set(r.actor_id, (userUploads.get(r.actor_id) ?? 0) + 1);
        }
      });

      const comments = new Map<string, number>();
      (commentsRes.data ?? []).forEach((r) => {
        if (!r.team_id) return;
        comments.set(r.team_id, (comments.get(r.team_id) ?? 0) + 1);
        bumpLast(r.team_id, r.created_at);
        if (r.author_id) {
          const isReply = !r.to_entire_team && Array.isArray(r.recipient_ids) && r.recipient_ids.length > 0;
          if (isReply) {
            userReplies.set(r.author_id, (userReplies.get(r.author_id) ?? 0) + 1);
          } else {
            userComments.set(r.author_id, (userComments.get(r.author_id) ?? 0) + 1);
          }
        }
      });

      const completed = new Map<string, number>();
      const outstanding = new Map<string, number>();
      (filesRes.data ?? []).forEach((f) => {
        if (!f.team_id) return;
        if (f.status && COMPLETED_STATUSES.has(f.status as string)) {
          completed.set(f.team_id, (completed.get(f.team_id) ?? 0) + 1);
        } else {
          outstanding.set(f.team_id, (outstanding.get(f.team_id) ?? 0) + 1);
        }
      });

      return teams.map((t) => {
        const memberIds = membersByTeam.get(t.id) ?? [];
        const memberStats: MemberStat[] = memberIds
          .map((uid) => {
            const p = profileById.get(uid);
            const l = userLogins.get(uid) ?? 0;
            const u = userUploads.get(uid) ?? 0;
            const c = userComments.get(uid) ?? 0;
            const rp = userReplies.get(uid) ?? 0;
            const score = l * WEIGHTS.login + u * WEIGHTS.upload + c * WEIGHTS.comment + rp * WEIGHTS.reply;
            return {
              user_id: uid,
              name: p?.name ?? "—",
              avatar_url: p?.avatar_url ?? null,
              email: p?.email ?? "",
              logins: l,
              uploads: u,
              comments: c,
              replies: rp,
              score,
            };
          })
          .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

        return {
          team_id: t.id,
          team_name: teamLabel(t),
          members: memberCount.get(t.id) ?? 0,
          logins: logins.get(t.id) ?? 0,
          uploads: uploads.get(t.id) ?? 0,
          comments: comments.get(t.id) ?? 0,
          filesCompleted: completed.get(t.id) ?? 0,
          filesOutstanding: outstanding.get(t.id) ?? 0,
          lastActivity: lastActivity.get(t.id) ?? null,
          memberStats,
        };
      });
    },
  });

  const rows = useMemo(() => {
    const r = [...(data ?? [])];
    r.sort((a, b) => {
      if (sortBy === "name") return a.team_name.localeCompare(b.team_name);
      if (sortBy === "outstanding") return b.filesOutstanding - a.filesOutstanding;
      const aA = a.logins + a.uploads + a.comments;
      const bA = b.logins + b.uploads + b.comments;
      return bA - aA;
    });
    return r;
  }, [data, sortBy]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        logins: acc.logins + r.logins,
        uploads: acc.uploads + r.uploads,
        comments: acc.comments + r.comments,
        completed: acc.completed + r.filesCompleted,
        outstanding: acc.outstanding + r.filesOutstanding,
      }),
      { logins: 0, uploads: 0, comments: 0, completed: 0, outstanding: 0 },
    );
  }, [rows]);

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

  const maxMemberScore = useMemo(() => {
    return Math.max(1, ...rows.flatMap((r) => r.memberStats.map((m) => m.score)));
  }, [rows]);

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 flex-wrap">
        <div>
          <CardTitle className="font-display text-2xl">Team activity dashboard</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Activity counts cover the selected window. File completion is all-time.
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
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="h-8 w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="activity">Sort: Most active</SelectItem>
              <SelectItem value="outstanding">Sort: Most outstanding</SelectItem>
              <SelectItem value="name">Sort: Name</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No teams yet.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
              {[
                { label: "Logins", value: totals.logins },
                { label: "Uploads", value: totals.uploads },
                { label: "Comments", value: totals.comments },
                { label: "Files done", value: totals.completed },
                { label: "Outstanding", value: totals.outstanding, alert: totals.outstanding > 0 },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-border/60 bg-card/50 p-3">
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                  <div className={`font-display text-2xl mt-1 ${s.alert ? "text-destructive" : ""}`}>{s.value}</div>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Team</th>
                    <th className="py-2 pr-2 font-medium text-right">Members</th>
                    <th className="py-2 pr-2 font-medium text-right">Logins</th>
                    <th className="py-2 pr-2 font-medium text-right">Uploads</th>
                    <th className="py-2 pr-2 font-medium text-right">Comments</th>
                    <th className="py-2 pr-2 font-medium text-right">Files done</th>
                    <th className="py-2 pr-2 font-medium text-right">Outstanding</th>
                    <th className="py-2 pr-4 font-medium w-[140px]">Completion</th>
                    <th className="py-2 pr-4 font-medium whitespace-nowrap">Last activity</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const totalFiles = r.filesCompleted + r.filesOutstanding;
                    const pct = totalFiles ? Math.round((r.filesCompleted / totalFiles) * 100) : 0;
                    const isExpanded = expandedTeam === r.team_id;
                    return (
                      <Fragment key={r.team_id}>
                        <tr
                          className="border-b border-border/40 cursor-pointer hover:bg-muted/30 transition-colors"
                          onClick={() => setExpandedTeam(isExpanded ? null : r.team_id)}
                        >
                          <td className="py-2 pr-4">
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              )}
                              <span className="font-medium text-foreground">{r.team_name}</span>
                            </div>
                          </td>
                          <td className="py-2 pr-2 text-right tabular-nums text-muted-foreground">{r.members}</td>
                          <td className="py-2 pr-2 text-right tabular-nums">{r.logins}</td>
                          <td className="py-2 pr-2 text-right tabular-nums">{r.uploads}</td>
                          <td className="py-2 pr-2 text-right tabular-nums">{r.comments}</td>
                          <td className="py-2 pr-2 text-right tabular-nums">{r.filesCompleted}</td>
                          <td className={`py-2 pr-2 text-right tabular-nums ${r.filesOutstanding > 0 ? "text-destructive" : ""}`}>
                            {r.filesOutstanding}
                          </td>
                          <td className="py-2 pr-4">
                            <div className="flex items-center gap-2">
                              <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                                <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs text-muted-foreground tabular-nums w-9 text-right">{pct}%</span>
                            </div>
                          </td>
                          <td className="py-2 pr-4 text-xs text-muted-foreground whitespace-nowrap">{fmtRel(r.lastActivity)}</td>
                        </tr>
                        {isExpanded && (
                          <tr className="border-b border-border/40 bg-muted/20">
                            <td colSpan={9} className="py-3 px-4">
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b text-left text-muted-foreground">
                                      <th className="py-1 pr-3 font-medium">Member</th>
                                      <th className="py-1 pr-2 font-medium text-right">Logins</th>
                                      <th className="py-1 pr-2 font-medium text-right">Uploads</th>
                                      <th className="py-1 pr-2 font-medium text-right">Comments</th>
                                      <th className="py-1 pr-2 font-medium text-right">Replies</th>
                                      <th className="py-1 pr-4 font-medium text-right">Score</th>
                                      <th className="py-1 pr-4 font-medium w-[120px]">Activity</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {r.memberStats.length === 0 ? (
                                      <tr>
                                        <td colSpan={7} className="py-2 text-muted-foreground italic">No members</td>
                                      </tr>
                                    ) : (
                                      r.memberStats.map((m) => (
                                        <tr key={m.user_id} className="border-b border-border/20 last:border-0">
                                          <td className="py-1 pr-3">
                                            <div className="flex items-center gap-2">
                                              <StudentAvatar name={m.name} email={m.email} avatarUrl={m.avatar_url} size={24} />
                                              <div>
                                                <div className="font-medium text-foreground">{m.name}</div>
                                                <div className="text-muted-foreground">{m.email}</div>
                                              </div>
                                            </div>
                                          </td>
                                          <td className="py-1 pr-2 text-right tabular-nums">{m.logins}</td>
                                          <td className="py-1 pr-2 text-right tabular-nums">{m.uploads}</td>
                                          <td className="py-1 pr-2 text-right tabular-nums">{m.comments}</td>
                                          <td className="py-1 pr-2 text-right tabular-nums">{m.replies}</td>
                                          <td className="py-1 pr-4 text-right font-display tabular-nums">{m.score}</td>
                                          <td className="py-1 pr-4">
                                            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                                              <div
                                                className="h-full bg-gold"
                                                style={{ width: `${Math.round((m.score / maxMemberScore) * 100)}%` }}
                                              />
                                            </div>
                                          </td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
