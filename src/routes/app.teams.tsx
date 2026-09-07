import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { teamPrimaryName } from "@/lib/team-label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2 } from "lucide-react";

export const Route = createFileRoute("/app/teams")({
  head: () => ({ meta: [{ title: "Teams — ClientVault" }] }),
  component: Teams,
});

function Teams() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { user, isAdmin } = useAuth();

  const { data: teams } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name, display_name, description, section, company_focus(company_name, industry)")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: memberships } = useQuery({
    queryKey: ["my-team-memberships", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return new Set((data ?? []).map((m) => m.team_id));
    },
  });

  const myTeamIds = memberships ?? new Set<string>();

  if (pathname !== "/app/teams") {
    return <Outlet />;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="font-display text-4xl">Teams</h1>
        <p className="text-sm text-muted-foreground mt-1">All MGT 331 consulting teams.</p>
      </header>

      {teams && teams.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            No teams yet. An admin can create teams from the Admin panel.
          </CardContent>
        </Card>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams?.map((t) => {
          const cf = Array.isArray(t.company_focus) ? t.company_focus[0] : t.company_focus;
          const isMine = myTeamIds.has(t.id);
          const canEnter = isAdmin || isMine;
          const primary = teamPrimaryName(t);

          const card = (
            <Card
              className={`h-full transition ${
                canEnter
                  ? "cursor-pointer border-border/60 hover:border-gold/50 hover:shadow-md"
                  : "opacity-80 bg-muted/30 border-border/40"
              } ${isMine ? "border-gold/60 bg-gold/5" : ""}`}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="font-display text-xl">{primary}</CardTitle>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isMine && (
                      <span className="text-[10px] uppercase tracking-wider font-semibold rounded-full bg-gold/20 text-gold px-2 py-0.5">
                        Your team
                      </span>
                    )}
                    {t.section && (
                      <span className="text-xs rounded-full bg-secondary px-2 py-0.5">Section {t.section}</span>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {cf ? (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-gold" />
                    <span className="text-foreground">{cf.company_name}</span>
                    {cf.industry && <span className="text-xs">· {cf.industry}</span>}
                  </div>
                ) : (
                  <span className="italic">No company focus yet</span>
                )}
                {t.description && <p className="mt-2 line-clamp-2">{t.description}</p>}
                {!canEnter && (
                  <p className="mt-3 text-xs text-muted-foreground italic">
                    You can only enter your own team space.
                  </p>
                )}
              </CardContent>
            </Card>
          );

          return canEnter ? (
            <Link key={t.id} to="/app/teams/$teamId" params={{ teamId: t.id }} aria-label={`View ${primary} members`}>
              {card}
            </Link>
          ) : (
            <div key={t.id} className="pointer-events-none select-none">
              {card}
            </div>
          );
        })}
      </div>
    </div>
  );
}
