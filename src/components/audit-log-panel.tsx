import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { History, Download, FilePlus2, FileEdit, Trash2 } from "lucide-react";

type AuditRow = {
  id: number;
  file_id: string | null;
  team_id: string | null;
  actor_id: string | null;
  action: "insert" | "update" | "delete";
  file_name: string | null;
  section: string | null;
  subsection: string | null;
  changed_fields: string[] | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
};

const RANGES = [
  { value: "24h", label: "Last 24 hours", hours: 24 },
  { value: "7d", label: "Last 7 days", hours: 24 * 7 },
  { value: "30d", label: "Last 30 days", hours: 24 * 30 },
  { value: "90d", label: "Last 90 days", hours: 24 * 90 },
  { value: "all", label: "All time", hours: 0 },
] as const;

const ACTION_META: Record<
  AuditRow["action"],
  { label: string; icon: typeof FilePlus2; cls: string }
> = {
  insert: { label: "Upload", icon: FilePlus2, cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  update: { label: "Update", icon: FileEdit, cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  delete: { label: "Delete", icon: Trash2, cls: "bg-rose-500/15 text-rose-400 border-rose-500/30" },
};

export function AuditLogPanel() {
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [actorFilter, setActorFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [range, setRange] = useState<(typeof RANGES)[number]["value"]>("7d");
  const [search, setSearch] = useState("");

  const { data: teams } = useQuery({
    queryKey: ["admin", "teams", "lookup"],
    queryFn: async () => {
      const { data, error } = await supabase.from("teams").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["admin", "profiles", "lookup"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, name, email").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: rows, isLoading } = useQuery({
    queryKey: ["admin", "audit-log", teamFilter, actorFilter, actionFilter, range],
    queryFn: async () => {
      let q = supabase
        .from("file_audit_log")
        .select(
          "id, file_id, team_id, actor_id, action, file_name, section, subsection, changed_fields, old_data, new_data, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(1000);
      if (teamFilter !== "all") q = q.eq("team_id", teamFilter);
      if (actorFilter !== "all") q = q.eq("actor_id", actorFilter);
      if (actionFilter !== "all") q = q.eq("action", actionFilter);
      const r = RANGES.find((x) => x.value === range);
      if (r && r.hours > 0) {
        const since = new Date(Date.now() - r.hours * 3600 * 1000).toISOString();
        q = q.gte("created_at", since);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data as AuditRow[];
    },
  });

  const teamMap = useMemo(
    () => new Map((teams ?? []).map((t) => [t.id, t.name] as const)),
    [teams],
  );
  const profMap = useMemo(
    () => new Map((profiles ?? []).map((p) => [p.id, p.name || p.email || p.id] as const)),
    [profiles],
  );

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows ?? [];
    return (rows ?? []).filter((r) => {
      const hay = [
        r.file_name,
        r.section,
        r.subsection,
        r.team_id ? teamMap.get(r.team_id) : null,
        r.actor_id ? profMap.get(r.actor_id) : null,
        (r.changed_fields ?? []).join(" "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(s);
    });
  }, [rows, search, teamMap, profMap]);

  const exportCsv = () => {
    const header = [
      "timestamp",
      "action",
      "actor",
      "team",
      "file_name",
      "section",
      "subsection",
      "changed_fields",
    ];
    const lines = [header.join(",")];
    for (const r of filtered) {
      const cells = [
        r.created_at,
        r.action,
        r.actor_id ? profMap.get(r.actor_id) ?? r.actor_id : "",
        r.team_id ? teamMap.get(r.team_id) ?? r.team_id : "",
        r.file_name ?? "",
        r.section ?? "",
        r.subsection ?? "",
        (r.changed_fields ?? []).join("|"),
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
      lines.push(cells.join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clear =
    teamFilter !== "all" || actorFilter !== "all" || actionFilter !== "all" || range !== "7d" || search;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <CardTitle className="font-display text-xl flex items-center gap-2">
            <History className="h-5 w-5 text-gold" /> File audit log
            <span className="text-sm text-muted-foreground font-normal">
              ({filtered.length}
              {filtered.length !== (rows?.length ?? 0) ? ` of ${rows?.length}` : ""})
            </span>
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-muted-foreground">Team</Label>
              <Select value={teamFilter} onValueChange={setTeamFilter}>
                <SelectTrigger className="h-8 w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All teams</SelectItem>
                  {(teams ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-muted-foreground">User</Label>
              <Select value={actorFilter} onValueChange={setActorFilter}>
                <SelectTrigger className="h-8 w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All users</SelectItem>
                  {(profiles ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name || p.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-muted-foreground">Action</Label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  <SelectItem value="insert">Upload</SelectItem>
                  <SelectItem value="update">Update</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-muted-foreground">Range</Label>
              <Select value={range} onValueChange={(v) => setRange(v as typeof range)}>
                <SelectTrigger className="h-8 w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RANGES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search file name…"
              className="h-8 w-[180px]"
            />
            {clear && (
              <Button size="sm" variant="ghost" onClick={() => {
                setTeamFilter("all"); setActorFilter("all");
                setActionFilter("all"); setRange("7d"); setSearch("");
              }}>Clear</Button>
            )}
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={!filtered.length}>
              <Download className="h-3.5 w-3.5 mr-1" /> CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-muted-foreground border-b">
                <th className="py-2 pr-3">When</th>
                <th className="py-2 pr-3">Action</th>
                <th className="py-2 pr-3">User</th>
                <th className="py-2 pr-3">Team</th>
                <th className="py-2 pr-3">File</th>
                <th className="py-2 pr-3">Location</th>
                <th className="py-2 pr-3">Changes</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!isLoading && !filtered.length && (
                <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">No audit entries match these filters.</td></tr>
              )}
              {filtered.map((r) => {
                const meta = ACTION_META[r.action];
                const Icon = meta.icon;
                return (
                  <tr key={r.id} className="border-b last:border-0 align-top">
                    <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge variant="outline" className={meta.cls}>
                        <Icon className="h-3 w-3 mr-1" /> {meta.label}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3">
                      {r.actor_id ? profMap.get(r.actor_id) ?? <span className="text-muted-foreground italic">unknown</span> : <span className="text-muted-foreground italic">system</span>}
                    </td>
                    <td className="py-2 pr-3">
                      {r.team_id ? teamMap.get(r.team_id) ?? <span className="text-muted-foreground italic">deleted team</span> : "—"}
                    </td>
                    <td className="py-2 pr-3">{r.file_name ?? "—"}</td>
                    <td className="py-2 pr-3 text-muted-foreground text-xs">
                      {r.section ?? "—"}{r.subsection ? ` / ${r.subsection}` : ""}
                    </td>
                    <td className="py-2 pr-3">
                      {r.action === "update" && r.changed_fields?.length ? (
                        <ChangeSummary row={r} />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function ChangeSummary({ row }: { row: AuditRow }) {
  const fields = (row.changed_fields ?? []).filter((f) => f !== "current_version_id");
  if (!fields.length) return <span className="text-xs text-muted-foreground">version bump</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {fields.map((f) => {
        const before = row.old_data?.[f];
        const after = row.new_data?.[f];
        const title = `${f}: ${fmt(before)} → ${fmt(after)}`;
        return (
          <Badge key={f} variant="secondary" className="text-[10px]" title={title}>
            {f}
          </Badge>
        );
      })}
    </div>
  );
}

function fmt(v: unknown) {
  if (v == null) return "∅";
  if (typeof v === "string") return v.length > 40 ? v.slice(0, 40) + "…" : v;
  return JSON.stringify(v);
}
