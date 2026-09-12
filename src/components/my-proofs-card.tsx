import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { getTeamProofs } from "@/lib/proofs.functions";
import { getTeamNorms } from "@/lib/group-norms.functions";
import { supabase } from "@/integrations/supabase/client";
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
import { CheckCircle2, ChevronsUpDown, Circle, Clock, Lock, RotateCcw } from "lucide-react";

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function Step({
  n,
  title,
  done,
  children,
  action,
}: {
  n: number;
  title: string;
  done: boolean;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 rounded-md border p-3">
      <div className="pt-0.5">
        {done ? (
          <CheckCircle2 className="size-5 text-emerald-600" />
        ) : (
          <Circle className="size-5 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="font-medium">
          Step {n} · {title}
        </p>
        <div className="space-y-2 text-sm text-muted-foreground">{children}</div>
        {action}
      </div>
    </div>
  );
}

/**
 * Team Readiness: the four things each member finishes before the team is
 * allowed to meet with the professor — role, role proof points, the meeting
 * commitment, and the group norms document.
 */
export function MyProofsCard({ teamId, userId }: { teamId: string; userId: string }) {
  const { viewAs } = useAuth();
  const qc = useQueryClient();
  const fetchProofs = useServerFn(getTeamProofs);
  const fetchNorms = useServerFn(getTeamNorms);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["team-proofs", teamId],
    queryFn: () => fetchProofs({ data: { teamId, studentId: viewAs?.id } }),
  });

  const { data: norms } = useQuery({
    queryKey: ["group-norms", teamId],
    queryFn: () => fetchNorms({ data: { teamId, studentId: viewAs?.id } }),
  });

  const { data: meeting } = useQuery({
    queryKey: ["meeting-commitment", teamId, userId],
    queryFn: async () => {
      const { data: proposal } = await supabase
        .from("team_meeting_proposals")
        .select("id, day_of_week, meeting_time")
        .eq("team_id", teamId)
        .maybeSingle();
      if (!proposal) return { proposal: null, mine: null as { status: string } | null };
      const { data: mine } = await supabase
        .from("team_meeting_agreements")
        .select("status, responded_at")
        .eq("proposal_id", proposal.id)
        .eq("user_id", userId)
        .maybeSingle();
      return { proposal, mine };
    },
  });

  if (!data) return null;
  const refresh = () => void qc.invalidateQueries({ queryKey: ["team-proofs", teamId] });

  const hasRole = !!data.myRole && data.myRole !== "Unassigned";
  const proofsDone = data.mine.length > 0 && data.mine.every((m) => !!m.submission);
  const meetingDone = meeting?.mine?.status === "agreed";
  const normsDone = !!norms?.complete && !!norms?.myApprovalAt;
  const steps = [hasRole, proofsDone, meetingDone, normsDone];
  const doneCount = steps.filter(Boolean).length;

  return (
    <>
      <Card id="team-readiness" className="scroll-mt-4">
        <CardHeader>
          <CardTitle>Team Readiness</CardTitle>
          <CardDescription>
            Every member of the team must finish all four steps below before the team is allowed to
            meet with Prof Hillman. You have finished {doneCount} of 4.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Step
            n={1}
            title="Know your role"
            done={hasRole}
            action={
              hasRole ? undefined : (
                <Button size="sm" variant="outline" onClick={() => scrollTo("your-role")}>
                  Choose your role
                </Button>
              )
            }
          >
            {hasRole ? (
              <p>
                You are the team's <span className="font-medium text-foreground">{data.myRole}</span>
                . The activities in step 2 are exactly what this role is expected to deliver.
              </p>
            ) : (
              <p>Your role has not been set yet. Pick it first — everything else follows from it.</p>
            )}
          </Step>

          <Step
            n={2}
            title="Work through your role's proof points"
            done={proofsDone}
          >
            <p>
              Short individual exercises for your role. Each one is submitted once, and submitting it
              completes it. You get written coaching straight away, including anything you missed.
            </p>
          </Step>

          {data.mine.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {hasRole
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

          <Step
            n={3}
            title="Confirm your meeting commitment"
            done={!!meetingDone}
            action={
              meetingDone ? undefined : (
                <Button size="sm" variant="outline" onClick={() => scrollTo("meeting-time")}>
                  {meeting?.proposal ? "Agree to the meeting time" : "Set your meeting time"}
                </Button>
              )
            }
          >
            {meetingDone ? (
              <p>
                You have agreed to your team's standing meeting time. Keep it — the team is counting
                on you being there.
              </p>
            ) : meeting?.proposal ? (
              <p>Your team has proposed a standing meeting time. Read it and agree to it.</p>
            ) : (
              <p>
                Your team has not settled on a standing meeting time yet. The Project Manager
                proposes it, then everyone agrees.
              </p>
            )}
          </Step>

          <Step
            n={4}
            title="Write and approve your Group Norms"
            done={normsDone}
            action={
              normsDone ? undefined : (
                <Button size="sm" variant="outline" onClick={() => scrollTo("group-norms")}>
                  {norms?.complete
                    ? "Read and approve the group norms"
                    : norms?.exists
                      ? "Finish the group norms"
                      : "Start the group norms"}
                </Button>
              )
            }
          >
            {normsDone ? (
              <p>
                You have approved version {norms?.version} of your team's group norms. If the wording
                changes, everyone approves again.
              </p>
            ) : !norms?.exists || !norms?.complete ? (
              <p>
                Your team has not finished its group norms document yet. Write your agreements
                together — every section, including all three accountability levels — then each
                member reads and approves it personally.
              </p>
            ) : (
              <p>
                The document is written and waiting for you. Read it and approve it yourself — nobody
                can approve on your behalf.
              </p>
            )}
          </Step>


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
