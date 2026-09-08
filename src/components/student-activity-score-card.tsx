import { StudentAvatar } from "@/components/student-avatar";
import { teamLabel } from "@/lib/team-label";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type WindowKey = "7" | "30" | "90" | "all";

const WEIGHTS = { login: 1, upload: 5, comment: 3, reply: 2 } as const;

type Row = {
  user_id: string;
  name: string;
  avatar_url?: string | null;
  email: string;
  section: string | null;
  team: string | null;
  logins: number;
  uploads: number;
  comments: number;
  replies: number;
  score: number;
};

export function StudentActivityScoreCard() {
  const [win, setWin] = useState<WindowKey>("30");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"score" | "name" | "section">("score");

  const since = useMemo(() => {
    if (win === "all") return null;
    const d = new Date();
    d.setDate(d.getDate() - Number(win));
    return d.toISOString();
  }, [win]);

  const { data, isLoading } = useQuery({
    queryKey: ["student-activity-score", win],
    queryFn: async (): Promise<{ rows: Row[]; teams: { id: string; name: string }[] }> => {
      const [profilesRes, membersRes, teamsRes, authRes, fileRes, commentsRes] = await Promise.all([
        supabase.from("profiles").select("id, name, email, section, avatar_url"),
        supabase.from("team_members").select("user_id, team_id"),
        supabase.from("teams").select("id, name, section"),
        (since
          ? supabase.from("auth_audit_log").select("user_id, event, created_at").eq("event", "signin").gte("created_at", since)
          : supabase.from("auth_audit_log").select("user_id, event, created_at").eq("event", "signin")),
        (since
          ? supabase.from("file_audit_log").select("actor_id, action, created_at").eq("action", "insert").gte("created_at", since)
          : supabase.from("file_audit_log").select("actor_id, action, created_at").eq("action", "insert")),
        (since
          ? supabase.from("file_comments").select("author_id, to_entire_team, recipient_ids, created_at").gte("created_at", since)
          : supabase.from("file_comments").select("author_id, to_entire_team, recipient_ids, created_at")),
      ]);

      const profiles = profilesRes.data ?? [];
      const members = membersRes.data ?? [];
      const teams = teamsRes.data ?? [];
      const teamById = new Map(teams.map((t) => [t.id, teamLabel(t)]));
      const teamByUser = new Map<string, string>();
      members.forEach((m) => {
        if (m.user_id && m.team_id) teamByUser.set(m.user_id, teamById.get(m.team_id) ?? "");
      });

      const counts = new Map<string, { logins: number; uploads: number; comments: number; replies: number }>();
      const bump = (uid: string | null, key: "logins" | "uploads" | "comments" | "replies") => {
        if (!uid) return;
        const c = counts.get(uid) ?? { logins: 0, uploads: 0, comments: 0, replies: 0 };
        c[key]++;
        counts.set(uid, c);
      };

      (authRes.data ?? []).forEach((r) => bump(r.user_id, "logins"));
      (fileRes.data ?? []).forEach((r) => bump(r.actor_id, "uploads"));
      (commentsRes.data ?? []).forEach((r) => {
        const isReply = !r.to_entire_team && Array.isArray(r.recipient_ids) && r.recipient_ids.length > 0;
        bump(r.author_id, isReply ? "replies" : "comments");
      });

      const rows: Row[] = profiles.map((p) => {
        const c = counts.get(p.id) ?? { logins: 0, uploads: 0, comments: 0, replies: 0 };
        const score =
          c.logins * WEIGHTS.login +
          c.uploads * WEIGHTS.upload +
          c.comments * WEIGHTS.comment +
          c.replies * WEIGHTS.reply;
        return {
          user_id: p.id,
          name: p.name ?? "—",
          avatar_url: p.avatar_url ?? null,
          email: p.email ?? "",
          section: p.section ?? null,
          team: teamByUser.get(p.id) ?? null,
          ...c,
          score,
        };
      });

      return { rows, teams };
    },
  });

  const teams = data?.teams ?? [];
  const rows = useMemo(() => {
    let r = data?.rows ?? [];
    if (teamFilter !== "all") r = r.filter((x) => x.team === teamFilter);
    r = [...r].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "section") return (a.section ?? "").localeCompare(b.section ?? "") || a.name.localeCompare(b.name);
      return b.score - a.score || a.name.localeCompare(b.name);
    });
    return r;
  }, [data, teamFilter, sortBy]);

  const max = Math.max(1, ...rows.map((r) => r.score));

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 flex-wrap">
        <div>
          <CardTitle className="font-display text-2xl">Student activity score</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Login×{WEIGHTS.login} + Upload×{WEIGHTS.upload} + Comment×{WEIGHTS.comment} + Reply×{WEIGHTS.reply}
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
          <Select value={teamFilter} onValueChange={setTeamFilter}>
            <SelectTrigger className="h-8 w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All teams</SelectItem>
              {teams.map((t) => (
                <SelectItem key={t.id} value={teamLabel(t)}>{teamLabel(t)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="score">Sort: Score</SelectItem>
              <SelectItem value="name">Sort: Name</SelectItem>
              <SelectItem value="section">Sort: Section</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No students found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Student</th>
                  <th className="py-2 pr-4 font-medium">Section</th>
                  <th className="py-2 pr-4 font-medium">Team</th>
                  <th className="py-2 pr-2 font-medium text-right">Logins</th>
                  <th className="py-2 pr-2 font-medium text-right">Uploads</th>
                  <th className="py-2 pr-2 font-medium text-right">Comments</th>
                  <th className="py-2 pr-2 font-medium text-right">Replies</th>
                  <th className="py-2 pr-4 font-medium text-right">Score</th>
                  <th className="py-2 pr-4 font-medium w-[180px]">Activity</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.user_id} className="border-b border-border/40">
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        <StudentAvatar name={r.name} email={r.email} avatarUrl={r.avatar_url} />
                        <div>
                          <div className="font-medium text-foreground">{r.name}</div>
                          <div className="text-xs text-muted-foreground">{r.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">{r.section ?? "—"}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{r.team ?? "—"}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{r.logins}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{r.uploads}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{r.comments}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{r.replies}</td>
                    <td className="py-2 pr-4 text-right font-display text-base tabular-nums">{r.score}</td>
                    <td className="py-2 pr-4">
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-gold"
                          style={{ width: `${Math.round((r.score / max) * 100)}%` }}
                        />
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
