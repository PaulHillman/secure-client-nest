import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getSubmissionQueue } from "@/lib/module-submissions.functions";
import { decideRequirement } from "@/lib/readiness.functions";
import { moduleForm } from "@/lib/modules";
import { teamPrimaryName } from "@/lib/team-label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Inbox } from "lucide-react";

export function SubmissionReviewCard() {
  const qc = useQueryClient();
  const fetchQueue = useServerFn(getSubmissionQueue);
  const decideFn = useServerFn(decideRequirement);

  const { data } = useQuery({ queryKey: ["submission-queue"], queryFn: () => fetchQueue() });

  const decide = useMutation({
    mutationFn: (v: { teamId: string; key: string; status: "approved" | "needs_revision"; note?: string }) =>
      decideFn({ data: v }),
    onSuccess: () => {
      toast.success("Decision recorded. The Project Manager has been told.");
      void qc.invalidateQueries({ queryKey: ["submission-queue"] });
      void qc.invalidateQueries({ queryKey: ["readiness-board"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const items = data?.items ?? [];

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 font-display text-2xl">
          <Inbox className="h-5 w-5" /> Waiting on you
        </CardTitle>
        <CardDescription>
          Modules teams have sent in. Read the answers, then approve or send back with a note.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground">Nothing is waiting for review right now.</p>
        )}
        {items.map((item) => {
          const form = moduleForm(item.key);
          return (
            <div key={`${item.teamId}-${item.key}`} className="rounded-lg border p-3 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{teamPrimaryName(item.team)}</span>
                <span className="text-xs text-muted-foreground">
                  Section {item.team.section ?? "—"}
                </span>
                <Badge variant="outline">{item.title}</Badge>
                {item.submitCount > 1 && (
                  <Badge variant="outline" className="border-amber-500/30 bg-amber-500/15 text-amber-500">
                    Resubmitted
                  </Badge>
                )}
              </div>

              <dl className="space-y-2 text-sm">
                {(form?.fields ?? []).map((f) => (
                  <div key={f.name}>
                    <dt className="text-xs text-muted-foreground">{f.label}</dt>
                    <dd className="whitespace-pre-wrap">{item.answers[f.name] || "—"}</dd>
                  </div>
                ))}
              </dl>

              <p className="text-xs text-muted-foreground">
                {item.submittedAt ? `Sent ${new Date(item.submittedAt).toLocaleString()}` : ""}
                {item.submittedByName ? ` by ${item.submittedByName}` : ""}
              </p>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ teamId: item.teamId, key: item.key, status: "approved" })}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={decide.isPending}
                  onClick={() => {
                    const note = window.prompt("What needs fixing?") ?? "";
                    if (!note.trim()) return;
                    decide.mutate({
                      teamId: item.teamId,
                      key: item.key,
                      status: "needs_revision",
                      note,
                    });
                  }}
                >
                  Send back
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
