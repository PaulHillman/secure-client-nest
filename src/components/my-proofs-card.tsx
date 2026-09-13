import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { getTeamProofs } from "@/lib/proofs.functions";
import { getTeamNorms } from "@/lib/group-norms.functions";
import { getRoleStudy, toggleRoleStudyItem } from "@/lib/role-study.functions";
import { ROLE_STUDIES, roleStudy } from "@/lib/role-study";
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
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, ChevronsUpDown, Circle, Clock, Lock, RotateCcw } from "lucide-react";

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

const STEP_TONES: Record<number, { card: string; chip: string; bar: string }> = {
  1: { card: "border-sky-500/40 bg-sky-500/5", chip: "bg-sky-500/15 text-sky-700 dark:text-sky-300", bar: "border-sky-500/50" },
  2: { card: "border-emerald-500/40 bg-emerald-500/5", chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", bar: "border-emerald-500/50" },
  3: { card: "border-amber-500/40 bg-amber-500/5", chip: "bg-amber-500/15 text-amber-700 dark:text-amber-300", bar: "border-amber-500/50" },
  4: { card: "border-violet-500/40 bg-violet-500/5", chip: "bg-violet-500/15 text-violet-700 dark:text-violet-300", bar: "border-violet-500/50" },
};

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
  const tone = STEP_TONES[n];
  return (
    <div className={`flex gap-3 rounded-md border border-l-4 p-3 ${tone?.card ?? ""}`}>
      <div className="pt-0.5">
        {done ? (
          <CheckCircle2 className="size-5 text-emerald-600" />
        ) : (
          <Circle className="size-5 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="flex items-center gap-2 font-medium">
          <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${tone?.chip ?? ""}`}>
            Step {n}
          </span>
          {title}
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
  const fetchStudy = useServerFn(getRoleStudy);
  const toggleStudy = useServerFn(toggleRoleStudyItem);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["team-proofs", teamId, viewAs?.id ?? userId],
    queryFn: () => fetchProofs({ data: { teamId, studentId: viewAs?.id } }),
  });

  const { data: norms } = useQuery({
    queryKey: ["group-norms-readiness", teamId, viewAs?.id ?? userId],
    queryFn: () => fetchNorms({ data: { teamId, studentId: viewAs?.id } }),
  });

  const { data: study } = useQuery({
    queryKey: ["role-study", teamId, viewAs?.id ?? userId],
    queryFn: () => fetchStudy({ data: { studentId: viewAs?.id } }),
  });

  const studyMutation = useMutation({
    mutationFn: (v: { index: number; checked: boolean }) =>
      toggleStudy({ data: { teamId, index: v.index, checked: v.checked, studentId: viewAs?.id } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["role-study", teamId] });
      void qc.invalidateQueries({ queryKey: ["dashboard-team-readiness"] });
    },
    onError: (e: Error) => toast.error(e.message),
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
  const studyDone =
    hasRole && (study ? study.itemCount === 0 || study.done : false);
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
            <p className="ml-4 border-l-2 pl-3 text-sm text-muted-foreground sm:ml-6 border-emerald-500/50">
              {hasRole
                ? "No activities are assigned to your role."
                : "Pick your role above and your activities will appear here."}
            </p>
          ) : (
            <div className="ml-4 space-y-2 border-l-2 pl-3 sm:ml-6 border-emerald-500/50">
              {data.mine.map((item) => {
                const proof = proofByKey(item.key);
                if (!proof) return null;
                const done = !!item.submission;
                const approved = item.submission?.reviewStatus === "approved";
                const sentBack = item.submission?.reviewStatus === "sent_back";
                return (
                  <div
                    key={item.key}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3"
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
                              <RotateCcw className="size-4" /> Needs an update
                            </p>
                          ) : (
                            <p className="flex items-center gap-1.5 text-sm text-emerald-600">
                              <CheckCircle2 className="size-4" /> Submitted ·{" "}
                              {new Date(item.submission!.submittedAt).toLocaleString()}
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
                          <details className="mt-1 text-sm">
                            <summary className="cursor-pointer text-muted-foreground">
                              Read your submission
                            </summary>
                            <div className="mt-2 space-y-2">
                              {Object.entries(item.submission!.answers).map(([name, value]) => (
                                <div key={name}>
                                  <p className="font-medium capitalize">
                                    {name.replaceAll("_", " ")}
                                  </p>
                                  <p className="whitespace-pre-wrap text-muted-foreground">{value}</p>
                                </div>
                              ))}
                              {item.submission!.fileName ? (
                                <p className="text-muted-foreground">
                                  Attached file: {item.submission!.fileName}
                                </p>
                              ) : null}
                            </div>
                          </details>
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
                        <Lock className="mr-1 size-3" /> Submitted
                      </Badge>
                    ) : sentBack ? (
                      <Button size="sm" onClick={() => setOpenKey(item.key)}>
                        Update
                      </Button>
                    ) : done ? (
                      <Badge variant="secondary">Submitted</Badge>
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
              meetingDone ? undefined : meeting?.proposal ? (
                <Button size="sm" variant="outline" asChild>
                  <Link to="/app/agreement">Read &amp; sign the agreement</Link>
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => scrollTo("meeting-time")}>
                  Set your meeting time
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
                The Project Manager takes the lead writing this document, gathering input from the
                whole team. Every section, including all three accountability levels, must be filled
                in. Then every member — including the PM — reads and approves it personally.
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
                      : `${p.completed.length} of ${p.assigned.length} done${
                          p.sentBack.length ? ` · ${p.sentBack.length} need an update` : ""
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
