import { createFileRoute, Outlet, Link, Navigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, Users, FolderLock, LogOut, FolderOpen, ClipboardList, ListTodo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationsBell } from "@/components/notifications-bell";
import logoAsset from "@/assets/clientvault-safe.png.asset.json";
import { ViewAsStudentPicker, ViewAsBanner } from "@/components/view-as-student";

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

  if (loading) return null;
  if (!user) return <Navigate to="/login" />;

  const nav = [
    { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/app/teams", label: "Teams", icon: Users },
    { to: "/app/vault", label: "File Vault", icon: FolderOpen },
    ...(isAdmin
      ? [
          { to: "/app/backlog", label: "Work List", icon: ListTodo },
          { to: "/app/vault-overview", label: "Vault Overview", icon: ClipboardList },
          { to: "/app/admin", label: "Admin", icon: FolderLock },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="hidden md:flex w-60 flex-col bg-sidebar text-sidebar-foreground p-4">
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
        <div className="flex items-center justify-end gap-2 px-4 py-2 border-b border-border/40 bg-background/60 backdrop-blur sticky top-0 z-10">
          <NotificationsBell />
        </div>
        <Outlet />
      </main>
    </div>
  );
}
