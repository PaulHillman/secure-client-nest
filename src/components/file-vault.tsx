import { recordHealthReportView } from "@/lib/health-report-views";
import { peerBadgeLabel, peerBadgeTone } from "@/lib/peer-review-policy";
import { openVaultFileInNewTab } from "@/lib/file-download";
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getTeamNorms } from "@/lib/group-norms.functions";
import { NORM_SECTIONS } from "@/lib/group-norms";
import { supabase } from "@/integrations/supabase/client";
import { StudentName } from "@/components/student-avatar";
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
  Calendar,
  BookOpen,
  HeartPulse,
  ArrowLeft,
  ClipboardList,
  FileCheck2,
  Library,
  MessageSquareText,
  NotebookPen,
  Star,
  Video,
  Mail,
  Pencil,
} from "lucide-react";
import { FileViewerDialog } from "@/components/file-viewer-dialog";
import {
  VAULT_STRUCTURE,
  VAULT_STATUSES,
  STATUS_TONE,
  subsectionNames,
  type VaultSection,
  type VaultStatus,
} from "@/lib/vault-structure";
import { safeStorageFileName } from "@/lib/storage-path";
import { autoAssessPeerReviewUpload } from "@/lib/peer-review-assessments.functions";

/** Kick off the automatic peer-review assessment and tell the student to stand by. */
function runPeerAssessment(versionId: string, onDone: () => void) {
  const id = toast.loading("Stand by — your peer review is being assessed…");
  autoAssessPeerReviewUpload({ data: { versionId } })
    .then((r: any) => {
      if (r?.status === "assessed") toast.success(`Peer review assessed: ${r.score}/10. Your analysis has been emailed.`, { id });
      else if (r?.status === "unreadable") toast.warning("This file couldn't be read automatically — your instructor will review it.", { id });
      else toast.dismiss(id);
      onDone();
    })
    .catch(() => { toast.error("Automatic assessment didn't finish — your instructor will review it.", { id }); });
}
import { compareTeamRoles } from "@/lib/team-roles";
import { finalCompiledName, isFinalCompiled } from "@/lib/vault-file-label";
import { peerUploadSequence, groupPeerUploads } from "@/lib/vault-upload-identity";
import { peerPriorityFixes } from "@/lib/peer-review-feedback";
import { Calculator, LoaderCircle } from "lucide-react";

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
  is_locked: boolean;
  uploaded_by: string;
  current_version_id: string | null;
  created_at: string;
  updated_at: string;
  meeting_date: string | null;
};

type PeerScore = { score: number | null; status: string; attempt: number; changes: unknown };

const VAULT_FOLDERS = [
  { key: "agendas", label: "Agendas", icon: Calendar, entries: [["Team Documents", "Agendas"]] },
  {
    key: "client-communications",
    label: "Client Communications",
    icon: Mail,
    entries: [["Semester Long Project", "Client Communications"]],
  },
  { key: "group-norms", label: "Group Norms", icon: FileCheck2, entries: [["Team Documents", "Group Norms"]] },
  {
    key: "health-reports",
    label: "Health Reports",
    icon: HeartPulse,
    entries: [["Team Documents", "Health Reports"]],
  },
  {
    key: "interview-questions",
    label: "Interview Questions",
    icon: MessageSquareText,
    entries: [["Semester Long Project", "Interview Questions"]],
  },
  { key: "minutes", label: "Minutes", icon: NotebookPen, entries: [["Team Documents", "Minutes"]] },
  {
    key: "resources",
    label: "Operational Resources & Templates",
    icon: Library,
    entries: [["Team Documents", "Operational Resources and Templates"]],
  },
  {
    key: "peer-reviews",
    label: "Peer Reviews",
    icon: Star,
    entries: [["Team Documents", "Mid-Semester Peer Reviews"]],
  },
  {
    key: "research",
    label: "Research",
    icon: BookOpen,
    entries: [
      ["Semester Long Project", "Client research"],
      ["Semester Long Project", "Organizational Chart"],
    ],
  },
  {
    key: "video",
    label: "Video",
    icon: Video,
    entries: [
      ["Video", "B-Roll"],
      ["Video", "Transcript"],
      ["Video", "Files"],
      ["Video", "Project Drafts"],
      ["Video", "Final Submission"],
    ],
  },
] as const;

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

type MemberRow = {
  user_id: string;
  job_title: string | null;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
};

function fmtSize(bytes?: number | null) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileVault({
  teamId,
  sections,
  title = "File Vault",
  uploadSections,
}: {
  teamId: string;
  sections?: VaultSection[];
  title?: string;
  /** Sections offered in the upload dialog; defaults to the displayed sections. */
  uploadSections?: VaultSection[];
}) {
  const structure = sections ?? VAULT_STRUCTURE;
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    // Separate the enriched result from pre-update cached lists in open previews.
    // Keep the prefix so existing upload/status invalidations still refresh it.
    queryKey: ["vault", teamId, "peer-feedback-v3"],
    queryFn: async () => {
      const [{ data: files, error: fErr }, { data: versions, error: vErr }, members, { data: assessments }] =
        await Promise.all([
          supabase
            .from("files")
            .select("*")
            .eq("team_id", teamId)
            .eq("is_template", false)
            .order("updated_at", { ascending: false }),
          supabase.from("file_versions").select("*").order("version_number", { ascending: false }),
          loadMembers(teamId),
          // Peer-review scores per file; RLS limits students to their own rows.
          supabase
            .from("peer_review_assessments")
            .select("file_id, version_id, score, status, attempt, changes")
            .eq("team_id", teamId),
        ]);
      if (fErr) throw fErr;
      if (vErr) throw vErr;
      const verMap = new Map<string, VersionRow[]>();
      (versions ?? []).forEach((v) => {
        const arr = verMap.get(v.file_id) ?? [];
        arr.push(v as VersionRow);
        verMap.set(v.file_id, arr);
      });
      const peerMap = new Map<string, PeerScore>();
      (assessments ?? []).forEach((a) => {
        if (a.version_id) peerMap.set(a.version_id, { score: a.score, status: a.status, attempt: a.attempt, changes: a.changes });
      });
      const uploaderIds = Array.from(new Set([
        ...(files ?? []).map((f) => f.uploaded_by),
        ...(files ?? []).flatMap((f) => (verMap.get(f.id) ?? []).map((v) => v.uploaded_by)),
      ]));
      const { data: uploaders, error: uploaderError } = uploaderIds.length
        ? await supabase.from("profiles").select("id, first_name, last_name, name").in("id", uploaderIds)
        : { data: [], error: null };
      if (uploaderError) throw uploaderError;
      const uploaderNames = new Map((uploaders ?? []).map((p) => [p.id,
        [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || p.name]));
      const peerSequence = peerUploadSequence((files ?? []) as FileRow[], versions ?? []);
      return { files: (files ?? []) as FileRow[], verMap, members, peerMap, uploaderNames, peerSequence };
    },
  });

  const files = data?.files ?? [];
  const verMap = data?.verMap ?? new Map<string, VersionRow[]>();
  const members = data?.members ?? [];
  const peerMap = data?.peerMap ?? new Map<string, PeerScore>();
  const uploaderNames = data?.uploaderNames ?? new Map<string, string>();
  const peerSequence = data?.peerSequence ?? new Map<string, number>();

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
  const availableFolders = VAULT_FOLDERS.filter((folder) =>
    folder.entries.some(([sectionName, subName]) =>
      structure.some((section) =>
        section.name === sectionName && section.subsections.some((sub) => sub.name === subName),
      ),
    ),
  );
  const activeFolder = availableFolders.find((folder) => folder.key === selectedFolder) ?? null;
  const ActiveFolderIcon = activeFolder?.icon;

  const folderFileCount = (entries: readonly (readonly [string, string])[]) =>
    entries.reduce((count, [sectionName, subName]) => {
      const subMap = grouped.get(sectionName);
      return count + subsectionNames(subName).reduce(
        (subCount, name) => subCount + (subMap?.get(name)?.length ?? 0),
        0,
      );
    }, 0);

  const download = async (versionId: string | null, fileName: string) => {
    if (!versionId) return toast.error("No version available");
    const { data: v } = await supabase
      .from("file_versions").select("file_id").eq("id", versionId).single();
    if (!v) return toast.error("Version not found");
    try {
      await openVaultFileInNewTab(versionId, fileName);
    } catch {
      return toast.error("Could not open this file right now");
    }
    const { data: f } = await supabase.from("files").select("subsection, team_id").eq("id", v.file_id).single();
    if (f?.subsection === "Health Reports") void recordHealthReportView(v.file_id, f.team_id, false, versionId);
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
          <h2 className="font-display text-2xl">{title}</h2>
          <span className="text-xs text-muted-foreground">({totalCount} files)</span>
        </div>
        {user && (
          <UploadDialog
            teamId={teamId}
            userId={user.id}
            sections={uploadSections ?? structure}
            members={members}
            onDone={() => qc.invalidateQueries({ queryKey: ["vault", teamId] })}
          />
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading vault…</p>
      ) : activeFolder ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 border-b border-border/60 pb-3">
            <Button variant="ghost" size="icon" onClick={() => setSelectedFolder(null)} aria-label="Back to all folders">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-gold/40 bg-gold/10 text-gold">
              {ActiveFolderIcon && <ActiveFolderIcon className="h-5 w-5" />}
            </div>
            <div>
              <h3 className="font-display text-xl">{activeFolder.label}</h3>
              <p className="text-xs text-muted-foreground">{folderFileCount(activeFolder.entries)} files</p>
              {activeFolder.key === "minutes" && (() => {
                const template = files.find(
                  (f) => f.file_name === "Meeting Minutes Template.docx" && f.is_locked,
                );
                if (!template) return null;
                return (
                  <button
                    type="button"
                    className="mt-0.5 text-[11px] text-gold underline underline-offset-2 hover:text-gold/80"
                    onClick={() => download(template.current_version_id, template.file_name)}
                  >
                    Meeting Minutes Template
                  </button>
                );
              })()}
            </div>
          </div>
          {activeFolder.entries.map(([sectionName, subName]) => {
            const section = structure.find((item) => item.name === sectionName);
            const sub = section?.subsections.find((item) => item.name === subName);
            if (!sub) return null;
            const subMap = grouped.get(sectionName);
            const subFiles = subsectionNames(subName).flatMap((name) => subMap?.get(name) ?? []);
            return (
              <SubsectionBlock
                key={`${sectionName}-${subName}`}
                teamId={teamId}
                sectionName={sectionName}
                subName={subName}
                subDescription={sub.description}
                perMember={!!sub.perMember}
                expectsCompiled={!!sub.expectsCompiled}
                files={subFiles}
                members={members}
                verMap={verMap}
                peerMap={peerMap}
                uploaderNames={uploaderNames}
                peerSequence={peerSequence}
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
        </div>
      ) : availableFolders.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {availableFolders.map((folder) => {
            const Icon = folder.icon;
            const count = folderFileCount(folder.entries);
            return (
              <Button
                key={folder.key}
                type="button"
                variant="outline"
                className="h-28 min-w-0 flex-col items-start justify-between rounded-md p-3 text-left"
                onClick={() => setSelectedFolder(folder.key)}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-md border border-gold/40 bg-gold/10 text-gold">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="flex w-full min-w-0 items-end justify-between gap-2">
                  <span className="min-w-0 whitespace-normal text-sm font-semibold leading-tight">{folder.label}</span>
                  <Badge variant="outline" className="shrink-0 text-[10px]">{count}</Badge>
                </span>
              </Button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          {structure.map((section) => {
            const subMap = grouped.get(section.name);
            return (
              <div key={section.name} className={`space-y-3 rounded-md border p-3 ${section.tone ?? ""}`}>
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-gold" />
                  <span className="font-display text-lg">{section.name}</span>
                </div>
                {section.subsections.map((sub) => (
                  <SubsectionBlock
                    key={sub.name}
                    teamId={teamId}
                    sectionName={section.name}
                    subName={sub.name}
                    subDescription={sub.description}
                    perMember={!!sub.perMember}
                    expectsCompiled={!!sub.expectsCompiled}
                    files={subsectionNames(sub.name).flatMap((name) => subMap?.get(name) ?? [])}
                    members={members}
                    verMap={verMap}
                    peerMap={peerMap}
                uploaderNames={uploaderNames}
                peerSequence={peerSequence}
                    isAdmin={isAdmin}
                    userId={user?.id}
                    onDownload={download}
                    onDelete={remove}
                    onSetStatus={setStatus}
                    onOpenComments={openComments}
                    onRefresh={() => qc.invalidateQueries({ queryKey: ["vault", teamId] })}
                  />
                ))}
              </div>
            );
          })}
        </div>
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
    .from("team_members").select("user_id, job_title").eq("team_id", teamId);
  const ids = (tm ?? []).map((r) => r.user_id);
  if (ids.length === 0) return [];
  const { data: profs } = await supabase
    .from("profiles").select("id, name, email, avatar_url").in("id", ids);
  const membershipById = new Map((tm ?? []).map((m) => [m.user_id, m.job_title]));
  return (profs ?? [])
    .map((p) => ({
      user_id: p.id,
      job_title: membershipById.get(p.id) ?? "Unassigned",
      name: p.name,
      email: p.email,
      avatar_url: p.avatar_url,
    }))
    .sort((a, b) => compareTeamRoles(a.job_title, b.job_title) ||
      (a.name ?? "").localeCompare(b.name ?? ""));
}

function SubsectionBlock({
  teamId,
  sectionName,
  subName,
  subDescription,
  perMember,
  expectsCompiled,
  files,
  members,
  verMap,
  peerMap,
  uploaderNames,
  peerSequence,
  isAdmin,
  userId,
  onDownload,
  onDelete,
  onSetStatus,
  onOpenComments,
  onRefresh,
}: {
  teamId: string;
  sectionName: string;
  subName: string;
  subDescription?: string;
  perMember: boolean;
  expectsCompiled: boolean;
  files: FileRow[];
  members: MemberRow[];
  verMap: Map<string, VersionRow[]>;
  peerMap: Map<string, PeerScore>;
  uploaderNames: Map<string, string>;
  peerSequence: Map<string, number>;
  isAdmin: boolean;
  userId?: string;
  onDownload: (versionId: string | null, fileName: string) => void;
  onDelete: (f: FileRow) => void;
  onSetStatus: (f: FileRow, s: VaultStatus) => void;
  onOpenComments: (f: FileRow, preset?: VaultStatus) => void;
  onRefresh: () => void;
}) {
  const isGroupNorms = sectionName === "Team Documents" && subName === "Group Norms";
  const isAgendas = sectionName === "Team Documents" && subName === "Agendas";
  const isPeerReviews = subName === "Mid-Semester Peer Reviews";
  const peerGroups = groupPeerUploads(files).sort((a, b) =>
    (uploaderNames.get(a.owner) ?? "").localeCompare(uploaderNames.get(b.owner) ?? ""));

  const [agendaSort, setAgendaSort] = useState<AgendaSort>("date-asc");
  const agendaFiles = useMemo(
    () => (isAgendas ? sortAgendas(files, agendaSort) : files),
    [isAgendas, files, agendaSort],
  );

  // Build slot list: per-member slots (one per member) + compiled + free-form extras
  const memberFiles = new Map<string, FileRow[]>();
  const compiledFiles: FileRow[] = [];
  const otherFiles: FileRow[] = [];
  for (const f of files) {
    if (perMember && f.assigned_to) {
      const arr = memberFiles.get(f.assigned_to) ?? [];
      arr.push(f);
      memberFiles.set(f.assigned_to, arr);
    } else if (expectsCompiled && isFinalCompiled(f)) {
      compiledFiles.push(f);
    } else {
      otherFiles.push(f);
    }
  }

  const commonProps = {
    verMap, peerMap, uploaderNames, peerSequence, isAdmin, userId,
    onDownload, onDelete, onSetStatus, onOpenComments, onRefresh,
  };

  return (
    <div className="rounded-md border border-border/60 bg-card/30 p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div>
          <h4 className="text-sm font-semibold">{subName}</h4>
          {subDescription && (
            <p className="text-xs text-muted-foreground">{subDescription}</p>
          )}
        </div>
        {isAgendas && files.length > 1 && (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] text-muted-foreground">Sort</span>
            <Select value={agendaSort} onValueChange={(v) => setAgendaSort(v as AgendaSort)}>
              <SelectTrigger className="h-7 w-[200px] text-xs" aria-label="Sort agendas">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AGENDA_SORTS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {isPeerReviews && files.length > 0 ? (
        <div className="space-y-5">
          {peerGroups.map((group) => (
            <div key={group.owner} className="space-y-2" data-peer-owner={group.owner}>
              <h5 className="text-sm font-semibold">{uploaderNames.get(group.owner) ?? members.find((m) => m.user_id === group.owner)?.name ?? "Member name unavailable"}</h5>
              {group.files.map((f) => (
                <FileLine
                  key={f.id}
                  file={f}
                  versions={verMap.get(f.id) ?? []}
                  canManage={isAdmin || (f.uploaded_by === userId && !f.is_locked)}
                  {...commonProps}
                />
              ))}
            </div>
          ))}
        </div>
      ) : perMember && members.length > 0 ? (
        <div className="space-y-2">
          {members.map((m) => {
            const mf = memberFiles.get(m.user_id) ?? [];
            return (
              <SlotRow
                key={m.user_id}
                label={m.name || m.email || "Member"}
                files={mf}
                {...commonProps}
              />
            );
          })}
          {expectsCompiled && (
            <SlotRow label="Final Compiled" files={compiledFiles} {...commonProps} />
          )}
          {otherFiles.length > 0 && (
            <div className="pt-2 space-y-2">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Other uploads</div>
              {otherFiles.map((f) => (
                <FileLine
                  key={f.id}
                  file={f}
                  versions={verMap.get(f.id) ?? []}
                  canManage={isAdmin || (f.uploaded_by === userId && !f.is_locked)}
                  {...commonProps}
                />
              ))}
            </div>
          )}
        </div>
      ) : files.length === 0 ? (
        isGroupNorms ? (
          <GroupNormsVaultNote teamId={teamId} />

        ) : (
          <p className="text-xs text-muted-foreground italic py-2">
            Nothing uploaded yet for {subName}.
          </p>
        )
      ) : (
        <div className="space-y-2">
          {isGroupNorms && <GroupNormsVaultNote teamId={teamId} />}
          {(isAgendas ? agendaFiles : files).map((f) => (
            <FileLine
              key={f.id}
              file={f}
              versions={verMap.get(f.id) ?? []}
              canManage={isAdmin || (f.uploaded_by === userId && !f.is_locked)}
              showMeetingDate={isAgendas}
              {...commonProps}
            />
          ))}
        </div>
      )}

      {/* note sectionName used by upload flow, keep ref to avoid TS unused */}
      <span className="hidden">{sectionName}</span>
    </div>
  );
}

function GroupNormsVaultNote({ teamId }: { teamId: string }) {
  const [downloading, setDownloading] = useState(false);

  const downloadTemplate = async () => {
    setDownloading(true);
    try {
      const { data: tpl, error } = await supabase
        .from("files")
        .select("id, file_name, current_version_id")
        .is("team_id", null)
        .eq("is_template", true)
        .eq("section", "Team Documents")
        .eq("subsection", "Group Norms")
        .maybeSingle();
      if (error) throw error;
      if (!tpl?.current_version_id) {
        toast.error("The shared template is not available yet");
        return;
      }
      try {
        await openVaultFileInNewTab(tpl.current_version_id);
      } catch {
        toast.error("Could not generate download link");
        return;
      }
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="rounded border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground space-y-2">
      <GroupNormsReadOnly teamId={teamId} />
      <button
        type="button"
        onClick={downloadTemplate}
        disabled={downloading}
        className="inline-flex items-center gap-1 text-primary underline underline-offset-2 disabled:opacity-50"
      >
        <Download className="h-3 w-3" />
        {downloading ? "Preparing download…" : "Download the shared Group Norms template (guidance only)"}
      </button>
    </div>
  );
}

function GroupNormsReadOnly({ teamId }: { teamId: string }) {
  const loadNorms = useServerFn(getTeamNorms);
  const { data, isLoading, error } = useQuery({
    queryKey: ["vault-group-norms", teamId],
    queryFn: () => loadNorms({ data: { teamId } }),
  });

  if (isLoading) return <p className="italic">Loading the team's Group Norms…</p>;
  if (error) return <p className="italic">The Group Norms could not be loaded right now.</p>;
  if (!data?.exists) {
    return <p className="italic">This team has not written its Group Norms yet.</p>;
  }

  const content = data.content ?? {};
  const approved = `${data.approvedCount} of ${data.total} members approved`;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] uppercase tracking-wide">
        <span>Version {data.version}</span>
        <span>{approved}</span>
        <span>Read-only</span>
      </div>
      <div className="max-h-[11rem] overflow-y-auto rounded border border-border/60 bg-background/60 p-3 space-y-3 text-xs text-foreground">
        {NORM_SECTIONS.map((s) =>
          s.levels ? (
            <div key={s.key} className="space-y-1">
              <p className="font-semibold">{s.title}</p>
              {s.levels.map((l) => (
                <div key={l.key}>
                  <p className="font-medium text-muted-foreground">{l.label}</p>
                  <p className="whitespace-pre-wrap">
                    {content[l.key]?.trim() || <span className="italic text-muted-foreground">Not written yet.</span>}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div key={s.key} className="space-y-0.5">
              <p className="font-semibold">{s.title}</p>
              <p className="whitespace-pre-wrap">
                {content[s.key]?.trim() || <span className="italic text-muted-foreground">Not written yet.</span>}
              </p>
            </div>
          ),
        )}
      </div>
      <p>
        Group Norms are written and approved in the{" "}
        <a
          href="#group-norms"
          className="text-primary underline underline-offset-2"
          onClick={(e) => {
            e.preventDefault();
            document.getElementById("group-norms")?.scrollIntoView({ behavior: "smooth" });
          }}
        >
          Group Norms section
        </a>{" "}
        on this page. Nothing needs to be uploaded here.
      </p>
    </div>
  );
}


type RowCommonProps = {
  verMap: Map<string, VersionRow[]>;
  peerMap: Map<string, PeerScore>;
  uploaderNames: Map<string, string>;
  peerSequence: Map<string, number>;
  isAdmin: boolean;
  userId?: string;
  onDownload: (versionId: string | null, fileName: string) => void;
  onDelete: (f: FileRow) => void;
  onSetStatus: (f: FileRow, s: VaultStatus) => void;
  onOpenComments: (f: FileRow, preset?: VaultStatus) => void;
  onRefresh: () => void;
};

function SlotRow({
  label,
  files,
  verMap,
  peerMap,
  uploaderNames,
  peerSequence,
  isAdmin,
  userId,
  onDownload,
  onDelete,
  onSetStatus,
  onOpenComments,
  onRefresh,
}: { label: string; files: FileRow[] } & RowCommonProps) {
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
              canManage={isAdmin || (f.uploaded_by === userId && !f.is_locked)}
              verMap={verMap}
              peerMap={peerMap}
                uploaderNames={uploaderNames}
                peerSequence={peerSequence}
              isAdmin={isAdmin}
              userId={userId}
              onDownload={onDownload}
              onDelete={onDelete}
              onSetStatus={onSetStatus}
              onOpenComments={onOpenComments}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type AgendaSort = "date-asc" | "date-desc" | "name-asc" | "name-desc";

const AGENDA_SORTS: { value: AgendaSort; label: string }[] = [
  { value: "date-asc", label: "Meeting date · earliest first" },
  { value: "date-desc", label: "Meeting date · latest first" },
  { value: "name-asc", label: "Name · A to Z" },
  { value: "name-desc", label: "Name · Z to A" },
];

function formatMeetingDate(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, day ?? 1);
  return dt.toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}

function agendaNameCompare(a: FileRow, b: FileRow) {
  return a.file_name.localeCompare(b.file_name, undefined, { sensitivity: "base" });
}

function sortAgendas(files: FileRow[], sort: AgendaSort): FileRow[] {
  const arr = [...files];
  arr.sort((a, b) => {
    if (sort === "name-asc") return agendaNameCompare(a, b);
    if (sort === "name-desc") return agendaNameCompare(b, a);
    const aDate = a.meeting_date;
    const bDate = b.meeting_date;
    if (aDate && bDate && aDate !== bDate) {
      return sort === "date-asc" ? aDate.localeCompare(bDate) : bDate.localeCompare(aDate);
    }
    if (aDate !== bDate) return aDate ? -1 : 1; // dated agendas always before undated
    return agendaNameCompare(a, b);
  });
  return arr;
}

function FileLine({
  file,
  versions,
  canManage,
  isAdmin,
  userId,
  peerMap,
  uploaderNames,
  peerSequence,
  showMeetingDate,
  onDownload,
  onDelete,
  onSetStatus,
  onOpenComments,
  onRefresh,
}: {
  file: FileRow;
  versions: VersionRow[];
  canManage: boolean;
  showMeetingDate?: boolean;
} & RowCommonProps) {
  const current = versions.find((v) => v.id === file.current_version_id) ?? versions[0];
  const [viewerOpen, setViewerOpen] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const calculateScore = useServerFn(autoAssessPeerReviewUpload);
  const queryClient = useQueryClient();
  const isPeerReview = file.subsection === "Mid-Semester Peer Reviews";
  const uploadNumber = current ? peerSequence.get(current.id) : undefined;
  const assessment = current ? peerMap.get(current.id) : undefined;
  const fixes = peerPriorityFixes(assessment?.score, assessment?.changes);
  const handleCalculateScore = async () => {
    if (!current || calculating) return;
    setCalculating(true);
    try {
      const result = await calculateScore({ data: { versionId: current.id } });
      if (result.status === "assessed" || (result.status === "already" && result.score != null)) {
        toast.success(`Peer review score posted: ${result.score}/10`);
      } else if (result.status === "unreadable" || result.status === "already") {
        toast.warning("This upload needs instructor review; no score has been invented.");
      } else if (result.status === "limit") {
        toast.warning("The submission limit has been reached. Instructor review is required.");
      } else {
        toast.warning("This upload is not eligible for automatic assessment.");
      }
    } catch {
      toast.error("The score could not be calculated. Please try again.");
    } finally {
      onRefresh();
      void queryClient.invalidateQueries({ queryKey: ["peer-review-assessments"] });
      setCalculating(false);
    }
  };
  const uploaderName = uploaderNames.get(current?.uploaded_by ?? file.uploaded_by) ?? "Name unavailable";
  const assignedName = file.assigned_to
    ? uploaderNames.get(file.assigned_to)
    : undefined;

  const handleStatusChange = (v: string) => {
    const next = v as VaultStatus;
    if (next === "Needs Revision") {
      // Open the comment dialog; status will be saved together with the comment
      onOpenComments(file, next);
      return;
    }
    onSetStatus(file, next);
  };

  return (
    <Card className="border-border/60">
      <CardContent className="p-2.5 flex flex-wrap items-start gap-2">
        <FileText className="h-4 w-4 text-gold mt-0.5 shrink-0" />
        <div className="flex-1 min-w-[min(100%,16rem)]">
          {showMeetingDate && (
            <div className="font-display text-sm font-semibold leading-tight">
              {file.meeting_date ? (
                formatMeetingDate(file.meeting_date)
              ) : (
                <span className="text-xs italic font-normal text-muted-foreground">
                  Meeting date not set
                </span>
              )}
            </div>
          )}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-sm break-words min-w-0">{file.file_name}</span>
            {current && (
              <Badge variant="outline" className="text-[10px]">
                {isPeerReview
                  ? uploadNumber === 1 ? "Original Peer Review" : uploadNumber ? `Revised Peer Review · Upload ${uploadNumber}` : "Peer Review · Order unverified"
                  : current.version_number === 1 ? "Original · v1" : `Revised · v${current.version_number}`}
              </Badge>
            )}
            {file.is_locked && (
              <Badge variant="outline" className="text-[10px] bg-gold/15 text-gold border-gold/30">
                {file.is_template ? "Template · read-only" : "Read-only"}
              </Badge>
            )}
            <Badge variant="outline" className={`text-[10px] ${STATUS_TONE[file.status]}`}>
              {file.status}
            </Badge>
            {(() => {
              if (!assessment) return null;
              return (
                <Badge
                  variant="outline"
                  className={`text-[10px] ${peerBadgeTone(assessment.score)}`}
                >
                  {peerBadgeLabel(assessment)}
                </Badge>
              );
            })()}
          </div>
          <div className="text-xs font-medium mt-1 break-words">
            Uploaded by {uploaderName}
            {assignedName && file.assigned_to !== (current?.uploaded_by ?? file.uploaded_by) && (
              <span className="text-muted-foreground"> · For {assignedName}</span>
            )}
          </div>
          {isPeerReview && !assessment && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {uploadNumber && uploadNumber > 1
                ? "Stand by — revised score being assessed · Target: 8/10 or higher"
                : "No assessment recorded for this upload."}
            </p>
          )}
          {isPeerReview && isAdmin && current && assessment?.score == null && (
            <Button variant="outline" size="sm" className="mt-2" disabled={calculating}
              onClick={() => void handleCalculateScore()}>
              {calculating ? <LoaderCircle className="mr-1 h-4 w-4 animate-spin" /> : <Calculator className="mr-1 h-4 w-4" />}
              {calculating ? "Calculating score…" : "Calculate score"}
            </Button>
          )}
          {isPeerReview && fixes.length > 0 && (
            <div className="mt-2 text-xs" aria-live="polite">
              <p className="font-semibold">{assessment?.attempt === 1 && assessment.score === 7
                ? "Optional improvements toward 8/10 — your original passes"
                : "Priority fixes to reach 8/10"}</p>
              <ol className="mt-1 list-decimal space-y-1 pl-5 break-words">
                {fixes.map((fix, index) => <li key={index}>{fix}</li>)}
              </ol>
            </div>
          )}
          {file.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{file.description}</p>
          )}
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {fmtSize(current?.file_size)} · Uploaded {new Date(current?.uploaded_at ?? file.created_at).toLocaleDateString()}
          </div>
        </div>
        <div className="flex max-w-full flex-wrap items-center gap-0.5">
          {isAdmin && (
            <Select value={file.status} onValueChange={handleStatusChange}>
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
          {showMeetingDate && canManage && (
            <MeetingDateEditor file={file} onDone={onRefresh} />
          )}
          <Button
            variant="ghost" size="icon"
            onClick={() => setViewerOpen(true)}
            disabled={!current}
            aria-label="Read"
            title="Read without downloading"
          >
            <BookOpen className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost" size="icon"
            onClick={() => onOpenComments(file)}
            aria-label="Comments"
            title="Comments"
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost" size="icon"
            onClick={() => onDownload(file.current_version_id, file.file_name)}
            aria-label="Download"
          >
            <Download className="h-4 w-4" />
          </Button>
          {versions.length > 1 && (
            <VersionHistoryDialog file={file} versions={versions} uploaderNames={uploaderNames} peerSequence={peerSequence} onDownload={onDownload} />
          )}
          {canManage && userId && (
            <NewVersionButton file={file} userId={userId} versions={versions} onDone={onRefresh} />
          )}
          {canManage && !file.is_locked && !file.is_template && (
            <FileDetailsEditor file={file} onDone={onRefresh} />
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
      <FileViewerDialog
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        version={
          current
            ? { id: current.id, storage_path: current.storage_path, mime_type: current.mime_type }
            : null
        }
        fileName={file.file_name}
      />
    </Card>
  );
}

function FileDetailsEditor({ file, onDone }: { file: FileRow; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(file.file_name);
  const [section, setSection] = useState(file.section);
  const [subsection, setSubsection] = useState(file.subsection);
  const [final, setFinal] = useState(isFinalCompiled(file));
  const [busy, setBusy] = useState(false);
  const definition = VAULT_STRUCTURE.find((s) => s.name === section);
  const expectsCompiled = !!definition?.subsections.find((s) => s.name === subsection)?.expectsCompiled;

  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.from("files").update({
        file_name: expectsCompiled && final ? finalCompiledName(name) : name.trim(),
        section,
        subsection,
        assigned_to: expectsCompiled && final ? null : (section === file.section && subsection === file.subsection ? file.assigned_to : null),
      }).eq("id", file.id).select("id").single();
      if (error) throw error;
      if (!data) throw new Error("You do not have permission to change this file.");
      toast.success("File updated");
      setOpen(false);
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update this file");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => {
      setOpen(value);
      if (value) { setName(file.file_name); setSection(file.section); setSubsection(file.subsection); setFinal(isFinalCompiled(file)); }
    }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Rename or move file" title="Rename or move file">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename or move file</DialogTitle>
          <DialogDescription>{file.file_name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label htmlFor={`rename-${file.id}`}>Display name</Label><Input id={`rename-${file.id}`} value={name} maxLength={200} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Section</Label><Select value={section} onValueChange={(value) => {
            setSection(value); setSubsection(VAULT_STRUCTURE.find((s) => s.name === value)?.subsections[0]?.name ?? ""); setFinal(false);
          }}><SelectTrigger aria-label="File section"><SelectValue /></SelectTrigger><SelectContent>{VAULT_STRUCTURE.map((s) => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Folder</Label><Select value={subsection} onValueChange={(value) => { setSubsection(value); setFinal(false); }}><SelectTrigger aria-label="File folder"><SelectValue /></SelectTrigger><SelectContent>{definition?.subsections.map((s) => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}</SelectContent></Select></div>
          {expectsCompiled && <div className="space-y-1"><div className="flex items-center gap-2"><Checkbox id={`compiled-${file.id}`} checked={final} onCheckedChange={(value) => {
            setFinal(value === true);
            if (value !== true) setName((previous) => previous.replace(/^Final Compiled\s*-\s*/i, ""));
          }} /><Label htmlFor={`compiled-${file.id}`}>Final Compiled</Label></div><p className="text-xs text-muted-foreground">Check this for the combined version of everyone's work — the file will be named "Final Compiled - ..." and move into the Final Compiled slot.</p></div>}
        </div>
        <DialogFooter><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} disabled={busy || !name.trim()}>{busy ? "Saving…" : "Save"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VersionHistoryDialog({
  file, versions, uploaderNames, peerSequence, onDownload,
}: {
  file: FileRow;
  versions: VersionRow[];
  uploaderNames: Map<string, string>;
  peerSequence: Map<string, number>;
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
                  {file.subsection === "Mid-Semester Peer Reviews"
                    ? peerSequence.get(v.id) === 1 ? "Original Peer Review" : `Revised Peer Review · Upload ${peerSequence.get(v.id) ?? "?"}`
                    : v.version_number === 1 ? "Original · v1" : `Revised · v${v.version_number}`}
                  {v.id === file.current_version_id && (
                    <Badge variant="secondary" className="ml-2 text-[10px]">current</Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  Uploaded by {uploaderNames.get(v.uploaded_by) ?? "Name unavailable"}
                  <br />{new Date(v.uploaded_at).toLocaleString()} · {fmtSize(v.file_size)}
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
      const path = `teams/${file.team_id}/${file.id}/v${nextVer}-${safeStorageFileName(f.name)}`;
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
      if (file.subsection === "Mid-Semester Peer Reviews") runPeerAssessment(v.id, onDone);
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

function MeetingDateEditor({ file, onDone }: { file: FileRow; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(file.meeting_date ?? "");
  const [busy, setBusy] = useState(false);

  const save = async (next: string | null) => {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("files").update({ meeting_date: next } as any).eq("id", file.id);
      if (error) throw error;
      toast.success(next ? "Meeting date updated" : "Meeting date removed");
      setOpen(false);
      onDone();
    } catch (err: any) {
      toast.error(err.message ?? "Could not save the meeting date");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Set meeting date" title="Set meeting date">
          <Calendar className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">Meeting date</DialogTitle>
          <DialogDescription>
            The date of the meeting this agenda is for. It is shown above the file
            name and used for date sorting.
          </DialogDescription>
        </DialogHeader>
        <div>
          <Label htmlFor="md-date">Date</Label>
          <Input id="md-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="outline" disabled={busy || !file.meeting_date} onClick={() => save(null)}>
            Remove date
          </Button>
          <Button disabled={busy || !date} onClick={() => save(date)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UploadDialog({
  teamId, userId, members, onDone, sections,
}: {
  teamId: string;
  userId: string;
  members: MemberRow[];
  onDone: () => void;
  sections: VaultSection[];
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [section, setSection] = useState<string>(sections[0].name);
  const [subsection, setSubsection] = useState<string>(sections[0].subsections[0].name);
  const [compPlacement, setCompPlacement] = useState<string>("Submission");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [busy, setBusy] = useState(false);

  // Present the three Competition sections as one high-level "Competitions"
  // choice whose subsections are #1 / #2 / #3 (competition names).
  const competitionSections = sections.filter((s) => s.name.startsWith("Competition"));
  const sectionChoices: VaultSection[] = [
    ...sections.filter((s) => !s.name.startsWith("Competition")),
    ...(competitionSections.length
      ? [{ name: "Competitions", subsections: competitionSections.map((c) => ({ name: c.name.replace(/^Competition\s*/, "") })) }]
      : []),
  ];
  const isCompetitions = section === "Competitions";

  const subDef = sections.find((s) => s.name === section)?.subsections.find((x) => x.name === subsection);
  const showAssignee = !!subDef?.perMember && members.length > 0;
  const isCompetition = isCompetitions || section.startsWith("Competition");

  const onSectionChange = (s: string) => {
    setSection(s);
    const first = sectionChoices.find((x) => x.name === s)?.subsections[0]?.name;
    if (first) setSubsection(first);
    setCompPlacement("Submission");
    setAssignedTo("");
  };

  const reset = () => {
    setFile(null); setName(""); setDescription(""); setMeetingDate("");
    setSection(sections[0].name);
    setSubsection(sections[0].subsections[0].name);
    setAssignedTo("");
  };

  const submit = async () => {
    if (!file) return toast.error("Pick a file first");
    const rawName = name.trim() || file.name;
    const fileName = showAssignee && assignedTo === "final" ? finalCompiledName(rawName) : rawName;
    // Map the virtual "Competitions" choice back to the stored section/subsection.
    const storedSection = isCompetitions ? `Competition ${subsection}` : section;
    const storedSubsection = isCompetitions ? compPlacement : subsection;
    setBusy(true);
    try {
      const { data: created, error: cErr } = await supabase
        .from("files")
        .insert({
          team_id: teamId,
          file_name: fileName,
          description: description.trim() || null,
          section: storedSection,
          subsection: storedSubsection,
          meeting_date: subsection === "Agendas" && meetingDate ? meetingDate : null,
          assigned_to: showAssignee && assignedTo && assignedTo !== "final" && assignedTo !== "other" ? assignedTo : null,
          uploaded_by: userId,
          is_template: false,
          category: "Other",
        } as any)
        .select("id").single();
      if (cErr) throw cErr;

      const path = `teams/${teamId}/${created.id}/v1-${safeStorageFileName(file.name)}`;
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

      toast.success(
        isCompetition
          ? `File uploaded — it has been placed in the Competitions area under ${storedSection}.`
          : "File uploaded"
      );
      reset();
      setOpen(false);
      onDone();
      if (storedSubsection === "Mid-Semester Peer Reviews") runPeerAssessment(ver.id, onDone);
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const subsForSection = sectionChoices.find((s) => s.name === section)?.subsections ?? [];

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
                  {sectionChoices.map((s) => (
                    <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isCompetition && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Competition files live in the Competitions area — this file will be filed there.
                </p>
              )}
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
          {isCompetitions && (
            <div>
              <Label>Placement</Label>
              <Select value={compPlacement} onValueChange={setCompPlacement}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Submission">Submission</SelectItem>
                  <SelectItem value="Supporting Materials">Supporting Materials</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {subsection === "Agendas" && !isCompetitions && (
            <div>
              <Label htmlFor="vf-meeting-date">Meeting date (the date this agenda is for)</Label>
              <Input
                id="vf-meeting-date" type="date" value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
              />
            </div>
          )}
          {showAssignee && (
            <div>
              <Label>Placement</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger><SelectValue placeholder="Choose a team member or Final Compiled" /></SelectTrigger>
                <SelectContent>
                  {subDef?.expectsCompiled && <SelectItem value="final">Final Compiled</SelectItem>}
                  <SelectItem value="other">Other uploads</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.name || m.email || "Member"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {subDef?.expectsCompiled && (
                <p className="text-xs text-muted-foreground mt-1">
                  Choose <strong>Final Compiled</strong> only for the combined version of everyone's questions — it will be named "Final Compiled - ..." automatically and appear in the Final Compiled slot.
                </p>
              )}
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

type CommentRow = {
  id: string;
  file_id: string;
  team_id: string;
  author_id: string;
  body: string;
  recipient_ids: string[];
  to_entire_team: boolean;
  related_status: VaultStatus | null;
  created_at: string;
};

function CommentsDialog({
  file,
  members,
  userId,
  isAdmin,
  presetStatus,
  onClose,
  onAfterSave,
}: {
  file: FileRow;
  members: MemberRow[];
  userId: string;
  isAdmin: boolean;
  presetStatus?: VaultStatus;
  onClose: () => void;
  onAfterSave: () => void;
}) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [toAll, setToAll] = useState(true);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const { data: comments } = useQuery({
    queryKey: ["file-comments", file.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("file_comments" as any)
        .select("*")
        .eq("file_id", file.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as CommentRow[];
    },
  });

  const memberLookup = useMemo(() => {
    const m = new Map<string, MemberRow>();
    members.forEach((x) => m.set(x.user_id, x));
    return m;
  }, [members]);

  const toggleRecipient = (id: string) => {
    setRecipients((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));
    setToAll(false);
  };

  const submit = async () => {
    const trimmed = body.trim();
    if (!trimmed) return toast.error("Add a message first");
    if (!toAll && recipients.length === 0)
      return toast.error("Pick at least one recipient or send to the entire team");
    setBusy(true);
    try {
      const { error: cErr } = await supabase.from("file_comments" as any).insert({
        file_id: file.id,
        team_id: file.team_id,
        author_id: userId,
        body: trimmed,
        recipient_ids: toAll ? [] : recipients,
        to_entire_team: toAll,
        related_status: presetStatus ?? null,
      });
      if (cErr) throw cErr;

      if (presetStatus) {
        const { error: sErr } = await supabase
          .from("files")
          .update({ status: presetStatus } as any)
          .eq("id", file.id);
        if (sErr) throw sErr;
      }

      toast.success(presetStatus ? `Marked ${presetStatus} and comment sent` : "Comment sent");
      setBody("");
      qc.invalidateQueries({ queryKey: ["file-comments", file.id] });
      onAfterSave();
      onClose();
    } catch (err: any) {
      toast.error(err.message ?? "Could not save comment");
    } finally {
      setBusy(false);
    }
  };

  const canDelete = (c: CommentRow) => isAdmin || c.author_id === userId;
  const deleteComment = async (c: CommentRow) => {
    if (!confirm("Delete this comment?")) return;
    const { error } = await supabase.from("file_comments" as any).delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["file-comments", file.id] });
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-gold" /> Comments
          </DialogTitle>
          <DialogDescription>
            {file.file_name}
            {presetStatus && (
              <span className="ml-2">
                <Badge variant="outline" className={`text-[10px] ${STATUS_TONE[presetStatus]}`}>
                  Will set: {presetStatus}
                </Badge>
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Thread */}
        <div className="max-h-56 overflow-y-auto space-y-2 border rounded-md p-2 bg-muted/20">
          {(comments ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No comments yet.</p>
          ) : (
            (comments ?? []).map((c) => {
              const author = memberLookup.get(c.author_id);
              const recipientLabels = c.to_entire_team
                ? ["Entire team"]
                : c.recipient_ids.map(
                    (id) =>
                      memberLookup.get(id)?.name ||
                      memberLookup.get(id)?.email ||
                      "Unknown",
                  );
              return (
                <div key={c.id} className="rounded border bg-background p-2 text-sm">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 text-xs font-medium">
                      <StudentName
                        name={author?.name}
                        email={author?.email}
                        avatarUrl={author?.avatar_url}
                        size={20}
                      />
                      <span className="text-muted-foreground font-normal">
                        {" · "}
                        {new Date(c.created_at).toLocaleString()}
                      </span>
                    </div>
                    {canDelete(c) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => deleteComment(c)}
                        aria-label="Delete comment"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{c.body}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {recipientLabels.map((l) => (
                      <Badge key={l} variant="secondary" className="text-[10px]">
                        {l}
                      </Badge>
                    ))}
                    {c.related_status && (
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${STATUS_TONE[c.related_status]}`}
                      >
                        {c.related_status}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Compose */}
        <div className="space-y-3">
          <div>
            <Label htmlFor="cd-body">Message</Label>
            <Textarea
              id="cd-body"
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, 2000))}
              rows={3}
              placeholder={
                presetStatus === "Needs Revision"
                  ? "What needs to be fixed?"
                  : "Add a comment…"
              }
            />
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Send to
            </Label>
            <div className="mt-1 rounded border p-2 space-y-1.5">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={toAll}
                  onCheckedChange={(v) => {
                    const next = !!v;
                    setToAll(next);
                    if (next) setRecipients([]);
                  }}
                />
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Entire team</span>
              </label>
              {members.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  No team members to direct this to.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-1.5 pt-1 border-t">
                  {members.map((m) => (
                    <label
                      key={m.user_id}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <Checkbox
                        checked={recipients.includes(m.user_id)}
                        onCheckedChange={() => toggleRecipient(m.user_id)}
                      />
                      <span className="truncate">{m.name || m.email || "Member"}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !body.trim()}>
            {busy ? "Sending…" : presetStatus ? `Send & mark ${presetStatus}` : "Send comment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
