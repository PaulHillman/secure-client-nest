import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, ShieldAlert, CalendarX, BuildingIcon } from "lucide-react";
import { ProjectArchCard } from "@/components/project-arch-card";
import { ConsensusStatusCard } from "@/components/consensus-status-card";
import { MeetingGapsCard } from "@/components/meeting-gaps-card";

import { ClientContactsCard } from "@/components/client-contacts-card";
import { TeamRosterCard } from "@/components/team-roster-card";
import { AuthAuditLogCard } from "@/components/auth-audit-log-card";
import { UploadActivityLogCard } from "@/components/upload-activity-log-card";
import { StudentActivityScoreCard } from "@/components/student-activity-score-card";
import { SluggoFlagCard } from "@/components/sluggo-flag-card";
import { TeamActivityDashboardCard } from "@/components/team-activity-dashboard-card";
import { CrossTeamComparisonCard } from "@/components/cross-team-comparison-card";
import { MyProfileCard } from "@/components/my-profile-card";
import { AvailabilityGridCard } from "@/components/availability-grid-card";
import { ProfileCompletionCard } from "@/components/profile-completion-card";
import { RoleSelectCard } from "@/components/role-select-card";
import { ReadinessBoardCard } from "@/components/readiness-board-card";
import { ProofsAdminCard } from "@/components/proofs-admin-card";
import { SubmissionReviewCard } from "@/components/submission-review-card";


export const Route = createFileRoute("/app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — ClientVault" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user, isAdmin } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["dashboard-gap-stats"],
    queryFn: async () => {
      const [
        { data: teams, error: tErr },
        { data: norms, error: nErr },
        { data: proposals, error: pErr },
        { data: agreements, error: aErr },
        { data: members, error: mErr },
        { data: cf, error: cErr },
        { count: filesCount },
      ] = await Promise.all([
        supabase.from("teams").select("id, name"),
        supabase.from("group_norms").select("team_id, is_locked"),
        supabase.from("team_meeting_proposals").select("id, team_id"),
        supabase.from("team_meeting_agreements").select("proposal_id, status"),
        supabase.from("team_members").select("team_id, user_id"),
        supabase.from("company_focus").select("team_id, company_name, contact_person"),
        supabase.from("files").select("id", { count: "exact", head: true }),
      ]);
      if (tErr) throw tErr;
      if (nErr) throw nErr;
      if (pErr) throw pErr;
      if (aErr) throw aErr;
      if (mErr) throw mErr;
      if (cErr) throw cErr;

      const allTeams = teams ?? [];
      const lockedNorms = new Set(
        (norms ?? []).filter((n) => n.is_locked && n.team_id).map((n) => n.team_id as string),
      );
      const proposalByTeam = new Map(
        (proposals ?? []).filter((p) => p.team_id).map((p) => [p.team_id as string, p]),
      );
      const memberCount = new Map<string, number>();
      (members ?? []).forEach((m) => {
        if (!m.team_id) return;
        memberCount.set(m.team_id, (memberCount.get(m.team_id) ?? 0) + 1);
      });
      const agreedCount = new Map<string, number>();
      (agreements ?? []).forEach((a) => {
        if (a.status === "agreed") {
          agreedCount.set(a.proposal_id, (agreedCount.get(a.proposal_id) ?? 0) + 1);
        }
      });
      const cfByTeam = new Map(
        (cf ?? []).filter((c) => c.team_id).map((c) => [c.team_id as string, c]),
      );

      let normsMissing = 0;
      let meetingMissing = 0;
      let clientMissing = 0;
      for (const t of allTeams) {
        if (!lockedNorms.has(t.id)) normsMissing++;

        const proposal = proposalByTeam.get(t.id);
        const total = memberCount.get(t.id) ?? 0;
        const agreed = proposal ? agreedCount.get(proposal.id) ?? 0 : 0;
        const hasConsensus = !!proposal && total > 0 && agreed >= total;
        if (!hasConsensus) meetingMissing++;

        const c = cfByTeam.get(t.id);
        const hasClient =
          !!c && !!c.company_name?.trim() && !!c.contact_person?.trim();
        if (!hasClient) clientMissing++;
      }

      return {
        totalTeams: allTeams.length,
        normsMissing,
        meetingMissing,
        clientMissing,
        files: filesCount ?? 0,
      };
    },
    enabled: !!user,
  });

  const total = stats?.totalTeams ?? 0;
  const cards = [
    {
      label: "Norms not signed",
      value: stats?.normsMissing ?? "—",
      sub: total ? `of ${total} teams` : "",
      icon: ShieldAlert,
      alert: (stats?.normsMissing ?? 0) > 0,
    },
    {
      label: "No meeting consensus",
      value: stats?.meetingMissing ?? "—",
      sub: total ? `of ${total} teams` : "",
      icon: CalendarX,
      alert: (stats?.meetingMissing ?? 0) > 0,
    },
    {
      label: "Client info incomplete",
      value: stats?.clientMissing ?? "—",
      sub: total ? `of ${total} teams` : "",
      icon: BuildingIcon,
      alert: (stats?.clientMissing ?? 0) > 0,
    },
    {
      label: "Files in Vault",
      value: stats?.files ?? "—",
      sub: "across all teams",
      icon: FileText,
      alert: false,
    },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-10">
        <p className="text-sm text-muted-foreground">Welcome back</p>
        <h1 className="font-display text-4xl mt-1">Your workspace</h1>
      </header>

      {isAdmin && (
        <div className="mb-6 space-y-6">
          <SubmissionReviewCard />
          <ReadinessBoardCard />
          <div id="proofs" className="scroll-mt-6 space-y-6">
            <ProofReviewQueueCard />
            <ProofsAdminCard />
          </div>
        </div>
      )}

      <div className="mb-6">
        <ProfileCompletionCard />
      </div>

      <div className="mb-6">
        <MyProfileCard />
      </div>

      <div className="mt-6">
        <AvailabilityGridCard />
      </div>

      <div className="my-6">
        <RoleSelectCard />
      </div>


      {isAdmin && (
        <nav className="mb-6 flex flex-wrap gap-2 text-sm">
          {[
            ["#proofs", "Role activities"],
            ["#kpis", "Gaps"],
            ["#roster", "Roster"],
            ["#contacts", "Client contacts"],
            ["#arch", "Project arch"],
            ["#meetings", "Meetings"],
            ["#activity", "Activity"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="rounded-full border border-border/60 px-3 py-1 text-muted-foreground hover:border-gold hover:text-foreground"
            >
              {label}
            </a>
          ))}
        </nav>
      )}

      <div id="kpis" className="grid grid-cols-2 lg:grid-cols-4 gap-4 scroll-mt-6">
        {cards.map((c) => (
          <Card key={c.label} className="border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className={`h-4 w-4 ${c.alert ? "text-destructive" : "text-gold"}`} />
            </CardHeader>
            <CardContent>
              <div className={`font-display text-3xl ${c.alert ? "text-destructive" : ""}`}>
                {c.value}
              </div>
              {c.sub && <div className="text-xs text-muted-foreground mt-1">{c.sub}</div>}
            </CardContent>
          </Card>
        ))}
      </div>


      {isAdmin && (
        <div id="roster" className="mt-6 scroll-mt-6">
          <TeamRosterCard />
        </div>
      )}

      {isAdmin && (
        <div className="mt-6">
          <span id="contacts" className="block scroll-mt-6" />
          <ClientContactsCard />
        </div>
      )}

      <div id="arch" className="mt-6 scroll-mt-6">
        <ProjectArchCard />
      </div>

      {isAdmin && (
        <div id="meetings" className="mt-6 scroll-mt-6">
          <MeetingGapsCard />
        </div>
      )}

      {isAdmin && (
        <div className="mt-6">
          <ConsensusStatusCard />
        </div>
      )}


      {isAdmin && (
        <div id="activity" className="mt-6 scroll-mt-6">
          <AuthAuditLogCard />
        </div>
      )}

      {isAdmin && (
        <div className="mt-6">
          <UploadActivityLogCard />
        </div>
      )}

      {isAdmin && (
        <div className="mt-6">
          <TeamActivityDashboardCard />
        </div>
      )}

      {isAdmin && (
        <div className="mt-6">
          <CrossTeamComparisonCard />
        </div>
      )}

      {isAdmin && (
        <div className="mt-6">
          <SluggoFlagCard />
        </div>
      )}

      {isAdmin && (
        <div className="mt-6">
          <StudentActivityScoreCard />
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
