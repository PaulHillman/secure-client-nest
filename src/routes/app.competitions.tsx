import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import { FileVault } from "@/components/file-vault";
import { COMPETITION_SECTIONS } from "@/lib/vault-structure";

export const Route = createFileRoute("/app/competitions")({
  head: () => ({
    meta: [
      { title: "Competitions — ClientVault" },
      { name: "description", content: "Submit and review your team's entries for the three class competitions." },
      { property: "og:title", content: "Competitions — ClientVault" },
      { property: "og:description", content: "Submit and review your team's entries for the three class competitions." },
    ],
  }),
  component: CompetitionsPage,
});

function CompetitionsPage() {
  const { user, isAdmin } = useAuth();
  const [pickedTeam, setPickedTeam] = useState<string | null>(null);

  const { data: myTeams, isLoading } = useQuery({
    queryKey: ["my-teams", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("team_id, teams(name, display_name, section, is_test)")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).filter((t) => t.teams && !(t.teams as { is_test?: boolean }).is_test);
    },
  });

  const { data: allTeams } = useQuery({
    queryKey: ["all-teams-picker"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name, display_name, section")
        .eq("is_test", false)
        .order("section")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const myTeamId = myTeams?.[0]?.team_id ?? null;
  const teamId = pickedTeam ?? myTeamId;

  const teamLabel = (t: { name: string; display_name: string | null; section: string | null }) =>
    `${t.display_name?.trim() || t.name}${t.section ? ` · Section ${t.section}` : ""}`;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-2">
        <Trophy className="h-6 w-6 text-gold" />
        <h1 className="font-display text-4xl">Competitions</h1>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Upload your team's submission and supporting materials for each of the three competitions.
      </p>

      {isAdmin && allTeams && allTeams.length > 0 && (
        <div className="mt-4">
          <label className="text-sm font-medium" htmlFor="competitions-team-picker">
            Team
          </label>
          <select
            id="competitions-team-picker"
            className="mt-1 block w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={teamId ?? ""}
            onChange={(e) => setPickedTeam(e.target.value || null)}
          >
            {!teamId && <option value="">Choose a team…</option>}
            {allTeams.map((t) => (
              <option key={t.id} value={t.id}>
                {teamLabel(t)}
              </option>
            ))}
          </select>
        </div>
      )}

      {isLoading ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading your team…</p>
      ) : !teamId ? (
        <Card className="mt-8 border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            {isAdmin
              ? "Pick a team above to view its competition submissions."
              : "You are not assigned to a team yet, so there is nothing to show."}
          </CardContent>
        </Card>
      ) : (
        <FileVault teamId={teamId} sections={COMPETITION_SECTIONS} title="Competitions" />
      )}
    </div>
  );
}
