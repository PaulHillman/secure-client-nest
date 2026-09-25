import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/admin_/usage")({
  head: () => ({
    meta: [
      { title: "Student Usage by Role — ClientVault" },
      { name: "description", content: "Which pages and buttons students use most, broken down by team role." },
      { property: "og:title", content: "Student Usage by Role — ClientVault" },
      { property: "og:description", content: "Which pages and buttons students use most, broken down by team role." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UsagePage,
});

type Row = { user_id: string; role: string | null; event: string; path: string | null; label: string | null; duration_ms: number | null; created_at: string };

function pageName(p: string | null) {
  if (!p) return "—";
  return p.replace(/^\/app\/?/, "/").replace(/\/[0-9a-f-]{36}/g, "/:id") || "/";
}

function UsagePage() {
  const { isAdmin, loading } = useAuth();
  const [role, setRole] = useState("all");
  const { data = [], isLoading } = useQuery({
    queryKey: ["usage-events"],
    enabled: isAdmin,
    queryFn: async () => {
      const all: Row[] = [];
      for (let from = 0; from < 50000; from += 1000) {
        const { data, error } = await supabase.from("usage_events")
          .select("user_id, role, event, path, label, duration_ms, created_at")
          .order("created_at", { ascending: false }).range(from, from + 999);
        if (error) throw error;
        all.push(...(data as Row[]));
        if (!data || data.length < 1000) break;
      }
      return all;
    },
  });

  const roles = useMemo(() => Array.from(new Set(data.map((r) => r.role ?? "No role yet"))).sort(), [data]);
  const rows = role === "all" ? data : data.filter((r) => (r.role ?? "No role yet") === role);

  const stats = useMemo(() => {
    const pages = new Map<string, { views: number; ms: number; users: Set<string> }>();
    const clicks = new Map<string, { n: number; users: Set<string> }>();
    const users = new Set<string>();
    for (const r of rows) {
      users.add(r.user_id);
      const p = pageName(r.path);
      if (r.event === "page_view" || r.event === "page_time") {
        const s = pages.get(p) ?? { views: 0, ms: 0, users: new Set() };
        if (r.event === "page_view") s.views++; else s.ms += r.duration_ms ?? 0;
        s.users.add(r.user_id); pages.set(p, s);
      } else if (r.event === "click" && r.label) {
        const k = `${p} · ${r.label}`;
        const s = clicks.get(k) ?? { n: 0, users: new Set() };
        s.n++; s.users.add(r.user_id); clicks.set(k, s);
      }
    }
    return {
      users: users.size,
      pages: [...pages.entries()].sort((a, b) => b[1].views - a[1].views),
      clicks: [...clicks.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 40),
    };
  }, [rows]);

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/app/dashboard" />;
  const first = data.length ? new Date(data[data.length - 1].created_at).toLocaleDateString() : null;

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="font-display text-3xl">Student usage by role</h1>
        <p className="text-sm text-muted-foreground">
          Students only — your own visits and "View as" are never counted.{first ? ` Collecting since ${first}.` : ""}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {["all", ...roles].map((r) => (
          <Button key={r} size="sm" variant={role === r ? "default" : "outline"} onClick={() => setRole(r)}>{r === "all" ? "All roles" : r}</Button>
        ))}
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : !data.length ? (
        <p className="text-sm text-muted-foreground">No activity recorded yet. Data will build up as students use the app.</p>
      ) : (
        <>
          <p className="text-sm">{stats.users} students · {rows.length} recorded actions</p>
          <Card>
            <CardHeader><CardTitle className="text-lg">Pages visited</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground"><tr><th>Page</th><th>Visits</th><th>Students</th><th>Total time</th><th>Avg / visit</th></tr></thead>
                <tbody>{stats.pages.map(([p, s]) => (
                  <tr key={p} className="border-t"><td className="py-1">{p}</td><td>{s.views}</td><td>{s.users.size}</td>
                    <td>{Math.round(s.ms / 60000)} min</td><td>{s.views ? Math.round(s.ms / s.views / 1000) : 0}s</td></tr>
                ))}</tbody>
              </table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-lg">Most-used buttons and links</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground"><tr><th>Page · Button</th><th>Clicks</th><th>Students</th></tr></thead>
                <tbody>{stats.clicks.map(([k, s]) => (
                  <tr key={k} className="border-t"><td className="py-1">{k}</td><td>{s.n}</td><td>{s.users.size}</td></tr>
                ))}</tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
