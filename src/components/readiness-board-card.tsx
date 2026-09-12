import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  decideRequirement,
  getReadinessBoard,
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
import { LayoutGrid, PlayCircle, XCircle } from "lucide-react";

const ALL = "__all__";

export function ReadinessBoardCard() {
  const qc = useQueryClient();
  const fetchBoard = useServerFn(getReadinessBoard);
  const openFn = useServerFn(setRequirementOpening);
  const decideFn = useServerFn(decideRequirement);

  const [section, setSection] = useState<string>(ALL);
  const [kickoffKey, setKickoffKey] = useState<string>("");
  const [dueAt, setDueAt] = useState<string>("");

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
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = useMemo(
    () => (data?.rows ?? []).filter((r) => section === ALL || r.team.section === section),
    [data, section],
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
                          <Badge variant="outline" className={READINESS_TONE[cell.status]}>
                            {READINESS_LABEL[cell.status]}
                          </Badge>
                          {cell.overdue && (
                            <div className="text-[11px] text-rose-400">Overdue</div>
                          )}
                          {cell.status === "submitted" && (
                            <div className="flex gap-1 pt-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 px-2 text-[11px]"
                                onClick={() =>
                                  decide.mutate({
                                    teamId: row.team.id,
                                    key: cell.key,
                                    status: "approved",
                                  })
                                }
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 px-2 text-[11px]"
                                onClick={() => {
                                  const note = window.prompt("What needs fixing?") ?? "";
                                  if (!note.trim()) return;
                                  decide.mutate({
                                    teamId: row.team.id,
                                    key: cell.key,
                                    status: "needs_revision",
                                    note,
                                  });
                                }}
                              >
                                Send back
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
      </CardContent>
    </Card>
  );
}
