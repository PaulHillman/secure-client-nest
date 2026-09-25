import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

type Ev = { user_id: string; role: string | null; team_id: string | null; event: string; path: string; label: string | null; duration_ms: number | null };

/** Records student page views, time on page, and button/link clicks. Admins and "View as" are never logged. */
export function UsageTracker() {
  const { realUser, realIsAdmin, loading } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const ctx = useRef<{ role: string | null; team_id: string | null } | null>(null);
  const queue = useRef<Ev[]>([]);
  const page = useRef<{ path: string; start: number } | null>(null);
  const active = !loading && !!realUser && !realIsAdmin;

  useEffect(() => {
    if (!active || !realUser) return;
    void supabase.from("team_members").select("team_id, job_title").eq("user_id", realUser.id).limit(1).maybeSingle()
      .then(({ data }) => { ctx.current = { role: data?.job_title ?? null, team_id: data?.team_id ?? null }; });
  }, [active, realUser]);

  useEffect(() => {
    if (!active || !realUser) return;
    const push = (event: string, p: string, label: string | null, duration: number | null) =>
      queue.current.push({ user_id: realUser.id, role: ctx.current?.role ?? null, team_id: ctx.current?.team_id ?? null, event, path: p, label, duration_ms: duration });
    const flush = () => {
      if (!queue.current.length) return;
      const rows = queue.current.splice(0);
      void supabase.from("usage_events").insert(rows);
    };
    const closePage = () => {
      if (page.current) push("page_time", page.current.path, null, Math.min(Date.now() - page.current.start, 3_600_000));
      page.current = null;
    };
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest("button, a, [role=button], [role=tab], [role=option]") as HTMLElement | null;
      if (!el) return;
      const label = (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60);
      if (label) push("click", window.location.pathname, label, null);
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") { closePage(); flush(); }
      else page.current = { path: window.location.pathname, start: Date.now() };
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("visibilitychange", onVis);
    const t = setInterval(flush, 15_000);
    (window as unknown as { __cvUsage?: typeof push }).__cvUsage = push;
    return () => { closePage(); flush(); clearInterval(t); document.removeEventListener("click", onClick, true); document.removeEventListener("visibilitychange", onVis); };
  }, [active, realUser]);

  useEffect(() => {
    if (!active) return;
    const push = (window as unknown as { __cvUsage?: (e: string, p: string, l: string | null, d: number | null) => void }).__cvUsage;
    if (!push) return;
    if (page.current) push("page_time", page.current.path, null, Math.min(Date.now() - page.current.start, 3_600_000));
    push("page_view", path, null, null);
    page.current = { path, start: Date.now() };
  }, [path, active]);

  return null;
}
