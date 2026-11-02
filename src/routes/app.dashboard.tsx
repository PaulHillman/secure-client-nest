import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { DashboardSection } from "@/components/dashboard-section";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { DashboardReadinessNotice } from "@/components/dashboard-readiness-notice";
import { HealthReportBanner } from "@/components/health-report-banner";
import { PeerReviewCriteriaReminder } from "@/components/peer-review-criteria-reminder";


import { ProofsAdminCard } from "@/components/proofs-admin-card";
import { AwaitingReviewCard } from "@/components/awaiting-review-card";



export const Route = createFileRoute("/app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — ClientVault" }, { name: "description", content: "Your ClientVault workspace, team activity and instructor review reminders." }, { property: "og:title", content: "Dashboard — ClientVault" }, { property: "og:description", content: "Team activity and current instructor reminders in ClientVault." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { isAdmin } = useAuth();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const jumpLinks = [
    ...(isAdmin
      ? [
          ["roster", "Students by team"],
          ["contacts", "Client contacts"],
        ]
      : []),
    ["arch", "Project arch"],
    ...(isAdmin
      ? [
          ["meetings", "Meeting gaps"],
          ["consensus", "Meeting consensus"],
          ["activity", "Sign-in / Sign-out log"],
          ["uploads", "File upload activity"],
          ["team-activity", "Team activity dashboard"],
          ["cross-team", "Cross-team comparison"],
          ["flagged", "Flagged students"],
          ["student-score", "Student activity score"],
        ]
      : []),
    ["my-profile", "My profile"],
    ["availability", "My availability"],
    ["my-role", "My role"],
    ...(isAdmin ? [["proofs", "Role practice activities"]] : []),
  ] as [string, string][];

  const toggle = (id: string) => setOpenSections((p) => ({ ...p, [id]: !p[id] }));
  const jumpTo = (id: string) => {
    setOpenSections((p) => ({ ...p, [id]: true }));
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-6">
        <p className="text-sm text-muted-foreground">Welcome back</p>
        <h1 className="font-display text-4xl mt-1">Your workspace</h1>
      </header>

      <nav className="mb-8 flex flex-wrap gap-2 text-sm">
        {jumpLinks.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => jumpTo(id)}
            className="rounded-full border border-border/60 px-3 py-1 text-muted-foreground hover:border-gold hover:text-foreground"
          >
            {label}
          </button>
        ))}
        <Link
          to="/app/milestones"
          className="rounded-full border border-border/60 px-3 py-1 text-muted-foreground hover:border-gold hover:text-foreground"
        >
          Milestones / Deadlines
        </Link>
      </nav>

      <HealthReportBanner />
      <PeerReviewCriteriaReminder />
      <DashboardReadinessNotice />

      {isAdmin && Date.now() >= new Date("2026-10-16T12:00:00Z").getTime() && (
        <div className="mb-6 rounded-lg border border-gold/60 bg-card p-4 text-sm">
          <strong>Reminder:</strong> it's been a few weeks of student usage data — time to review the UI and workflow.{" "}
          <Link to="/app/admin/usage" className="underline text-primary">Open Student Usage</Link>
        </div>
      )}

      {isAdmin && (
        <div className="mb-6">
          <AwaitingReviewCard />
        </div>
      )}

      {isAdmin && (
        <DashboardSection id="roster" open={!!openSections["roster"]} onToggle={() => toggle("roster")}>
          <TeamRosterCard />
        </DashboardSection>
      )}

      {isAdmin && (
        <DashboardSection id="contacts" open={!!openSections["contacts"]} onToggle={() => toggle("contacts")}>
          <ClientContactsCard />
        </DashboardSection>
      )}

      <div id="arch" className="mt-6 scroll-mt-6">
        <ProjectArchCard />
      </div>

      {isAdmin && (
        <DashboardSection id="meetings" open={!!openSections["meetings"]} onToggle={() => toggle("meetings")}>
          <MeetingGapsCard />
        </DashboardSection>
      )}

      {isAdmin && (
        <div id="consensus" className="mt-6 scroll-mt-6">
          <ConsensusStatusCard />
        </div>
      )}

      {isAdmin && (
        <DashboardSection id="activity" open={!!openSections["activity"]} onToggle={() => toggle("activity")}>
          <AuthAuditLogCard />
        </DashboardSection>
      )}

      {isAdmin && (
        <DashboardSection id="uploads" open={!!openSections["uploads"]} onToggle={() => toggle("uploads")}>
          <UploadActivityLogCard />
        </DashboardSection>
      )}

      {isAdmin && (
        <DashboardSection id="team-activity" open={!!openSections["team-activity"]} onToggle={() => toggle("team-activity")}>
          <TeamActivityDashboardCard />
        </DashboardSection>
      )}

      {isAdmin && (
        <DashboardSection id="cross-team" open={!!openSections["cross-team"]} onToggle={() => toggle("cross-team")}>
          <CrossTeamComparisonCard />
        </DashboardSection>
      )}

      {isAdmin && (
        <DashboardSection id="flagged" open={!!openSections["flagged"]} onToggle={() => toggle("flagged")}>
          <SluggoFlagCard />
        </DashboardSection>
      )}

      {isAdmin && (
        <DashboardSection id="student-score" open={!!openSections["student-score"]} onToggle={() => toggle("student-score")}>
          <StudentActivityScoreCard />
        </DashboardSection>
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

      <div className="mt-10">
        <ProfileCompletionCard />
      </div>

      <div id="my-profile" className="mt-6 scroll-mt-6">
        <MyProfileCard />
      </div>

      <div id="availability" className="mt-6 scroll-mt-6">
        <AvailabilityGridCard />
      </div>

      <div id="my-role" className="mt-6 scroll-mt-6">
        <RoleSelectCard />
      </div>

      {isAdmin && (
        <div id="proofs" className="mt-6 scroll-mt-6">
          <ProofsAdminCard />
        </div>
      )}
    </div>
  );
}

