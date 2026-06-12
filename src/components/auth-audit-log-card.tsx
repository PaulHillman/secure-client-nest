import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Row = {
  id: string;
  user_id: string;
  event: "signin" | "signout";
  user_agent: string | null;
  created_at: string;
  profile_name: string | null;
  profile_email: string | null;
};

export function AuthAuditLogCard() {
  const [eventFilter, setEventFilter] = useState<"all" | "signin" | "signout">("all");
  const [limit, setLimit] = useState<number>(100);

  const { data, isLoading } = useQuery({
    queryKey: ["auth-audit-log", limit],
    queryFn: async (): Promise<Row[]> => {
      const { data: logs, error } = await supabase
        .from("auth_audit_log")
        .select("id, user_id, event, user_agent, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      const ids = Array.from(new Set((logs ?? []).map((l) => l.user_id)));
      let profilesById = new Map<string, { name: string | null; email: string | null }>();
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, name, email")
          .in("id", ids);
        profilesById = new Map((profs ?? []).map((p) => [p.id, { name: p.name, email: p.email }]));
      }
      return (logs ?? []).map((l) => ({
        ...l,
        event: l.event as "signin" | "signout",
        profile_name: profilesById.get(l.user_id)?.name ?? null,
        profile_email: profilesById.get(l.user_id)?.email ?? null,
      }));
    },
  });

  const rows = (data ?? []).filter((r) => eventFilter === "all" || r.event === eventFilter);

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="font-display text-2xl">Sign-in / Sign-out log</CardTitle>
        <div className="flex items-center gap-2">
          <Select value={eventFilter} onValueChange={(v) => setEventFilter(v as typeof eventFilter)}>
            <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All events</SelectItem>
              <SelectItem value="signin">Sign-in only</SelectItem>
              <SelectItem value="signout">Sign-out only</SelectItem>
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
          <p className="text-sm text-muted-foreground">No events recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">When</th>
                  <th className="py-2 pr-4 font-medium">User</th>
                  <th className="py-2 pr-4 font-medium">Event</th>
                  <th className="py-2 pr-4 font-medium">Device</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/40">
                    <td className="py-2 pr-4 whitespace-nowrap text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4">
                      <div className="font-medium text-foreground">{r.profile_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{r.profile_email ?? r.user_id.slice(0, 8)}</div>
                    </td>
                    <td className="py-2 pr-4">
                      <span className={
                        r.event === "signin"
                          ? "rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400"
                          : "rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400"
                      }>
                        {r.event === "signin" ? "Sign-in" : "Sign-out"}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-xs text-muted-foreground max-w-[280px] truncate" title={r.user_agent ?? ""}>
                      {r.user_agent ?? "—"}
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
