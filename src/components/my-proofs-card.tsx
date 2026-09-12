import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getTeamProofs } from "@/lib/proofs.functions";
import { FEEDBACK_STATUS_LABEL, proofByKey, proofMaxScore } from "@/lib/proofs";
import { ProofDialog } from "@/components/proof-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { StudentName } from "@/components/student-avatar";
import { CheckCircle2, ChevronsUpDown, Clock, Lock, RotateCcw } from "lucide-react";

/**
 * The student's own role activities, and — for anyone on the team — a roll-up
 * of who still owes theirs, so the PM can chase without the professor doing it.
 */
export function MyProofsCard({ teamId, userId }: { teamId: string; userId: string }) {
  const qc = useQueryClient();
  const fetchProofs = useServerFn(getTeamProofs);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["team-proofs", teamId],
    queryFn: () => fetchProofs({ data: { teamId } }),
  });

  if (!data) return null;
  const refresh = () => void qc.invalidateQueries({ queryKey: ["team-proofs", teamId] });

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Role practice activities</CardTitle>
          <CardDescription>
            Short individual exercises for your role. Each one is submitted once, and submitting it
            completes it. You get written coaching straight away, including anything you missed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.mine.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {data.myRole && data.myRole !== "Unassigned"
                ? "No activities are assigned to your role."
                : "Pick your role above and your activities will appear here."}
            </p>
          ) : (
            <div className="space-y-2">
              {data.mine.map((item) => {
                const proof = proofByKey(item.key);
                if (!proof) return null;
                const done = !!item.submission;
                const approved = item.submission?.reviewStatus === "approved";
                const sentBack = item.submission?.reviewStatus === "sent_back";
                return (
                  <div
                    key={item.key}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-md border p-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="flex items-center gap-2 font-medium">
                        {proof.title}
                        <span className="text-xs font-normal text-muted-foreground">
                          {proof.alias}
                        </span>
                      </p>
                      {done ? (
                        <>
                          {sentBack ? (
                            <p className="flex items-center gap-1.5 text-sm text-amber-600">
                              <RotateCcw className="size-4" /> Sent back by your professor
                            </p>
                          ) : approved ? (
                            <p className="flex items-center gap-1.5 text-sm text-emerald-600">
                              <CheckCircle2 className="size-4" /> Approved ·{" "}
                              {new Date(item.submission!.submittedAt).toLocaleString()}
                            </p>
                          ) : (
                            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Clock className="size-4" /> Submitted, awaiting your professor's
                              review · {new Date(item.submission!.submittedAt).toLocaleString()}
                            </p>
                          )}
                          {item.submission!.reviewNote ? (
                            <p className="rounded-md bg-muted p-2 text-sm">
                              <span className="font-medium">What to fix: </span>
                              {item.submission!.reviewNote}
                            </p>
                          ) : null}
                          {item.submission!.score != null ? (
                            <p className="text-sm font-medium">
                              You captured {item.submission!.score} of{" "}
                              {proofMaxScore(item.key)} key points — anything you missed is
                              listed in your feedback below.
                            </p>
                          ) : null}
                          <p className="text-xs text-muted-foreground">
                            {FEEDBACK_STATUS_LABEL[item.submission!.feedbackStatus] ??
                              "Feedback pending"}
                          </p>
                          {item.submission!.feedback ? (
                            <details className="mt-1 text-sm">
                              <summary className="cursor-pointer text-muted-foreground">
                                Read your feedback
                              </summary>
                              <p className="mt-1 whitespace-pre-wrap">
                                {item.submission!.feedback}
                              </p>
                            </details>
                          ) : null}
                        </>
                      ) : item.open ? (
                        <p className="text-sm text-muted-foreground">Not submitted</p>
                      ) : (
                        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Clock className="size-4" /> Waiting on course material from your
                          professor
                        </p>
                      )}
                    </div>
                    {approved ? (
                      <Badge variant="secondary">
                        <Lock className="mr-1 size-3" /> Approved
                      </Badge>
                    ) : sentBack ? (
                      <Button size="sm" onClick={() => setOpenKey(item.key)}>
                        Fix and resend
                      </Button>
                    ) : done ? (
                      <Badge variant="secondary">Awaiting review</Badge>
                    ) : (
                      <Button size="sm" disabled={!item.open} onClick={() => setOpenKey(item.key)}>
                        Start
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm">
                <ChevronsUpDown className="mr-2 size-4" /> Team progress
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-2">
              {data.people.map((p) => (
                <div
                  key={p.userId}
                  className="flex items-center justify-between gap-3 rounded-md border p-2 text-sm"
                >
                  <StudentName name={p.name} avatarUrl={p.avatarUrl} />
                  <span className="text-muted-foreground">
                    {p.assigned.length === 0
                      ? "Needs a role"
                      : `${p.approved.length} of ${p.assigned.length} approved${
                          p.sentBack.length ? ` · ${p.sentBack.length} sent back` : ""
                        }`}
                  </span>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      <ProofDialog
        key={openKey ?? "none"}
        teamId={teamId}
        userId={userId}
        proofKey={openKey}
        initialAnswers={
          data.mine.find((m) => m.key === openKey)?.submission?.answers as
            | Record<string, string>
            | undefined
        }
        sentBackNote={
          data.mine.find((m) => m.key === openKey)?.submission?.reviewNote ?? null
        }
        onClose={() => setOpenKey(null)}
        onSubmitted={refresh}
      />
    </>
  );
}
