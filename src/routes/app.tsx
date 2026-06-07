import { createFileRoute, Outlet, Link, Navigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Vault, LayoutDashboard, Users, FolderLock, LogOut, FolderOpen, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationsBell } from "@/components/notifications-bell";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading, isAdmin, signOut } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });

  if (loading) return null;
  if (!user) return <Navigate to="/login" />;

  const nav = [
    { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/app/teams", label: "Teams", icon: Users },
    { to: "/app/vault", label: "File Vault", icon: FolderOpen },
    ...(isAdmin ? [{ to: "/app/admin", label: "Admin", icon: FolderLock }] : []),
  ];

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="hidden md:flex w-60 flex-col bg-sidebar text-sidebar-foreground p-4">
        <Link to="/app/dashboard" className="flex items-center gap-2 px-2 py-3">
          <Vault className="h-5 w-5 text-gold" />
          <span className="font-display text-xl">ClientVault</span>
        </Link>
        <nav className="mt-6 flex-1 space-y-1">
          {nav.map((n) => {
            const active = path.startsWith(n.to);
            return (
              <Link key={n.to} to={n.to}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
                  active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                }`}>
                <n.icon className="h-4 w-4" />{n.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border pt-3">
          <div className="px-2 text-xs text-sidebar-foreground/60 truncate">{user.email}</div>
          <Button variant="ghost" size="sm" onClick={signOut}
            className="mt-2 w-full justify-start text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground">
            <LogOut className="h-4 w-4 mr-2" />Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="flex items-center justify-end gap-2 px-4 py-2 border-b border-border/40 bg-background/60 backdrop-blur sticky top-0 z-10">
          <NotificationsBell />
        </div>
        <Outlet />
      </main>
    </div>
  );
}
