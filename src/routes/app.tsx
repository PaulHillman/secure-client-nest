import { createFileRoute, Outlet, Link, Navigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, Users, FolderLock, LogOut, FolderOpen, ClipboardList, ListTodo, CalendarCheck, CalendarClock, Trophy, GaugeCircle, BarChart3, HeartPulse, Inbox } from "lucide-react";
import { fetchAwaitingReview } from "@/lib/awaiting-review";
import { Button } from "@/components/ui/button";
import { NotificationsBell } from "@/components/notifications-bell";
import logoAsset from "@/assets/clientvault-safe.png.asset.json";
import { ViewAsStudentPicker, ViewAsBanner } from "@/components/view-as-student";
import { UsageTracker } from "@/components/usage-tracker";
import { rememberReturnPath } from "@/lib/return-path";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading, isAdmin, signOut } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });

  const { data: profile } = useQuery({
    queryKey: ["sidebar-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("first_name, last_name, email")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: awaiting } = useQuery({
    queryKey: ["awaiting-review"],
    queryFn: fetchAwaitingReview,
    enabled: !!user && isAdmin,
    refetchInterval: 60_000,
  });
  const awaitingCount = awaiting?.total ?? 0;

  const { data: upcomingMeetings } = useQuery({
    queryKey: ["upcoming-peer-meetings"],
    enabled: !!user && isAdmin,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("peer_review_meetings")
        .select("id", { count: "exact", head: true })
        .gte("scheduled_at", new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString());
      if (error) throw error;
      return count ?? 0;
    },
  });
  const upcomingMeetingsCount = upcomingMeetings ?? 0;

  if (loading) return null;
  if (!user) {
    if (typeof window !== "undefined") rememberReturnPath(window.location.pathname + window.location.search);
    return <Navigate to="/login" />;
  }

  const nav = [
    { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/app/teams", label: "Teams", icon: Users },
    { to: "/app/milestones", label: "Milestones / Deadlines", icon: ClipboardList },
    { to: "/app/meetings", label: "Weekly Meetings", icon: CalendarCheck },
    { to: "/app/vault", label: "File Vault", icon: FolderOpen },
    { to: "/app/competitions", label: "Competitions", icon: Trophy },
    ...(isAdmin
      ? [
          { to: "/app/admin/awaiting-review", label: "Awaiting Review", icon: Inbox, badge: awaitingCount },
          { to: "/app/admin/peer-review-meetings", label: "Peer Reviews", icon: CalendarClock, badge: upcomingMeetingsCount },
          { to: "/app/health-review", label: "Team Health Review", icon: HeartPulse },
          { to: "/app/admin/team-readiness", label: "Team Readiness Assessment", icon: GaugeCircle },
          { to: "/app/admin/usage", label: "Student Usage", icon: BarChart3 },
          { to: "/app/backlog", label: "Work List", icon: ListTodo },
          { to: "/app/vault-overview", label: "Vault Overview", icon: ClipboardList },
          { to: "/app/admin", label: "Admin", icon: FolderLock },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen flex bg-background">
      <UsageTracker />
      <aside className="hidden md:flex w-60 flex-col bg-sidebar text-sidebar-foreground p-4 print:hidden">
        <Link to="/app/dashboard" className="flex items-center gap-3 px-2 py-3">
          <img src={logoAsset.url} alt="" className="vault-door-swing h-12 w-12 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.4)]" />
          <span className="font-display text-xl tracking-tight overflow-hidden">
            <span className="vault-client-slide text-sidebar-foreground">Client</span><span className="text-gold">Vault</span>
          </span>
        </Link>
        <nav className="mt-6 space-y-1">
          {nav.map((n) => {
            const active = path.startsWith(n.to);
            return (
              <Link key={n.to} to={n.to}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
                  active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                }`}>
                <n.icon className="h-4 w-4" />{n.label}
                {"badge" in n && typeof n.badge === "number" && n.badge > 0 && (
                  <span className="ml-auto rounded-full bg-destructive/15 text-destructive text-xs px-2 py-0.5">
                    {n.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border mt-4 pt-3 flex-shrink-0">
          <div className="px-2">
            <div className="text-sm font-medium text-sidebar-foreground truncate">
              {profile?.first_name && profile?.last_name
                ? `${profile.first_name} ${profile.last_name}`
                : user.email}
            </div>
            <div className="text-xs text-sidebar-foreground/60 truncate">{user.email}</div>
          </div>
          <ViewAsStudentPicker />
          <Button variant="ghost" size="sm" onClick={signOut}
            className="mt-2 w-full justify-start text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground">
            <LogOut className="h-4 w-4 mr-2" />Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <ViewAsBanner />
        <div className="flex items-center justify-end gap-2 px-4 py-2 border-b border-border/40 bg-background/60 backdrop-blur sticky top-0 z-10 print:hidden">
          <NotificationsBell />
        </div>
        <Outlet />
      </main>
    </div>
  );
}
