import { teamLabel } from "@/lib/team-label";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, AlertTriangle, CheckCircle2 } from "lucide-react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ConsensusStatusCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-consensus"],
    queryFn: async () => {
      const [{ data: teams, error: tErr }, { data: proposals, error: pErr }] =
        await Promise.all([
          supabase.from("teams").select("id, name, section").eq("is_test", false),
          supabase.from("team_meeting_proposals").select("*"),
        ]);
      if (tErr) throw tErr;
      if (pErr) throw pErr;

      const proposalByTeam = new Map((proposals ?? []).map((p) => [p.team_id, p]));

      return (teams ?? []).map((t) => {
        const proposal = proposalByTeam.get(t.id) as any;
        return {
          id: t.id,
          name: teamLabel(t),
          proposal,
          hasMeetingTime: !!proposal,
        };
      });
    },
  });


  const teams = data ?? [];
  const withoutMeetingTime = teams.filter((t) => !t.hasMeetingTime);

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="font-display text-2xl flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-gold" />
          Weekly meeting times
        </CardTitle>
        <Badge variant={withoutMeetingTime.length === 0 ? "default" : "destructive"}>
          {withoutMeetingTime.length} of {teams.length} missing
        </Badge>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : teams.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No teams yet.</p>
        ) : withoutMeetingTime.length === 0 ? (
          <p className="text-sm text-emerald-700 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> Every team has a weekly meeting time set.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {withoutMeetingTime.map((t) => (
              <li key={t.id} className="p-3 flex items-start gap-3">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-1" />
                <div className="flex-1 min-w-0">
                  <Link
                    to="/app/teams/$teamId"
                    params={{ teamId: t.id }}
                    className="font-medium hover:underline block truncate"
                  >
                    {t.name}
                  </Link>
                  <div className="text-xs text-muted-foreground italic">No meeting time set yet</div>
                </div>
              </li>

            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
