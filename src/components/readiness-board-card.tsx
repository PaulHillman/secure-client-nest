import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  decideRequirement,
  getReadinessBoard,
  nudgeMember,
  setRequirementOpening,
} from "@/lib/readiness.functions";
import { READINESS_LABEL, READINESS_TONE, type ReadinessStatus } from "@/lib/readiness";
import { teamPrimaryName } from "@/lib/team-label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SubmissionReviewDialog } from "@/components/submission-review-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { BellRing, LayoutGrid, PlayCircle, XCircle } from "lucide-react";

const ALL = "__all__";

export function ReadinessBoardCard() {
  const qc = useQueryClient();
  const fetchBoard = useServerFn(getReadinessBoard);
  const openFn = useServerFn(setRequirementOpening);
  const decideFn = useServerFn(decideRequirement);
  const nudgeFn = useServerFn(nudgeMember);

  const [section, setSection] = useState<string>(ALL);
  const [view, setView] = useState<"active" | "needs" | "closed">("active");
  const [review, setReview] = useState<{ teamId: string; teamName: string; key: string } | null>(
    null,
  );
  const [kickoffKey, setKickoffKey] = useState<string>("");
  const [dueAt, setDueAt] = useState<string>("");
  const [nudge, setNudge] = useState<{
    teamId: string;
    teamName: string;
    key: string;
    title: string;
    targetUserId: string;
  } | null>(null);
  const [nudgeNote, setNudgeNote] = useState("");

  const { data } = useQuery({ queryKey: ["readiness-board"], queryFn: () => fetchBoard() });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["readiness-board"] });
    void qc.invalidateQueries({ queryKey: ["team-readiness"] });
  };

  const kickoff = useMutation({
    mutationFn: (v: { open: boolean }) =>
      openFn({
        data: {
          key: kickoffKey,
          sections: section === ALL ? data?.sections ?? [] : [section],
          open: v.open,
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        },
      }),
    onSuccess: (r) => {
      toast.success(r.opened ? `Opened for ${r.opened} section(s).` : `Closed for ${r.closed} section(s).`);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const decide = useMutation({
    mutationFn: (v: { teamId: string; key: string; status: ReadinessStatus; note?: string }) =>
      decideFn({ data: v }),
    onSuccess: () => {
      toast.success("Decision recorded. The Project Manager has been told.");
      setReview(null);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendNudge = useMutation({
    mutationFn: () =>
      nudgeFn({
        data: {
          teamId: nudge!.teamId,
          key: nudge!.key,
          targetUserId: nudge!.targetUserId,
          message: nudgeNote.trim() || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Nudge sent by email and in the app.");
      setNudge(null);
      setNudgeNote("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = useMemo(
    () => (data?.rows ?? []).filter((r) => section === ALL || r.team.section === section),
    [data, section],
  );

  type Cell = (typeof rows)[number]["cells"][number];
  const inView = (cell: Cell) => {
    if (view === "needs") return cell.status === "submitted";
    if (view === "closed") return cell.closed;
    return cell.open && !cell.closed;
  };

  // Only show module columns that have something to see in the current view.
  const columns = (data?.requirements ?? []).filter((r) =>
    rows.some((row) => row.cells.some((c) => c.key === r.key && inView(c))),
  );

  if (!data) return null;

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 font-display text-2xl">
          <LayoutGrid className="h-5 w-5" /> Team readiness
        </CardTitle>
        <CardDescription>
          One row per team. Open a module for a section to make it visible to students, set the due
          date, then approve or send work back.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ["active", "Active"],
              ["needs", "Needs action"],
              ["closed", "Closed"],
            ] as const
          ).map(([v, label]) => (
            <Button
              key={v}
              size="sm"
              variant={view === v ? "default" : "outline"}
              onClick={() => setView(v)}
            >
              {label}
            </Button>
          ))}
          <span className="text-xs text-muted-foreground">
            {view === "active"
              ? "Modules open now and not past their due date."
              : view === "needs"
                ? "Submitted work waiting on your decision, open or closed."
                : "Past their due date — read-only for teams, still reviewable by you."}
          </span>
        </div>

        <div className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Section</label>
            <Select value={section} onValueChange={setSection}>
              <SelectTrigger className="h-9 w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All sections</SelectItem>
                {data.sections.map((s) => (
                  <SelectItem key={s} value={s}>
                    Section {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Module</label>
            <Select value={kickoffKey} onValueChange={setKickoffKey}>
              <SelectTrigger className="h-9 w-[220px]">
                <SelectValue placeholder="Pick a module" />
              </SelectTrigger>
              <SelectContent>
                {data.requirements.map((r) => (
                  <SelectItem key={r.key} value={r.key}>
                    {r.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Due</label>
            <Input
              type="datetime-local"
              className="h-9 w-[210px]"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
          </div>
          <Button
            size="sm"
            disabled={!kickoffKey || kickoff.isPending}
            onClick={() => kickoff.mutate({ open: true })}
          >
            <PlayCircle className="mr-1 h-4 w-4" /> Open
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!kickoffKey || kickoff.isPending}
            onClick={() => kickoff.mutate({ open: false })}
          >
            <XCircle className="mr-1 h-4 w-4" /> Close
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Team</th>
                {data.requirements.map((r) => (
                  <th key={r.key} className="px-2 py-2 font-medium whitespace-nowrap">
                    {r.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.team.id} className="border-b last:border-0 align-top">
                  <td className="py-2 pr-3">
                    <div className="font-medium">{teamPrimaryName(row.team)}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.team.display_name ? `${row.team.name} · ` : ""}
                      Section {row.team.section ?? "—"}
                    </div>
                    {row.needsRoleCount > 0 && (
                      <Badge
                        variant="outline"
                        className="mt-1 border-amber-500/30 bg-amber-500/15 text-amber-500"
                      >
                        {row.needsRoleCount} needs a role
                      </Badge>
                    )}
                  </td>
                  {row.cells.map((cell) => (
                    <td key={cell.key} className="px-2 py-2">
                      {!cell.open ? (
                        <span className="text-xs text-muted-foreground">Not opened</span>
                      ) : (
                        <div className="space-y-1">
                          {cell.status === "submitted" ? (
                            <button
                              type="button"
                              title="Review their work"
                              onClick={() =>
                                setReview({
                                  teamId: row.team.id,
                                  teamName: teamPrimaryName(row.team),
                                  key: cell.key,
                                })
                              }
                            >
                              <Badge
                                variant="outline"
                                className={`${READINESS_TONE[cell.status]} cursor-pointer underline-offset-2 hover:underline`}
                              >
                                {READINESS_LABEL[cell.status]}
                              </Badge>
                            </button>
                          ) : (
                            <Badge variant="outline" className={READINESS_TONE[cell.status]}>
                              {READINESS_LABEL[cell.status]}
                            </Badge>
                          )}
                          {cell.overdue && (
                            <div className="text-[11px] text-rose-400">Overdue</div>
                          )}
                          {cell.status === "submitted" && (
                            <div className="pt-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 px-2 text-[11px]"
                                onClick={() =>
                                  setReview({
                                    teamId: row.team.id,
                                    teamName: teamPrimaryName(row.team),
                                    key: cell.key,
                                  })
                                }
                              >
                                Review
                              </Button>
                            </div>
                          )}
                          {cell.status !== "approved" && row.members.length > 0 && (
                            <div className="pt-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-[11px]"
                                title="Remind someone on this team"
                                onClick={() => {
                                  setNudgeNote("");
                                  setNudge({
                                    teamId: row.team.id,
                                    teamName: teamPrimaryName(row.team),
                                    key: cell.key,
                                    title:
                                      data.requirements.find((r) => r.key === cell.key)?.title ??
                                      cell.key,
                                    targetUserId: cell.ownerId ?? row.members[0].userId,
                                  });
                                }}
                              >
                                <BellRing className="mr-1 h-3 w-3" /> Nudge
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {review && (
          <SubmissionReviewDialog
            open
            onOpenChange={(o) => !o && setReview(null)}
            teamId={review.teamId}
            teamName={review.teamName}
            requirementKey={review.key}
            busy={decide.isPending}
            onDecide={(v) =>
              decide.mutate({
                teamId: review.teamId,
                key: review.key,
                status: v.status,
                note: v.note,
              })
            }
          />
        )}

        <Dialog open={!!nudge} onOpenChange={(v) => !v && setNudge(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nudge {nudge?.teamName}</DialogTitle>
              <DialogDescription>
                {nudge?.title}: they get a reminder in the app and an email. Add a note if you want
                to say something specific.
              </DialogDescription>
            </DialogHeader>
            <Select
              value={nudge?.targetUserId ?? ""}
              onValueChange={(v) => nudge && setNudge({ ...nudge, targetUserId: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Who should be nudged?" />
              </SelectTrigger>
              <SelectContent>
                {(rows.find((r) => r.team.id === nudge?.teamId)?.members ?? []).map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>
                    {m.name} · {m.jobTitle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              value={nudgeNote}
              onChange={(e) => setNudgeNote(e.target.value)}
              placeholder="Optional note, e.g. what you need from them and by when."
              rows={4}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setNudge(null)}>
                Cancel
              </Button>
              <Button
                disabled={sendNudge.isPending || !nudge?.targetUserId}
                onClick={() => sendNudge.mutate()}
              >
                <BellRing className="mr-1 h-3.5 w-3.5" /> Send nudge
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
