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
      const [{ data: teams, error: tErr }, { data: members, error: mErr }, { data: proposals, error: pErr }, { data: agreements, error: aErr }, { data: profiles }] =
        await Promise.all([
          supabase.from("teams").select("id, name, section"),
          supabase.from("team_members").select("team_id, user_id"),
          supabase.from("team_meeting_proposals").select("*"),
          supabase.from("team_meeting_agreements").select("proposal_id, user_id, status"),
          supabase.from("profiles").select("id, name"),
        ]);
      if (tErr) throw tErr;
      if (mErr) throw mErr;
      if (pErr) throw pErr;
      if (aErr) throw aErr;

      const nameById = new Map((profiles ?? []).map((p) => [p.id, p.name]));
      const membersByTeam = new Map<string, string[]>();
      (members ?? []).forEach((m) => {
        membersByTeam.set(m.team_id, [...(membersByTeam.get(m.team_id) ?? []), m.user_id]);
      });
      const proposalByTeam = new Map((proposals ?? []).map((p) => [p.team_id, p]));
      const agreedByProposal = new Map<string, Set<string>>();
      (agreements ?? []).forEach((a) => {
        if (a.status === "agreed") {
          const set = agreedByProposal.get(a.proposal_id) ?? new Set<string>();
          set.add(a.user_id);
          agreedByProposal.set(a.proposal_id, set);
        }
      });

      return (teams ?? []).map((t) => {
        const proposal = proposalByTeam.get(t.id) as any;
        const memberIds = membersByTeam.get(t.id) ?? [];
        const total = memberIds.length;
        const agreedSet = proposal ? agreedByProposal.get(proposal.id) ?? new Set<string>() : new Set<string>();
        const agreed = memberIds.filter((id) => agreedSet.has(id)).length;
        const outstanding = memberIds
          .filter((id) => !agreedSet.has(id))
          .map((id) => nameById.get(id) ?? "Unknown");
        const hasConsensus = !!proposal && total > 0 && agreed >= total;
        return {
          id: t.id,
          name: teamLabel(t),
          proposal,
          total,
          agreed,
          outstanding,
          hasConsensus,
        };
      });
    },
  });


  const teams = data ?? [];
  const withoutConsensus = teams.filter((t) => !t.hasConsensus);

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="font-display text-2xl flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-gold" />
          Meeting time consensus
        </CardTitle>
        <Badge variant={withoutConsensus.length === 0 ? "default" : "destructive"}>
          {withoutConsensus.length} of {teams.length} pending
        </Badge>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : teams.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No teams yet.</p>
        ) : withoutConsensus.length === 0 ? (
          <p className="text-sm text-emerald-700 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> Every team has reached consensus.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {withoutConsensus.map((t) => (
              <li key={t.id} className="p-3 flex items-center gap-3">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                <Link
                  to="/app/teams/$teamId"
                  params={{ teamId: t.id }}
                  className="font-medium hover:underline flex-1 min-w-0 truncate"
                >
                  {t.name}
                </Link>
                <div className="text-xs text-muted-foreground">
                  {t.proposal ? (
                    <>
                      {DAYS[t.proposal.day_of_week]} {t.proposal.meeting_time.slice(0, 5)} ·{" "}
                      {t.agreed}/{t.total} agreed
                    </>
                  ) : (
                    <span className="italic">No proposal yet</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
