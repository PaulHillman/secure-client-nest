import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarCheck } from "lucide-react";
import { MeetingLogCard } from "@/components/meeting-log-card";
import { ManagerSubmissions } from "@/components/manager-submissions";
import { FileVault } from "@/components/file-vault";

export const Route = createFileRoute("/app/meetings")({
  head: () => ({
    meta: [
      { title: "Weekly Meetings — ClientVault" },
      { name: "description", content: "Log weekly team meetings, post minutes, and manage team files." },
      { property: "og:title", content: "Weekly Meetings — ClientVault" },
      { property: "og:description", content: "Log weekly team meetings, post minutes, and manage team files." },
    ],
  }),
  component: WeeklyMeetings,
});

function WeeklyMeetings() {
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
        <CalendarCheck className="h-6 w-6 text-gold" />
        <h1 className="font-display text-4xl">Weekly Meetings</h1>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Log each week's meeting, post the minutes, and keep your team's files in one place.
      </p>

      {isAdmin && allTeams && allTeams.length > 0 && (
        <div className="mt-4">
          <label className="text-sm font-medium" htmlFor="meetings-team-picker">
            Team
          </label>
          <select
            id="meetings-team-picker"
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
              ? "Pick a team above to view its weekly meetings."
              : "You are not assigned to a team yet, so there are no meetings to show."}
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6">
          <MeetingLogCard teamId={teamId} />
          <ManagerSubmissions teamId={teamId} />
          <FileVault teamId={teamId} />
        </div>
      )}
    </div>
  );
}
