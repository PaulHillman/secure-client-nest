import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, ShieldCheck, Building2 } from "lucide-react";
import { ProjectArchCard } from "@/components/project-arch-card";
import { ConsensusStatusCard } from "@/components/consensus-status-card";
import { ClientContactsCard } from "@/components/client-contacts-card";

export const Route = createFileRoute("/app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — ClientVault" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user, isAdmin } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [teams, myTeams, files, norms] = await Promise.all([
        supabase.from("teams").select("id", { count: "exact", head: true }),
        supabase.from("team_members").select("team_id", { count: "exact", head: true }).eq("user_id", user!.id),
        supabase.from("files").select("id", { count: "exact", head: true }),
        supabase.from("group_norms").select("id", { count: "exact", head: true }).eq("is_locked", true),
      ]);
      return {
        teams: teams.count ?? 0,
        myTeams: myTeams.count ?? 0,
        files: files.count ?? 0,
        norms: norms.count ?? 0,
      };
    },
    enabled: !!user,
  });

  const cards = [
    { label: "My Teams", value: stats?.myTeams ?? "—", icon: Users },
    { label: "Total Teams", value: stats?.teams ?? "—", icon: Building2 },
    { label: "Signed Norms", value: stats?.norms ?? "—", icon: ShieldCheck },
    { label: "Files in Vault", value: stats?.files ?? "—", icon: FileText },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-10">
        <p className="text-sm text-muted-foreground">Welcome back</p>
        <h1 className="font-display text-4xl mt-1">Your workspace</h1>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.label} className="border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className="h-4 w-4 text-gold" />
            </CardHeader>
            <CardContent>
              <div className="font-display text-3xl">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6">
        <ProjectArchCard />
      </div>

      {isAdmin && (
        <div className="mt-6 space-y-6">
          <ConsensusStatusCard />
          <ClientContactsCard />
        </div>
      )}



      <Card className="mt-8 border-border/60">
        <CardHeader>
          <CardTitle className="font-display text-2xl">Getting started</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>• Head to <strong className="text-foreground">Teams</strong> to view team rosters and company focus briefs.</p>
          <p>• Each team has a <strong className="text-foreground">Group Norms</strong> document that every member e-signs.</p>
          <p>• Upload research, deliverables and meeting notes into the team <strong className="text-foreground">File Vault</strong> — every change keeps a version.</p>
          <p className="pt-4 text-xs">Need a team created? Ask your instructor to add you in the Admin panel.</p>
        </CardContent>
      </Card>
    </div>
  );
}
