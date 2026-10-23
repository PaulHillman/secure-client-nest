import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PmDutiesCard } from "@/components/pm-duties-card";
import { PmDutiesAdminPanel } from "@/components/pm-duties-admin-panel";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/app/milestones")({
  head: () => ({
    meta: [
      { title: "Milestones — ClientVault" },
      {
        name: "description",
        content: "Your team's milestones and deadlines: completed, outstanding, and coming up.",
      },
      { property: "og:title", content: "Milestones — ClientVault" },
      {
        property: "og:description",
        content: "Track your team's milestones: what is done, what is left, and what is coming up.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { user, isAdmin, loading } = useAuth();
  const { data: teamId } = useQuery({
    queryKey: ["my-milestones-team", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", user!.id)
        .limit(1);
      if (error) throw error;
      return data?.[0]?.team_id ?? null;
    },
  });

  if (loading) return null;

  return (
    <main className="p-4 sm:p-8 max-w-4xl mx-auto">
      <header className="mb-6">
        <h1 className="font-display text-3xl">Milestones</h1>
        <p className="text-muted-foreground mt-1">
          Completed, outstanding, and coming up for your team.
        </p>
      </header>
      {teamId ? (
        <>
          <PmDutiesCard teamId={teamId} />
          <p className="mt-4 text-sm text-muted-foreground">
            This is the same list your team sees under{" "}
            <Link to="/app/teams/$teamId" params={{ teamId }} className="underline text-primary">
              your team page
            </Link>
            .
          </p>
        </>
      ) : (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            {isAdmin ? (
              <>
                You are not on a team, so here is the published milestone list you manage.
                <div className="mt-4 [&>section]:mt-0">
                  <PmDutiesAdminPanel />
                </div>
              </>
            ) : (
              <>You are not on a team yet, so there are no milestones to show.</>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  );
}
