import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type LogRow = {
  id: number;
  file_id: string | null;
  team_id: string | null;
  actor_id: string | null;
  action: string;
  file_name: string | null;
  section: string | null;
  subsection: string | null;
  created_at: string;
};

type Enriched = LogRow & {
  actor_name: string | null;
  actor_avatar?: string | null;
  actor_email: string | null;
  team_name: string | null;
};

export function UploadActivityLogCard() {
  const [actionFilter, setActionFilter] = useState<"upload" | "all-changes">("upload");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [limit, setLimit] = useState<number>(100);

  const { data, isLoading } = useQuery({
    queryKey: ["upload-activity-log", actionFilter, limit],
    queryFn: async (): Promise<Enriched[]> => {
      const actions = actionFilter === "upload" ? ["insert"] : ["insert", "update", "delete"];
      const { data: logs, error } = await supabase
        .from("file_audit_log")
        .select("id, file_id, team_id, actor_id, action, file_name, section, subsection, created_at")
        .in("action", actions)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;

      const userIds = Array.from(new Set((logs ?? []).map((l) => l.actor_id).filter(Boolean) as string[]));
      const teamIds = Array.from(new Set((logs ?? []).map((l) => l.team_id).filter(Boolean) as string[]));

      const [profilesRes, teamsRes] = await Promise.all([
        userIds.length
          ? supabase.from("profiles").select("id, name, email, avatar_url").in("id", userIds)
          : Promise.resolve({ data: [] as { id: string; name: string | null; email: string | null; avatar_url: string | null }[] }),
        teamIds.length
          ? supabase.from("teams").select("id, name").in("id", teamIds)
          : Promise.resolve({ data: [] as { id: string; name: string | null }[] }),
      ]);

      const profMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));
      const teamMap = new Map((teamsRes.data ?? []).map((t) => [t.id, t.name]));

      return (logs ?? []).map((l) => ({
        ...l,
        actor_name: l.actor_id ? profMap.get(l.actor_id)?.name ?? null : null,
        actor_avatar: l.actor_id ? profMap.get(l.actor_id)?.avatar_url ?? null : null,
        actor_email: l.actor_id ? profMap.get(l.actor_id)?.email ?? null : null,
        team_name: l.team_id ? teamMap.get(l.team_id) ?? null : null,
      }));
    },
  });

  const teamOptions = useMemo(() => {
    const m = new Map<string, string>();
    (data ?? []).forEach((r) => { if (r.team_id) m.set(r.team_id, r.team_name ?? r.team_id.slice(0, 8)); });
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);

  const rows = (data ?? []).filter((r) => teamFilter === "all" || r.team_id === teamFilter);

  const actionStyle = (a: string) =>
    a === "insert" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
    : a === "update" ? "bg-blue-500/10 text-blue-700 dark:text-blue-400"
    : "bg-red-500/10 text-red-700 dark:text-red-400";

  const actionLabel = (a: string) => (a === "insert" ? "Upload" : a === "update" ? "Update" : "Delete");

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 flex-wrap">
        <CardTitle className="font-display text-2xl">File upload activity</CardTitle>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={actionFilter} onValueChange={(v) => setActionFilter(v as typeof actionFilter)}>
            <SelectTrigger className="h-8 w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="upload">Uploads only</SelectItem>
              <SelectItem value="all-changes">All file changes</SelectItem>
            </SelectContent>
          </Select>
          <Select value={teamFilter} onValueChange={setTeamFilter}>
            <SelectTrigger className="h-8 w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All teams</SelectItem>
              {teamOptions.map(([id, name]) => (
                <SelectItem key={id} value={id}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
            <SelectTrigger className="h-8 w-[110px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="50">Last 50</SelectItem>
              <SelectItem value="100">Last 100</SelectItem>
              <SelectItem value="250">Last 250</SelectItem>
              <SelectItem value="500">Last 500</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">When</th>
                  <th className="py-2 pr-4 font-medium">Student</th>
                  <th className="py-2 pr-4 font-medium">Team</th>
                  <th className="py-2 pr-4 font-medium">Action</th>
                  <th className="py-2 pr-4 font-medium">File</th>
                  <th className="py-2 pr-4 font-medium">Section</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/40">
                    <td className="py-2 pr-4 whitespace-nowrap text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        <StudentAvatar name={r.actor_name} email={r.actor_email} avatarUrl={r.actor_avatar} size={24} />
                        <div className="font-medium text-foreground">{r.actor_name ?? "—"}</div>
                      </div>
                      <div className="text-xs text-muted-foreground">{r.actor_email ?? (r.actor_id ? r.actor_id.slice(0, 8) : "system")}</div>
                    </td>
                    <td className="py-2 pr-4 text-foreground">{r.team_name ?? "—"}</td>
                    <td className="py-2 pr-4">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${actionStyle(r.action)}`}>
                        {actionLabel(r.action)}
                      </span>
                    </td>
                    <td className="py-2 pr-4 max-w-[260px] truncate text-foreground" title={r.file_name ?? ""}>
                      {r.file_name ?? "—"}
                    </td>
                    <td className="py-2 pr-4 text-xs text-muted-foreground">
                      {[r.section, r.subsection].filter(Boolean).join(" / ") || "—"}
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
