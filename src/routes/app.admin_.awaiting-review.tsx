import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { decideRequirement } from "@/lib/readiness.functions";
import type { ReadinessStatus } from "@/lib/readiness";
import type { AwaitingManager } from "@/lib/awaiting-review";
import { SubmissionReviewDialog } from "@/components/submission-review-dialog";
import { ManagerReviewDialog } from "@/components/manager-review-dialog";
import { Button } from "@/components/ui/button";
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
  const query = useQuery({
    queryKey: ["awaiting-review"],
    queryFn: fetchAwaitingReview,
    enabled: isAdmin,
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
    <main className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6">
      <header>
        <h1 className="font-display text-3xl">Awaiting Review</h1>
        <p className="text-muted-foreground mt-1">
          Everything waiting on you, oldest first. {data?.total ?? 0} item
          {data?.total === 1 ? "" : "s"} outstanding. Click "Review &amp; decide" to read what the
          team sent, then Approve or Send back.
        </p>
      </header>
      {query.error && <p role="alert">{query.error.message}</p>}
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
                <Link to="/app/admin" className="text-primary underline text-xs">
                  Review
                </Link>
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
          {data?.peerDecisions.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <span className="font-medium">{p.studentName}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {p.teamName} · attempt {p.attempt}, scored {p.score ?? "—"}/10 — meeting
                  required
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-muted-foreground">
                  waiting {fmtWaiting(p.createdAt)}
                </span>
                <Link
                  to="/app/admin/peer-review-assessments"
                  className="text-primary underline text-xs"
                >
                  Review
                </Link>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}
