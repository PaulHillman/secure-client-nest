import { teamLabel } from "@/lib/team-label";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StudentName } from "@/components/student-avatar";
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
          supabase.from("profiles").select("id, name, email, avatar_url"),
        ]);
      if (tErr) throw tErr;
      if (mErr) throw mErr;
      if (pErr) throw pErr;
      if (aErr) throw aErr;

      const profById = new Map((profiles ?? []).map((p) => [p.id, p]));
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
          .map((id) => ({
            id,
            name: profById.get(id)?.name ?? "Unknown",
            email: profById.get(id)?.email ?? null,
            avatarUrl: profById.get(id)?.avatar_url ?? null,
          }));
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
                  {t.proposal ? (
                    <div className="text-xs text-muted-foreground">
                      {DAYS[t.proposal.day_of_week]} {t.proposal.meeting_time.slice(0, 5)}
                      {t.proposal.location ? ` · ${t.proposal.location}` : ""}
                      {t.proposal.meeting_mode ? ` · ${t.proposal.meeting_mode}` : ""}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground italic">No proposal yet</div>
                  )}
                  {t.outstanding.length > 0 && (
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-amber-700">
                      <span>Waiting on:</span>
                      {t.outstanding.map((o) => (
                        <StudentName key={o.id} name={o.name} email={o.email} avatarUrl={o.avatarUrl} size={20} />
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap">
                  {t.agreed}/{t.total} signed
                </div>
              </li>

            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
