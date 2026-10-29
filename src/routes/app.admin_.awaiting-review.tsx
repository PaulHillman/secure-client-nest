import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { decideRequirement } from "@/lib/readiness.functions";
import type { ReadinessStatus } from "@/lib/readiness";
import type { AwaitingManager, AwaitingPeerDecision } from "@/lib/awaiting-review";
import { PeerDecisionReviewDialog } from '@/components/peer-decision-review-dialog';
import { SubmissionReviewDialog } from "@/components/submission-review-dialog";
import { ManagerReviewDialog } from "@/components/manager-review-dialog";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { teamLineLabel } from "@/lib/team-label";
import { useAuth } from "@/lib/auth-context";
import { fetchAwaitingReview } from "@/lib/awaiting-review";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardCheck, Building2, UserCheck } from "lucide-react";

export const Route = createFileRoute("/app/admin_/awaiting-review")({
  head: () => ({
    meta: [
      { title: "Awaiting Review — ClientVault Admin" },
      {
        name: "description",
        content: "Everything waiting on the instructor: requirement submissions, manager approvals, and peer-review decisions.",
      },
      { property: "og:title", content: "Awaiting Review — ClientVault Admin" },
      {
        property: "og:description",
        content: "One queue of every item waiting on the instructor, oldest first.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function fmtWaiting(iso: string | null) {
  if (!iso) return "unknown";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

function Page() {
  const { isAdmin, loading } = useAuth();
  const qc = useQueryClient();
  const decideFn = useServerFn(decideRequirement);
  const [reviewing, setReviewing] = useState<{ teamId: string; teamName: string; key: string } | null>(
    null,
  );
  const [reviewingManager, setReviewingManager] = useState<AwaitingManager | null>(null);
  const [reviewingPeer, setReviewingPeer] = useState<AwaitingPeerDecision | null>(null);
  const query = useQuery({
    queryKey: ["awaiting-review"],
    queryFn: fetchAwaitingReview,
    enabled: isAdmin,
  });
  const peerDetails = useQuery({
    queryKey: ["awaiting-review-peer-details"],
    enabled: isAdmin,
    refetchInterval: 30000,
    queryFn: async () => {
      const [meetings, teams] = await Promise.all([
        supabase.from("peer_review_meetings").select("student_id, team_id, scheduled_at").order("scheduled_at"),
        supabase.from("teams").select("id, name, display_name, section"),
      ]);
      if (meetings.error) throw meetings.error;
      if (teams.error) throw teams.error;
      return { meetings: meetings.data, teams: teams.data };
    },
  });
  const decide = useMutation({
    mutationFn: (v: { teamId: string; key: string; status: ReadinessStatus; note?: string }) =>
      decideFn({ data: v }),
    onSuccess: (_d, v) => {
      toast.success(
        v.status === "approved" ? "Approved. The Project Manager has been told." : "Sent back with your note.",
      );
      setReviewing(null);
      void qc.invalidateQueries({ queryKey: ["awaiting-review"] });
      void qc.invalidateQueries({ queryKey: ["submission-queue"] });
      void qc.invalidateQueries({ queryKey: ["readiness-board"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const decideManager = useMutation({
    mutationFn: async (v: { id: string; status: "approved" | "rejected"; note?: string }) => {
      const { error } = await supabase
        .from("manager_submissions")
        .update({ status: v.status, admin_notes: v.note ?? null })
        .eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(
        v.status === "approved"
          ? "Approved. The team can proceed with this client."
          : "Rejected with your note.",
      );
      setReviewingManager(null);
      void qc.invalidateQueries({ queryKey: ["awaiting-review"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (loading) return null;
  if (!isAdmin) return <Navigate to="/app/dashboard" />;

  const data = query.data;

  return (
    <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="font-display text-3xl">Awaiting Review</h1>
        <p className="text-muted-foreground mt-1">
          Everything waiting on you, oldest first. {data?.total ?? 0} item
          {data?.total === 1 ? "" : "s"} outstanding. Click "Review &amp; decide" to read what the
          team sent, then Approve or Send back.
        </p>
      </header>
      {query.error && <p role="alert">{query.error.message}</p>}
      {reviewingPeer && <PeerDecisionReviewDialog item={reviewingPeer} onClose={() => setReviewingPeer(null)} />}
      {reviewing && (
        <SubmissionReviewDialog
          open
          onOpenChange={(o) => !o && setReviewing(null)}
          teamId={reviewing.teamId}
          teamName={reviewing.teamName}
          requirementKey={reviewing.key}
          busy={decide.isPending}
          onDecide={(v) => decide.mutate({ teamId: reviewing.teamId, key: reviewing.key, ...v })}
        />
      )}
      {reviewingManager && (
        <ManagerReviewDialog
          item={reviewingManager}
          busy={decideManager.isPending}
          onDecide={(v) => decideManager.mutate({ id: reviewingManager.id, ...v })}
          onOpenChange={(o) => !o && setReviewingManager(null)}
        />
      )}


      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClipboardCheck className="h-5 w-5 text-gold" />
            Requirement submissions ({data?.requirements.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data?.requirements.length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing submitted awaiting your decision.</p>
          )}
          {data?.requirements.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <span className="font-medium">{r.requirementTitle}</span>
                <span className="text-muted-foreground"> · {r.teamName}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-muted-foreground">
                  waiting {fmtWaiting(r.submittedAt)}
                </span>
                <Button
                  size="sm"
                  onClick={() =>
                    setReviewing({ teamId: r.teamId, teamName: r.teamName, key: r.requirementKey })
                  }
                >
                  Review &amp; decide
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5 text-gold" />
            Manager submissions ({data?.managers.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data?.managers.length === 0 && (
            <p className="text-sm text-muted-foreground">No manager approvals pending.</p>
          )}
          {data?.managers.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <span className="font-medium">{m.managerName}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {m.companyName} · {m.teamName}
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-muted-foreground">
                  waiting {fmtWaiting(m.createdAt)}
                </span>
                <Button size="sm" onClick={() => setReviewingManager(m)}>
                  Review & decide
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserCheck className="h-5 w-5 text-gold" />
            Peer review decisions ({data?.peerDecisions.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data?.peerDecisions.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No third attempts below 8 waiting on a meeting decision.
            </p>
          )}
          {peerDetails.error && <p role="alert" className="text-sm text-destructive">Meeting details could not be loaded: {peerDetails.error.message}</p>}
          {!!data?.peerDecisions.length && (
            <ul className="space-y-3" aria-label="Peer review decisions">
              {data.peerDecisions.map(p => {
                const bookings = peerDetails.data?.meetings.filter(m => m.student_id === p.studentId && m.team_id === p.teamId) ?? [];
                const meeting = bookings.find(m => new Date(m.scheduled_at).getTime() >= Date.now()) ?? bookings.at(-1);
                const team = peerDetails.data?.teams.find(t => t.id === p.teamId);
                const meetingStatus = peerDetails.isPending ? "Loading…" : peerDetails.error ? "Unavailable" : meeting ? "Yes" : p.meetingHeld ? "Held" : "No";
                const meetingDate = meeting
                  ? new Intl.DateTimeFormat("en-US", { timeZone: "America/Detroit", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(meeting.scheduled_at))
                  : peerDetails.isPending ? "Loading…" : peerDetails.error ? "Unavailable" : "—";
                return (
                  <li key={p.id} className="rounded-lg border border-border/60 p-3">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{p.studentName}</p>
                        <p className="truncate text-xs text-muted-foreground">{team ? teamLineLabel(team) : p.teamName}</p>
                      </div>
                      <Button size="sm" className="shrink-0" onClick={() => setReviewingPeer(p)} aria-label={`Review & decide for ${p.studentName}`}>Review &amp; decide</Button>
                    </div>
                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
                      <div><dt className="text-xs text-muted-foreground">Submission #</dt><dd className="tabular-nums">{p.attempt}</dd></div>
                      <div><dt className="text-xs text-muted-foreground">Score</dt><dd className="tabular-nums">{p.score == null ? "Not scored" : `${p.score}/10`}</dd></div>
                      <div><dt className="text-xs text-muted-foreground">Waiting</dt><dd className="text-muted-foreground">{fmtWaiting(p.createdAt)}</dd></div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Meeting scheduled?</dt>
                        <dd>{meetingStatus}{p.meetingHeld && meeting && <span className="block text-xs text-muted-foreground">Meeting held</span>}</dd>
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <dt className="text-xs text-muted-foreground">Date of meeting</dt>
                        <dd>{meeting ? <time dateTime={meeting.scheduled_at}>{meetingDate}</time> : meetingDate}</dd>
                      </div>
                    </dl>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
