import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Archive, RotateCcw, Eye, Upload, Trash2, AlertTriangle, CalendarClock, PlayCircle } from "lucide-react";
import {
  archiveSemester,
  listArchives,
  resetSemester,
  promoteArchive,
  deleteArchive,
  getArchiveContents,
} from "@/lib/semester.functions";
import {
  getSemesterSchedule,
  updateSemesterSchedule,
  runAutoArchiveNow,
} from "@/lib/semester-schedule.functions";

export function SemesterPanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(listArchives);
  const archiveFn = useServerFn(archiveSemester);
  const resetFn = useServerFn(resetSemester);
  const promoteFn = useServerFn(promoteArchive);
  const deleteFn = useServerFn(deleteArchive);

  const { data, isLoading } = useQuery({
    queryKey: ["semester", "archives"],
    queryFn: () => listFn({}),
  });

  const archives = data?.archives ?? [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ["semester", "archives"] });

  const archiveMut = useMutation({
    mutationFn: (v: { name: string; notes?: string }) => {
      const id = toast.loading(`Archiving "${v.name}"… copying files, please wait`);
      return archiveFn({ data: v })
        .then((r) => {
          toast.success(`Archive "${v.name}" saved successfully`, { id, duration: 6000 });
          return r;
        })
        .catch((e) => {
          toast.error(`Archive failed: ${e.message}`, { id, duration: 8000 });
          throw e;
        });
    },
    onSuccess: () => invalidate(),
  });

  const resetMut = useMutation({
    mutationFn: (v: { confirm: string }) => {
      const id = toast.loading("Resetting semester… deleting teams and files");
      return resetFn({ data: v })
        .then((r) => {
          toast.success(`Reset complete — removed ${r.storageDeleted} stored files`, { id, duration: 6000 });
          return r;
        })
        .catch((e) => {
          toast.error(`Reset failed: ${e.message}`, { id, duration: 8000 });
          throw e;
        });
    },
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries();
    },
  });

  const promoteMut = useMutation({
    mutationFn: (v: { archiveId: string; confirm: string }) => {
      const id = toast.loading("Restoring archive to live… this may take a moment");
      return promoteFn({ data: v })
        .then((r) => {
          toast.success("Archive restored — live data is now editable again", { id, duration: 6000 });
          return r;
        })
        .catch((e) => {
          toast.error(`Restore failed: ${e.message}`, { id, duration: 8000 });
          throw e;
        });
    },
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries();
    },
  });

  const deleteMut = useMutation({
    mutationFn: (v: { archiveId: string }) => deleteFn({ data: v }),
    onSuccess: () => {
      toast.success("Archive deleted");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <AutoArchiveCard />

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl flex items-center gap-2">
            <Archive className="h-5 w-5 text-gold" /> Semester operations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border p-4 bg-muted/30 text-sm space-y-2">
            <p className="font-medium">What gets preserved across reset:</p>
            <ul className="list-disc list-inside text-muted-foreground text-xs space-y-0.5">
              <li>Template files in Admin → Templates</li>
              <li>Student & admin login accounts (students are just detached from teams)</li>
              <li>The audit log and every saved archive</li>
            </ul>
          </div>

          <div className="flex flex-wrap gap-2">
            <ArchiveNowDialog onArchive={(v) => archiveMut.mutate(v)} loading={archiveMut.isPending} />
            <ResetDialog onReset={(v) => resetMut.mutate(v)} loading={resetMut.isPending} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">
            Saved archives ({archives.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : archives.length === 0 ? (
            <p className="text-sm text-muted-foreground">No archives yet.</p>
          ) : (
            <div className="space-y-2">
              {archives.map((a: any) => (
                <ArchiveRow
                  key={a.id}
                  archive={a}
                  onPromote={(confirm) => promoteMut.mutate({ archiveId: a.id, confirm })}
                  onDelete={() => deleteMut.mutate({ archiveId: a.id })}
                  promoteLoading={promoteMut.isPending && promoteMut.variables?.archiveId === a.id}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AutoArchiveCard() {
  const qc = useQueryClient();
  const getSchedFn = useServerFn(getSemesterSchedule);
  const updateSchedFn = useServerFn(updateSemesterSchedule);
  const runNowFn = useServerFn(runAutoArchiveNow);

  const { data, isLoading } = useQuery({
    queryKey: ["semester", "schedule"],
    queryFn: () => getSchedFn({}),
  });
  const sched = data?.schedule;

  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [dirty, setDirty] = useState(false);

  // Initialize fields once schedule loads
  if (!dirty && sched && (start === "" && end === "")) {
    if (sched.start_date) setStart(sched.start_date);
    if (sched.end_date) setEnd(sched.end_date);
  }

  const saveMut = useMutation({
    mutationFn: () =>
      updateSchedFn({
        data: { start_date: start || null, end_date: end || null },
      }),
    onSuccess: () => {
      toast.success("Schedule saved");
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["semester", "schedule"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const runMut = useMutation({
    mutationFn: () => runNowFn({}),
    onSuccess: (r: any) => {
      if (r.ran) toast.success(`Snapshot created. Pruned ${r.pruned ?? 0} old archive(s).`);
      else toast.message(`Skipped: ${r.reason}`);
      qc.invalidateQueries({ queryKey: ["semester", "archives"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-gold" /> Auto-archive schedule
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Runs once a day between the start and end dates. Keeps the last 7 daily snapshots and
          4 weekly snapshots (Sundays) — about 11 archives total. Older auto-archives are
          permanently deleted. Manually-created archives are never auto-deleted.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>First day of semester</Label>
            <Input
              type="date"
              value={start}
              onChange={(e) => {
                setStart(e.target.value);
                setDirty(true);
              }}
            />
          </div>
          <div>
            <Label>Last day of semester</Label>
            <Input
              type="date"
              value={end}
              onChange={(e) => {
                setEnd(e.target.value);
                setDirty(true);
              }}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => saveMut.mutate()} disabled={!dirty || saveMut.isPending}>
            {saveMut.isPending ? "Saving…" : "Save schedule"}
          </Button>
          <Button
            variant="outline"
            onClick={() => runMut.mutate()}
            disabled={runMut.isPending}
          >
            <PlayCircle className="h-4 w-4 mr-1" />
            {runMut.isPending ? "Running…" : "Run now"}
          </Button>
          {isLoading ? null : sched?.updated_at ? (
            <span className="text-xs text-muted-foreground self-center">
              Last updated {new Date(sched.updated_at).toLocaleString()}
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}


function ArchiveNowDialog({
  onArchive,
  loading,
}: {
  onArchive: (v: { name: string; notes?: string }) => void;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Archive className="h-4 w-4 mr-1" /> Archive current semester
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">Archive current semester</DialogTitle>
          <DialogDescription>
            Saves a snapshot of all teams, members, files (with bytes), comments, and company info.
            Live data is unchanged.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Spring 2026"
            />
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={!name.trim() || loading}
            onClick={() => {
              onArchive({ name: name.trim(), notes: notes.trim() || undefined });
              setName("");
              setNotes("");
              setOpen(false);
            }}
          >
            {loading ? "Archiving…" : "Archive"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetDialog({
  onReset,
  loading,
}: {
  onReset: (v: { confirm: string }) => void;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">
          <RotateCcw className="h-4 w-4 mr-1" /> Reset semester
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" /> Reset semester
          </DialogTitle>
          <DialogDescription>
            Permanently deletes all teams, team members, team files (and their stored bytes),
            comments, company info, and group norms. Templates, login accounts, audit log, and
            archives are kept. Make sure you've archived first if you want to be able to restore.
          </DialogDescription>
        </DialogHeader>
        <div>
          <Label className="text-xs">Type RESET to confirm</Label>
          <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="RESET" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={confirm !== "RESET" || loading}
            onClick={() => {
              onReset({ confirm });
              setConfirm("");
              setOpen(false);
            }}
          >
            {loading ? "Resetting…" : "Reset everything"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ArchiveRow({
  archive,
  onPromote,
  onDelete,
  promoteLoading,
}: {
  archive: any;
  onPromote: (confirm: string) => void;
  onDelete: () => void;
  promoteLoading: boolean;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [confirm, setConfirm] = useState("");

  return (
    <div className="rounded-md border p-3 flex flex-wrap items-center gap-3 justify-between">
      <div className="min-w-0">
        <div className="font-medium">{archive.name}</div>
        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
          <span>{new Date(archive.created_at).toLocaleString()}</span>
          <Badge variant="secondary">{archive.team_count} teams</Badge>
          <Badge variant="secondary">{archive.member_count} members</Badge>
          <Badge variant="secondary">{archive.file_count} files</Badge>
        </div>
        {archive.notes && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{archive.notes}</p>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="outline" onClick={() => setPreviewOpen(true)}>
          <Eye className="h-3.5 w-3.5 mr-1" /> Preview
        </Button>
        <Dialog open={promoteOpen} onOpenChange={setPromoteOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="default">
              <Upload className="h-3.5 w-3.5 mr-1" /> Promote to live
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" /> Promote "{archive.name}"
              </DialogTitle>
              <DialogDescription>
                This will <strong>wipe current live data</strong> and replace it with this archive's
                contents. After promotion, everything is fully editable again — uploads, comments,
                status changes all work normally.
              </DialogDescription>
            </DialogHeader>
            <div>
              <Label className="text-xs">Type PROMOTE to confirm</Label>
              <Input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="PROMOTE"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPromoteOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={confirm !== "PROMOTE" || promoteLoading}
                onClick={() => {
                  onPromote(confirm);
                  setConfirm("");
                  setPromoteOpen(false);
                }}
              >
                {promoteLoading ? "Restoring…" : "Wipe & restore"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            if (confirm.length === 0 && window.confirm(`Delete archive "${archive.name}"? This cannot be undone.`)) {
              onDelete();
            }
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ArchivePreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} archive={archive} />
    </div>
  );
}

function ArchivePreviewDialog({
  open,
  onOpenChange,
  archive,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  archive: any;
}) {
  const getFn = useServerFn(getArchiveContents);
  const { data, isLoading } = useQuery({
    queryKey: ["semester", "archive", archive.id],
    queryFn: () => getFn({ data: { archiveId: archive.id } }),
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Eye className="h-5 w-5" /> {archive.name}
            <Badge variant="outline" className="ml-2">read-only</Badge>
          </DialogTitle>
          <DialogDescription>
            Snapshot from {new Date(archive.created_at).toLocaleString()}
          </DialogDescription>
        </DialogHeader>
        {isLoading || !data ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-4">
            {data.teams.map((t: any) => {
              const teamFiles = data.files.filter((f: any) => f.team_id === t.id);
              const teamMembers = data.members.filter((m: any) => m.team_id === t.id);
              const cf = data.companyFocus.find((c: any) => c.team_id === t.id);
              return (
                <div key={t.id} className="rounded border p-3">
                  <div className="font-medium">
                    {t.name}{" "}
                    {t.section && (
                      <Badge variant="outline" className="ml-1">
                        §{t.section}
                      </Badge>
                    )}
                  </div>
                  {cf && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Client: {cf.company_name} {cf.industry && `· ${cf.industry}`}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {teamMembers.length} members · {teamFiles.length} files
                  </p>
                  {teamFiles.length > 0 && (
                    <ul className="text-xs mt-2 space-y-0.5 max-h-48 overflow-y-auto">
                      {teamFiles.map((f: any) => (
                        <li key={f.id} className="text-muted-foreground">
                          <span className="text-foreground">{f.file_name}</span> —{" "}
                          {f.section} / {f.subsection}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
            {data.teams.length === 0 && (
              <p className="text-sm text-muted-foreground">No teams in this archive.</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
