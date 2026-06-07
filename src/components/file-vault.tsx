import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  FileText,
  Upload,
  Download,
  History,
  Trash2,
  FolderOpen,
  MessageSquare,
  Users,
} from "lucide-react";
import {
  VAULT_STRUCTURE,
  VAULT_STATUSES,
  STATUS_TONE,
  findSubsection,
  type VaultStatus,
} from "@/lib/vault-structure";

type FileRow = {
  id: string;
  team_id: string;
  file_name: string;
  description: string | null;
  section: string;
  subsection: string;
  assigned_to: string | null;
  status: VaultStatus;
  is_template: boolean;
  uploaded_by: string;
  current_version_id: string | null;
  created_at: string;
  updated_at: string;
};

type VersionRow = {
  id: string;
  file_id: string;
  version_number: number;
  storage_path: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_at: string;
  uploaded_by: string;
};

type MemberRow = { user_id: string; name: string | null; email: string | null };

function fmtSize(bytes?: number | null) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileVault({ teamId }: { teamId: string }) {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["vault", teamId],
    queryFn: async () => {
      const [{ data: files, error: fErr }, { data: versions, error: vErr }, members] =
        await Promise.all([
          supabase
            .from("files")
            .select("*")
            .eq("team_id", teamId)
            .eq("is_template", false)
            .order("updated_at", { ascending: false }),
          supabase.from("file_versions").select("*").order("version_number", { ascending: false }),
          loadMembers(teamId),
        ]);
      if (fErr) throw fErr;
      if (vErr) throw vErr;
      const verMap = new Map<string, VersionRow[]>();
      (versions ?? []).forEach((v) => {
        const arr = verMap.get(v.file_id) ?? [];
        arr.push(v as VersionRow);
        verMap.set(v.file_id, arr);
      });
      return { files: (files ?? []) as FileRow[], verMap, members };
    },
  });

  const files = data?.files ?? [];
  const verMap = data?.verMap ?? new Map<string, VersionRow[]>();
  const members = data?.members ?? [];

  // Group files: section -> subsection -> FileRow[]
  const grouped = useMemo(() => {
    const g = new Map<string, Map<string, FileRow[]>>();
    for (const f of files) {
      if (!g.has(f.section)) g.set(f.section, new Map());
      const sub = g.get(f.section)!;
      if (!sub.has(f.subsection)) sub.set(f.subsection, []);
      sub.get(f.subsection)!.push(f);
    }
    return g;
  }, [files]);

  const totalCount = files.length;

  const download = async (versionId: string | null, fileName: string) => {
    if (!versionId) return toast.error("No version available");
    const { data: v } = await supabase
      .from("file_versions").select("storage_path").eq("id", versionId).single();
    if (!v) return toast.error("Version not found");
    const { data: signed, error } = await supabase.storage
      .from("vault").createSignedUrl(v.storage_path, 60, { download: fileName });
    if (error || !signed) return toast.error("Could not generate download link");
    window.open(signed.signedUrl, "_blank");
  };

  const remove = async (file: FileRow) => {
    if (!confirm(`Delete "${file.file_name}" and all its versions?`)) return;
    const versions = verMap.get(file.id) ?? [];
    if (versions.length) {
      await supabase.storage.from("vault").remove(versions.map((v) => v.storage_path));
    }
    await supabase.from("file_versions").delete().eq("file_id", file.id);
    await supabase.from("files").delete().eq("id", file.id);
    toast.success("File deleted");
    qc.invalidateQueries({ queryKey: ["vault", teamId] });
  };

  const setStatus = async (file: FileRow, status: VaultStatus) => {
    const { error } = await supabase.from("files").update({ status } as any).eq("id", file.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["vault", teamId] });
  };

  const [commentTarget, setCommentTarget] = useState<{ file: FileRow; preset?: VaultStatus } | null>(null);
  const openComments = (file: FileRow, preset?: VaultStatus) =>
    setCommentTarget({ file, preset });

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-gold" />
          <h2 className="font-display text-2xl">File Vault</h2>
          <span className="text-xs text-muted-foreground">({totalCount} files)</span>
        </div>
        {user && (
          <UploadDialog
            teamId={teamId}
            userId={user.id}
            members={members}
            onDone={() => qc.invalidateQueries({ queryKey: ["vault", teamId] })}
          />
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading vault…</p>
      ) : (
        <Accordion
          type="multiple"
          defaultValue={VAULT_STRUCTURE.map((s) => s.name)}
          className="space-y-2"
        >
          {VAULT_STRUCTURE.map((section) => {
            const subMap = grouped.get(section.name);
            const sectionCount = subMap
              ? Array.from(subMap.values()).reduce((a, b) => a + b.length, 0)
              : 0;
            return (
              <AccordionItem
                key={section.name}
                value={section.name}
                className="border rounded-md px-3"
              >
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-lg">{section.name}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {sectionCount}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pb-4">
                  {section.subsections.map((sub) => {
                    const subFiles = subMap?.get(sub.name) ?? [];
                    return (
                      <SubsectionBlock
                        key={sub.name}
                        sectionName={section.name}
                        subName={sub.name}
                        subDescription={sub.description}
                        perMember={!!sub.perMember}
                        expectsCompiled={!!sub.expectsCompiled}
                        files={subFiles}
                        members={members}
                        verMap={verMap}
                        isAdmin={isAdmin}
                        userId={user?.id}
                        onDownload={download}
                        onDelete={remove}
                        onSetStatus={setStatus}
                        onOpenComments={openComments}
                        onRefresh={() => qc.invalidateQueries({ queryKey: ["vault", teamId] })}
                      />
                    );
                  })}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      {commentTarget && user && (
        <CommentsDialog
          file={commentTarget.file}
          members={members}
          userId={user.id}
          isAdmin={isAdmin}
          presetStatus={commentTarget.preset}
          onClose={() => setCommentTarget(null)}
          onAfterSave={() => qc.invalidateQueries({ queryKey: ["vault", teamId] })}
        />
      )}
    </section>
  );
}

async function loadMembers(teamId: string): Promise<MemberRow[]> {
  const { data: tm } = await supabase
    .from("team_members").select("user_id").eq("team_id", teamId);
  const ids = (tm ?? []).map((r) => r.user_id);
  if (ids.length === 0) return [];
  const { data: profs } = await supabase
    .from("profiles").select("id, name, email").in("id", ids);
  return (profs ?? []).map((p) => ({
    user_id: p.id, name: p.name, email: p.email,
  }));
}

function SubsectionBlock({
  sectionName,
  subName,
  subDescription,
  perMember,
  expectsCompiled,
  files,
  members,
  verMap,
  isAdmin,
  userId,
  onDownload,
  onDelete,
  onSetStatus,
  onRefresh,
}: {
  sectionName: string;
  subName: string;
  subDescription?: string;
  perMember: boolean;
  expectsCompiled: boolean;
  files: FileRow[];
  members: MemberRow[];
  verMap: Map<string, VersionRow[]>;
  isAdmin: boolean;
  userId?: string;
  onDownload: (versionId: string | null, fileName: string) => void;
  onDelete: (f: FileRow) => void;
  onSetStatus: (f: FileRow, s: VaultStatus) => void;
  onRefresh: () => void;
}) {
  // Build slot list: per-member slots (one per member) + compiled + free-form extras
  const memberFiles = new Map<string, FileRow[]>();
  const compiledFiles: FileRow[] = [];
  const otherFiles: FileRow[] = [];
  for (const f of files) {
    if (perMember && f.assigned_to) {
      const arr = memberFiles.get(f.assigned_to) ?? [];
      arr.push(f);
      memberFiles.set(f.assigned_to, arr);
    } else if (expectsCompiled && /compiled|final/i.test(f.file_name) && !f.assigned_to) {
      compiledFiles.push(f);
    } else {
      otherFiles.push(f);
    }
  }

  return (
    <div className="rounded-md border border-border/60 bg-card/30 p-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h4 className="text-sm font-semibold">{subName}</h4>
          {subDescription && (
            <p className="text-xs text-muted-foreground">{subDescription}</p>
          )}
        </div>
      </div>

      {perMember && members.length > 0 ? (
        <div className="space-y-2">
          {members.map((m) => {
            const mf = memberFiles.get(m.user_id) ?? [];
            return (
              <SlotRow
                key={m.user_id}
                label={m.name || m.email || "Member"}
                files={mf}
                verMap={verMap}
                isAdmin={isAdmin}
                userId={userId}
                onDownload={onDownload}
                onDelete={onDelete}
                onSetStatus={onSetStatus}
                onRefresh={onRefresh}
              />
            );
          })}
          {expectsCompiled && (
            <SlotRow
              label="Final Compiled"
              files={compiledFiles}
              verMap={verMap}
              isAdmin={isAdmin}
              userId={userId}
              onDownload={onDownload}
              onDelete={onDelete}
              onSetStatus={onSetStatus}
              onRefresh={onRefresh}
            />
          )}
          {otherFiles.length > 0 && (
            <div className="pt-2 space-y-2">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Other uploads</div>
              {otherFiles.map((f) => (
                <FileLine
                  key={f.id}
                  file={f}
                  versions={verMap.get(f.id) ?? []}
                  canManage={isAdmin || f.uploaded_by === userId}
                  isAdmin={isAdmin}
                  userId={userId}
                  onDownload={onDownload}
                  onDelete={onDelete}
                  onSetStatus={onSetStatus}
                  onRefresh={onRefresh}
                />
              ))}
            </div>
          )}
        </div>
      ) : files.length === 0 ? (
        <p className="text-xs text-muted-foreground italic py-2">
          Nothing uploaded yet for {subName}.
        </p>
      ) : (
        <div className="space-y-2">
          {files.map((f) => (
            <FileLine
              key={f.id}
              file={f}
              versions={verMap.get(f.id) ?? []}
              canManage={isAdmin || f.uploaded_by === userId}
              isAdmin={isAdmin}
              userId={userId}
              onDownload={onDownload}
              onDelete={onDelete}
              onSetStatus={onSetStatus}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}

      {/* note sectionName used by upload flow, keep ref to avoid TS unused */}
      <span className="hidden">{sectionName}</span>
    </div>
  );
}

function SlotRow({
  label,
  files,
  verMap,
  isAdmin,
  userId,
  onDownload,
  onDelete,
  onSetStatus,
  onRefresh,
}: {
  label: string;
  files: FileRow[];
  verMap: Map<string, VersionRow[]>;
  isAdmin: boolean;
  userId?: string;
  onDownload: (versionId: string | null, fileName: string) => void;
  onDelete: (f: FileRow) => void;
  onSetStatus: (f: FileRow, s: VaultStatus) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="rounded border border-dashed border-border/60 p-2">
      <div className="text-xs font-medium mb-1">{label}</div>
      {files.length === 0 ? (
        <div className="text-[11px] text-muted-foreground italic">Missing</div>
      ) : (
        <div className="space-y-1">
          {files.map((f) => (
            <FileLine
              key={f.id}
              file={f}
              versions={verMap.get(f.id) ?? []}
              canManage={isAdmin || f.uploaded_by === userId}
              isAdmin={isAdmin}
              userId={userId}
              onDownload={onDownload}
              onDelete={onDelete}
              onSetStatus={onSetStatus}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FileLine({
  file,
  versions,
  canManage,
  isAdmin,
  userId,
  onDownload,
  onDelete,
  onSetStatus,
  onRefresh,
}: {
  file: FileRow;
  versions: VersionRow[];
  canManage: boolean;
  isAdmin: boolean;
  userId?: string;
  onDownload: (versionId: string | null, fileName: string) => void;
  onDelete: (f: FileRow) => void;
  onSetStatus: (f: FileRow, s: VaultStatus) => void;
  onRefresh: () => void;
}) {
  const current = versions.find((v) => v.id === file.current_version_id) ?? versions[0];
  return (
    <Card className="border-border/60">
      <CardContent className="p-2.5 flex items-start gap-2">
        <FileText className="h-4 w-4 text-gold mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-sm truncate">{file.file_name}</span>
            {current && (
              <Badge variant="outline" className="text-[10px]">v{current.version_number}</Badge>
            )}
            <Badge variant="outline" className={`text-[10px] ${STATUS_TONE[file.status]}`}>
              {file.status}
            </Badge>
          </div>
          {file.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{file.description}</p>
          )}
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {fmtSize(current?.file_size)} · Updated {new Date(file.updated_at).toLocaleDateString()}
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {isAdmin && (
            <Select value={file.status} onValueChange={(v) => onSetStatus(file, v as VaultStatus)}>
              <SelectTrigger className="h-7 w-[130px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VAULT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            variant="ghost" size="icon"
            onClick={() => onDownload(file.current_version_id, file.file_name)}
            aria-label="Download"
          >
            <Download className="h-4 w-4" />
          </Button>
          {versions.length > 1 && (
            <VersionHistoryDialog file={file} versions={versions} onDownload={onDownload} />
          )}
          {canManage && userId && (
            <NewVersionButton file={file} userId={userId} versions={versions} onDone={onRefresh} />
          )}
          {canManage && (
            <Button
              variant="ghost" size="icon"
              onClick={() => onDelete(file)} aria-label="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function VersionHistoryDialog({
  file, versions, onDownload,
}: {
  file: FileRow;
  versions: VersionRow[];
  onDownload: (versionId: string | null, fileName: string) => void;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="History">
          <History className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">Version history</DialogTitle>
          <DialogDescription>{file.file_name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {versions.map((v) => (
            <div key={v.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <div>
                <div className="font-medium">
                  v{v.version_number}
                  {v.id === file.current_version_id && (
                    <Badge variant="secondary" className="ml-2 text-[10px]">current</Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(v.uploaded_at).toLocaleString()} · {fmtSize(v.file_size)}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => onDownload(v.id, file.file_name)}>
                <Download className="h-3.5 w-3.5 mr-1" /> Download
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NewVersionButton({
  file, userId, versions, onDone,
}: {
  file: FileRow; userId: string; versions: VersionRow[]; onDone: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    try {
      const nextVer = (versions[0]?.version_number ?? 0) + 1;
      const path = `teams/${file.team_id}/${file.id}/v${nextVer}-${f.name}`;
      const { error: upErr } = await supabase.storage
        .from("vault").upload(path, f, { contentType: f.type, upsert: false });
      if (upErr) throw upErr;
      const { data: v, error: vErr } = await supabase
        .from("file_versions")
        .insert({
          file_id: file.id, version_number: nextVer, storage_path: path,
          file_size: f.size, mime_type: f.type, uploaded_by: userId,
        })
        .select("id").single();
      if (vErr) throw vErr;
      await supabase.from("files")
        .update({ current_version_id: v.id, updated_at: new Date().toISOString() })
        .eq("id", file.id);
      toast.success(`Uploaded v${nextVer}`);
      onDone();
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <input ref={inputRef} type="file" className="hidden" onChange={onPick} />
      <Button
        variant="ghost" size="icon" disabled={busy}
        onClick={() => inputRef.current?.click()} aria-label="Upload new version"
      >
        <Upload className="h-4 w-4" />
      </Button>
    </>
  );
}

function UploadDialog({
  teamId, userId, members, onDone,
}: {
  teamId: string;
  userId: string;
  members: MemberRow[];
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [section, setSection] = useState<string>(VAULT_STRUCTURE[0].name);
  const [subsection, setSubsection] = useState<string>(VAULT_STRUCTURE[0].subsections[0].name);
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const subDef = findSubsection(section, subsection);
  const showAssignee = !!subDef?.perMember && members.length > 0;

  const onSectionChange = (s: string) => {
    setSection(s);
    const first = VAULT_STRUCTURE.find((x) => x.name === s)?.subsections[0].name;
    if (first) setSubsection(first);
    setAssignedTo("");
  };

  const reset = () => {
    setFile(null); setName(""); setDescription("");
    setSection(VAULT_STRUCTURE[0].name);
    setSubsection(VAULT_STRUCTURE[0].subsections[0].name);
    setAssignedTo("");
  };

  const submit = async () => {
    if (!file) return toast.error("Pick a file first");
    const fileName = name.trim() || file.name;
    setBusy(true);
    try {
      const { data: created, error: cErr } = await supabase
        .from("files")
        .insert({
          team_id: teamId,
          file_name: fileName,
          description: description.trim() || null,
          section,
          subsection,
          assigned_to: showAssignee && assignedTo ? assignedTo : null,
          uploaded_by: userId,
          is_template: false,
          category: "Other",
        } as any)
        .select("id").single();
      if (cErr) throw cErr;

      const path = `teams/${teamId}/${created.id}/v1-${file.name}`;
      const { error: upErr } = await supabase.storage
        .from("vault").upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) {
        await supabase.from("files").delete().eq("id", created.id);
        throw upErr;
      }

      const { data: ver, error: vErr } = await supabase
        .from("file_versions")
        .insert({
          file_id: created.id, version_number: 1, storage_path: path,
          file_size: file.size, mime_type: file.type, uploaded_by: userId,
        })
        .select("id").single();
      if (vErr) throw vErr;

      await supabase.from("files")
        .update({ current_version_id: ver.id }).eq("id", created.id);

      toast.success("File uploaded");
      reset();
      setOpen(false);
      onDone();
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const subsForSection = VAULT_STRUCTURE.find((s) => s.name === section)?.subsections ?? [];

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Upload className="h-4 w-4 mr-1" /> Upload file
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">Upload to vault</DialogTitle>
          <DialogDescription>
            Pick where this file belongs in the team's vault structure.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="vf-file">File</Label>
            <Input
              id="vf-file" type="file"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                if (f && !name) setName(f.name);
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Section</Label>
              <Select value={section} onValueChange={onSectionChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VAULT_STRUCTURE.map((s) => (
                    <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subsection</Label>
              <Select value={subsection} onValueChange={setSubsection}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {subsForSection.map((s) => (
                    <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {showAssignee && (
            <div>
              <Label>Assigned to (team member)</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger><SelectValue placeholder="Leave blank for the Final Compiled slot" /></SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.name || m.email || "Member"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label htmlFor="vf-name">Display name</Label>
            <Input
              id="vf-name" value={name}
              onChange={(e) => setName(e.target.value.slice(0, 200))}
              placeholder="e.g. Stakeholder interview transcript"
            />
          </div>
          <div>
            <Label htmlFor="vf-desc">Description (optional)</Label>
            <Textarea
              id="vf-desc" value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
              rows={3} placeholder="What's in this file?"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !file}>
            {busy ? "Uploading…" : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
