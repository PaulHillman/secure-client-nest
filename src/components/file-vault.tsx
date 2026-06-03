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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  FileText,
  Upload,
  Download,
  History,
  Trash2,
  FolderOpen,
  FileBox,
} from "lucide-react";

const CATEGORIES = [
  "Research",
  "Deliverables",
  "Meeting Notes",
  "Client Comms",
  "Other",
] as const;

type FileRow = {
  id: string;
  team_id: string;
  file_name: string;
  description: string | null;
  category: string;
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

function fmtSize(bytes?: number | null) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileVault({ teamId }: { teamId: string }) {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"team" | "templates">("team");

  const { data, isLoading } = useQuery({
    queryKey: ["vault", teamId],
    queryFn: async () => {
      const [{ data: files, error: fErr }, { data: versions, error: vErr }] =
        await Promise.all([
          supabase
            .from("files")
            .select("*")
            .eq("team_id", teamId)
            .order("updated_at", { ascending: false }),
          supabase
            .from("file_versions")
            .select("*")
            .order("version_number", { ascending: false }),
        ]);
      if (fErr) throw fErr;
      if (vErr) throw vErr;
      const verMap = new Map<string, VersionRow[]>();
      (versions ?? []).forEach((v) => {
        const arr = verMap.get(v.file_id) ?? [];
        arr.push(v as VersionRow);
        verMap.set(v.file_id, arr);
      });
      return { files: (files ?? []) as FileRow[], verMap };
    },
  });

  const files = data?.files ?? [];
  const verMap = data?.verMap ?? new Map<string, VersionRow[]>();

  const templates = useMemo(() => files.filter((f) => f.is_template), [files]);
  const teamFiles = useMemo(() => files.filter((f) => !f.is_template), [files]);

  const grouped = useMemo(() => {
    const g: Record<string, FileRow[]> = {};
    for (const c of CATEGORIES) g[c] = [];
    for (const f of teamFiles) {
      (g[f.category] ?? (g[f.category] = [])).push(f);
    }
    return g;
  }, [teamFiles]);

  const download = async (versionId: string | null, fileName: string) => {
    if (!versionId) return toast.error("No version available");
    const { data: v } = await supabase
      .from("file_versions")
      .select("storage_path")
      .eq("id", versionId)
      .single();
    if (!v) return toast.error("Version not found");
    const { data: signed, error } = await supabase.storage
      .from("vault")
      .createSignedUrl(v.storage_path, 60, { download: fileName });
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

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-gold" />
          <h2 className="font-display text-2xl">File Vault</h2>
        </div>
        {user && (
          <UploadDialog
            teamId={teamId}
            isAdmin={isAdmin}
            userId={user.id}
            onDone={() => qc.invalidateQueries({ queryKey: ["vault", teamId] })}
          />
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "team" | "templates")}>
        <TabsList>
          <TabsTrigger value="team">
            Team files <span className="ml-1 text-xs opacity-70">({teamFiles.length})</span>
          </TabsTrigger>
          <TabsTrigger value="templates">
            <FileBox className="h-3.5 w-3.5 mr-1" />
            Templates <span className="ml-1 text-xs opacity-70">({templates.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="team" className="mt-4 space-y-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading files…</p>
          ) : teamFiles.length === 0 ? (
            <EmptyState message="No files yet. Upload research, deliverables and meeting notes here." />
          ) : (
            CATEGORIES.map((cat) =>
              grouped[cat].length === 0 ? null : (
                <div key={cat}>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">{cat}</h3>
                  <div className="space-y-2">
                    {grouped[cat].map((f) => (
                      <FileRowCard
                        key={f.id}
                        file={f}
                        versions={verMap.get(f.id) ?? []}
                        canManage={isAdmin || f.uploaded_by === user?.id}
                        onDownload={download}
                        onDelete={remove}
                        onNewVersion={() => qc.invalidateQueries({ queryKey: ["vault", teamId] })}
                        userId={user?.id}
                      />
                    ))}
                  </div>
                </div>
              ),
            )
          )}
        </TabsContent>

        <TabsContent value="templates" className="mt-4 space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading templates…</p>
          ) : templates.length === 0 ? (
            <EmptyState
              message={
                isAdmin
                  ? "No templates yet. Upload a template and toggle 'Mark as template'."
                  : "Your instructor hasn't added templates for this team yet."
              }
            />
          ) : (
            templates.map((f) => (
              <FileRowCard
                key={f.id}
                file={f}
                versions={verMap.get(f.id) ?? []}
                canManage={isAdmin}
                onDownload={download}
                onDelete={remove}
                onNewVersion={() => qc.invalidateQueries({ queryKey: ["vault", teamId] })}
                userId={user?.id}
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="py-10 text-center text-sm text-muted-foreground">
        {message}
      </CardContent>
    </Card>
  );
}

function FileRowCard({
  file,
  versions,
  canManage,
  onDownload,
  onDelete,
  onNewVersion,
  userId,
}: {
  file: FileRow;
  versions: VersionRow[];
  canManage: boolean;
  onDownload: (versionId: string | null, fileName: string) => void;
  onDelete: (f: FileRow) => void;
  onNewVersion: () => void;
  userId?: string;
}) {
  const current = versions.find((v) => v.id === file.current_version_id) ?? versions[0];
  return (
    <Card className="border-border/60">
      <CardContent className="p-4 flex items-start gap-3">
        <FileText className="h-5 w-5 text-gold mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">{file.file_name}</span>
            {file.is_template && (
              <Badge variant="secondary" className="text-[10px]">Template</Badge>
            )}
            {current && (
              <Badge variant="outline" className="text-[10px]">v{current.version_number}</Badge>
            )}
          </div>
          {file.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{file.description}</p>
          )}
          <div className="text-xs text-muted-foreground mt-1">
            {fmtSize(current?.file_size)} · Updated {new Date(file.updated_at).toLocaleDateString()}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDownload(file.current_version_id, file.file_name)}
            aria-label="Download"
          >
            <Download className="h-4 w-4" />
          </Button>
          {versions.length > 1 && (
            <VersionHistoryDialog file={file} versions={versions} onDownload={onDownload} />
          )}
          {canManage && userId && (
            <NewVersionButton file={file} userId={userId} versions={versions} onDone={onNewVersion} />
          )}
          {canManage && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(file)}
              aria-label="Delete"
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
  file,
  versions,
  onDownload,
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
            <div
              key={v.id}
              className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
            >
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
              <Button
                size="sm"
                variant="outline"
                onClick={() => onDownload(v.id, file.file_name)}
              >
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
  file,
  userId,
  versions,
  onDone,
}: {
  file: FileRow;
  userId: string;
  versions: VersionRow[];
  onDone: () => void;
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
        .from("vault")
        .upload(path, f, { contentType: f.type, upsert: false });
      if (upErr) throw upErr;
      const { data: v, error: vErr } = await supabase
        .from("file_versions")
        .insert({
          file_id: file.id,
          version_number: nextVer,
          storage_path: path,
          file_size: f.size,
          mime_type: f.type,
          uploaded_by: userId,
        })
        .select("id")
        .single();
      if (vErr) throw vErr;
      await supabase
        .from("files")
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
        variant="ghost"
        size="icon"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        aria-label="Upload new version"
      >
        <Upload className="h-4 w-4" />
      </Button>
    </>
  );
}

function UploadDialog({
  teamId,
  isAdmin,
  userId,
  onDone,
}: {
  teamId: string;
  isAdmin: boolean;
  userId: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("Research");
  const [isTemplate, setIsTemplate] = useState(false);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setFile(null);
    setName("");
    setDescription("");
    setCategory("Research");
    setIsTemplate(false);
  };

  const submit = async () => {
    if (!file) return toast.error("Pick a file first");
    const fileName = name.trim() || file.name;
    setBusy(true);
    try {
      // 1. Create file row
      const { data: created, error: cErr } = await supabase
        .from("files")
        .insert({
          team_id: teamId,
          file_name: fileName,
          description: description.trim() || null,
          category,
          uploaded_by: userId,
          is_template: isAdmin && isTemplate,
        } as any)
        .select("id")
        .single();
      if (cErr) throw cErr;

      // 2. Upload to storage
      const path = `teams/${teamId}/${created.id}/v1-${file.name}`;
      const { error: upErr } = await supabase.storage
        .from("vault")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) {
        await supabase.from("files").delete().eq("id", created.id);
        throw upErr;
      }

      // 3. Create version row
      const { data: ver, error: vErr } = await supabase
        .from("file_versions")
        .insert({
          file_id: created.id,
          version_number: 1,
          storage_path: path,
          file_size: file.size,
          mime_type: file.type,
          uploaded_by: userId,
        })
        .select("id")
        .single();
      if (vErr) throw vErr;

      // 4. Link current version
      await supabase
        .from("files")
        .update({ current_version_id: ver.id })
        .eq("id", created.id);

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
            Files are private to this team. New versions can be added later.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="vf-file">File</Label>
            <Input
              id="vf-file"
              type="file"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                if (f && !name) setName(f.name);
              }}
            />
          </div>
          <div>
            <Label htmlFor="vf-name">Display name</Label>
            <Input
              id="vf-name"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 200))}
              placeholder="e.g. Stakeholder interview transcript"
            />
          </div>
          <div>
            <Label htmlFor="vf-cat">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="vf-cat"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="vf-desc">Description (optional)</Label>
            <Textarea
              id="vf-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
              rows={3}
              placeholder="What's in this file?"
            />
          </div>
          {isAdmin && (
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label htmlFor="vf-tpl" className="cursor-pointer">Mark as template</Label>
                <p className="text-xs text-muted-foreground">Only admins can edit templates.</p>
              </div>
              <Switch id="vf-tpl" checked={isTemplate} onCheckedChange={setIsTemplate} />
            </div>
          )}
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
