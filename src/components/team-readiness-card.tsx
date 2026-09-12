import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getTeamReadiness,
  nudgeMember,
  setRequirementOwner,
  setRequirementStatus,
} from "@/lib/readiness.functions";
import { READINESS_LABEL, READINESS_TONE, TEAM_SETTABLE, type ReadinessStatus } from "@/lib/readiness";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StudentName } from "@/components/student-avatar";
import { ModuleSubmissionDialog } from "@/components/module-submission-dialog";
import { moduleForm } from "@/lib/modules";
import { AlertTriangle, BellRing, ClipboardCheck, Clock, FileText } from "lucide-react";

const UNOWNED = "__none__";

export function TeamReadinessCard({ teamId }: { teamId: string }) {
  const qc = useQueryClient();
  const fetchBoard = useServerFn(getTeamReadiness);
  const saveStatus = useServerFn(setRequirementStatus);
  const saveOwner = useServerFn(setRequirementOwner);
  const nudge = useServerFn(nudgeMember);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [formItem, setFormItem] = useState<{ key: string; title: string } | null>(null);

  const { data } = useQuery({
    queryKey: ["team-readiness", teamId],
    queryFn: () => fetchBoard({ data: { teamId } }),
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["team-readiness", teamId] });
    void qc.invalidateQueries({ queryKey: ["readiness-board"] });
  };

  const statusMutation = useMutation({
    mutationFn: (v: { key: string; status: ReadinessStatus }) =>
      saveStatus({ data: { teamId, key: v.key, status: v.status } }),
    onSuccess: () => {
      toast.success("Progress updated.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setBusyKey(null),
  });

  const ownerMutation = useMutation({
    mutationFn: (v: { key: string; ownerId: string | null }) =>
      saveOwner({ data: { teamId, key: v.key, ownerId: v.ownerId } }),
    onSuccess: () => {
      toast.success("Owner set.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const nudgeMutation = useMutation({
    mutationFn: (v: { key: string; targetUserId: string }) =>
      nudge({ data: { teamId, key: v.key, targetUserId: v.targetUserId } }),
    onSuccess: () => toast.success("Nudge sent."),
    onError: (e: Error) => toast.error(e.message),
  });

  if (!data) return null;

  const open = data.items.filter((i) => i.open);
  const canDrive = data.isPM || data.isAdmin;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 font-display text-xl">
          <ClipboardCheck className="h-5 w-5" /> Where your team stands
        </CardTitle>
        <CardDescription>
          {open.length
            ? "Each item shows its state and who on the team owns it. The Project Manager assigns owners and chases them."
            : "Nothing has been opened for your section yet. Your professor will open the first module when it is time."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.needsRole.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-500">
              <AlertTriangle className="h-4 w-4" /> Needs a role
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Team setup cannot be submitted until everyone has picked a role.
            </p>
            <div className="mt-2 space-y-2">
              {data.needsRole.map((m) => (
                <div key={m.userId} className="flex items-center justify-between gap-2">
                  <StudentName name={m.name} avatarUrl={m.avatarUrl} size={24} />
                  {canDrive && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={nudgeMutation.isPending}
                      onClick={() =>
                        nudgeMutation.mutate({ key: "team_setup", targetUserId: m.userId })
                      }
                    >
                      <BellRing className="mr-1 h-3.5 w-3.5" /> Nudge
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {open.map((item) => (
          <div key={item.key} className="rounded-lg border p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{item.title}</span>
                  {item.alias && item.alias !== item.title && (
                    <span className="text-xs text-muted-foreground">({item.alias})</span>
                  )}
                  <Badge variant="outline" className={READINESS_TONE[item.status]}>
                    {READINESS_LABEL[item.status]}
                  </Badge>
                  {item.overdue && (
                    <Badge variant="outline" className="border-rose-500/30 bg-rose-500/15 text-rose-400">
                      Overdue
                    </Badge>
                  )}
                </div>
                {item.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                )}
                {item.dueAt && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" /> Due {new Date(item.dueAt).toLocaleString()}
                  </p>
                )}
                {item.revisionNote && (
                  <p className="mt-1 text-sm text-rose-400">Sent back: {item.revisionNote}</p>
                )}
                {item.blockers.length > 0 && (
                  <p className="mt-1 text-sm text-amber-500">
                    Waiting on a role from: {item.blockers.join(", ")}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={item.status}
                disabled={item.status === "approved" || busyKey === item.key}
                onValueChange={(v) => {
                  setBusyKey(item.key);
                  statusMutation.mutate({ key: item.key, status: v as ReadinessStatus });
                }}
              >
                <SelectTrigger className="h-8 w-[170px] text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEAM_SETTABLE.map((s) => (
                    <SelectItem key={s} value={s}>
                      {READINESS_LABEL[s]}
                    </SelectItem>
                  ))}
                  {item.status === "approved" && <SelectItem value="approved">Approved</SelectItem>}
                  {item.status === "needs_revision" && (
                    <SelectItem value="needs_revision">Needs revision</SelectItem>
                  )}
                </SelectContent>
              </Select>

              <Select
                value={item.ownerId ?? UNOWNED}
                disabled={!canDrive}
                onValueChange={(v) =>
                  ownerMutation.mutate({ key: item.key, ownerId: v === UNOWNED ? null : v })
                }
              >
                <SelectTrigger className="h-8 w-[210px] text-sm">
                  <SelectValue placeholder="Who owns this?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNOWNED}>No owner yet</SelectItem>
                  {data.members.map((m) => (
                    <SelectItem key={m.userId} value={m.userId}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {canDrive && item.ownerId && item.status !== "approved" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={nudgeMutation.isPending}
                  onClick={() =>
                    nudgeMutation.mutate({ key: item.key, targetUserId: item.ownerId as string })
                  }
                >
                  <BellRing className="mr-1 h-3.5 w-3.5" /> Nudge {item.ownerName}
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
