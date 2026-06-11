import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { FileText, Upload, Trash2, Send, Download, Plus, Lock } from "lucide-react";
import { VAULT_STRUCTURE, findSubsection } from "@/lib/vault-structure";

type TemplateRow = {
  id: string;
  file_name: string;
  description: string | null;
  section: string;
  subsection: string;
  current_version_id: string | null;
  updated_at: string;
};

type VersionRow = {
  id: string;
  file_id: string;
  version_number: number;
  storage_path: string;
  file_size: number | null;
  mime_type: string | null;
};

export function TemplatesPanel() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "templates"],
    queryFn: async () => {
      const { data: tpls, error } = await supabase
        .from("files")
        .select("id, file_name, description, section, subsection, current_version_id, updated_at")
        .is("team_id", null)
        .eq("is_template", true)
        .order("section")
        .order("subsection")
        .order("file_name");
      if (error) throw error;

      const ids = (tpls ?? []).map((t) => t.id);
      let vers: VersionRow[] = [];
      if (ids.length) {
        const { data: v } = await supabase
          .from("file_versions")
          .select("id, file_id, version_number, storage_path, file_size, mime_type")
          .in("file_id", ids);
        vers = (v ?? []) as VersionRow[];
      }
      const vMap = new Map<string, VersionRow>();
      for (const t of tpls ?? []) {
        const cur = vers.find((x) => x.id === t.current_version_id);
        if (cur) vMap.set(t.id, cur);
      }
      return { templates: (tpls ?? []) as TemplateRow[], vMap };
    },
  });

  const templates = data?.templates ?? [];
  const vMap = data?.vMap ?? new Map<string, VersionRow>();

  const removeTpl = useMutation({
    mutationFn: async (t: TemplateRow) => {
      // Delete storage objects for all its versions first
      const { data: vs } = await supabase
        .from("file_versions").select("storage_path").eq("file_id", t.id);
      const paths = (vs ?? []).map((v) => v.storage_path);
      if (paths.length) await supabase.storage.from("vault").remove(paths);
      const { error } = await supabase.from("files").delete().eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Template deleted");
      qc.invalidateQueries({ queryKey: ["admin", "templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const download = async (t: TemplateRow) => {
    const cur = vMap.get(t.id);
    if (!cur) return toast.error("No version available");
    const { data: signed, error } = await supabase.storage
      .from("vault").createSignedUrl(cur.storage_path, 60, { download: t.file_name });
    if (error || !signed) return toast.error("Could not generate download link");
    window.open(signed.signedUrl, "_blank");
  };

  // Group templates by section
  const grouped = new Map<string, TemplateRow[]>();
  for (const t of templates) {
    const arr = grouped.get(t.section) ?? [];
    arr.push(t);
    grouped.set(t.section, arr);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="font-display text-xl flex items-center gap-2">
                <Lock className="h-5 w-5 text-gold" /> Templates
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Upload starter files here, then push them into every team's vault. Pushed copies are{" "}
                <span className="font-medium">read-only</span> for team members — only you can replace them.
                Re-pushing creates a new version on each team's copy without overwriting anything else they've added.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {user && (
                <PushAllButton
                  templates={templates}
                  vMap={vMap}
                  userId={user.id}
                  onDone={() =>
                    qc.invalidateQueries({ queryKey: ["admin", "templates"] })
                  }
                />
              )}
              {user && (
                <UploadTemplateDialog
                  userId={user.id}
                  onDone={() => qc.invalidateQueries({ queryKey: ["admin", "templates"] })}
                />
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading templates…</p>
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No templates yet. Upload one to get started.
            </p>
          ) : (
            <div className="space-y-5">
              {VAULT_STRUCTURE.map((sec) => {
                const list = grouped.get(sec.name);
                if (!list?.length) return null;
                return (
                  <div key={sec.name}>
                    <h4 className="font-display text-base mb-2">{sec.name}</h4>
                    <div className="space-y-2">
                      {list.map((t) => {
                        const cur = vMap.get(t.id);
                        return (
                          <div
                            key={t.id}
                            className="flex items-center gap-2 rounded-md border bg-card/40 px-3 py-2"
                          >
                            <FileText className="h-4 w-4 text-gold shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-sm font-medium truncate">{t.file_name}</span>
                                <Badge variant="outline" className="text-[10px]">
                                  {t.subsection}
                                </Badge>
                                {cur && (
                                  <Badge variant="outline" className="text-[10px]">
                                    v{cur.version_number}
                                  </Badge>
                                )}
                              </div>
                              {t.description && (
                                <p className="text-xs text-muted-foreground line-clamp-1">
                                  {t.description}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-0.5">
                              <Button variant="ghost" size="icon" onClick={() => download(t)} title="Download">
                                <Download className="h-4 w-4" />
                              </Button>
                              {user && (
                                <NewTemplateVersionButton
                                  template={t}
                                  userId={user.id}
                                  onDone={() =>
                                    qc.invalidateQueries({ queryKey: ["admin", "templates"] })
                                  }
                                />
                              )}
                              {user && (
                                <PushOneButton
                                  template={t}
                                  current={cur}
                                  userId={user.id}
                                  onDone={() =>
                                    qc.invalidateQueries({ queryKey: ["admin", "templates"] })
                                  }
                                />
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  if (confirm(`Delete template "${t.file_name}"? Existing team copies are not removed.`))
                                    removeTpl.mutate(t);
                                }}
                                title="Delete template"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- Upload new template ---------------- */

function UploadTemplateDialog({
  userId,
  onDone,
}: {
  userId: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [section, setSection] = useState<string>(VAULT_STRUCTURE[0].name);
  const [subsection, setSubsection] = useState<string>(VAULT_STRUCTURE[0].subsections[0].name);
  const [busy, setBusy] = useState(false);

  const onSectionChange = (s: string) => {
    setSection(s);
    const first = VAULT_STRUCTURE.find((x) => x.name === s)?.subsections[0].name;
    if (first) setSubsection(first);
  };

  const subsForSection = VAULT_STRUCTURE.find((s) => s.name === section)?.subsections ?? [];

  const reset = () => {
    setFile(null); setName(""); setDescription("");
    setSection(VAULT_STRUCTURE[0].name);
    setSubsection(VAULT_STRUCTURE[0].subsections[0].name);
  };

  const submit = async () => {
    if (!file) return toast.error("Pick a file first");
    const fileName = name.trim() || file.name;
    setBusy(true);
    try {
      const { data: created, error: cErr } = await supabase
        .from("files")
        .insert({
          team_id: null,
          file_name: fileName,
          description: description.trim() || null,
          section,
          subsection,
          uploaded_by: userId,
          is_template: true,
          is_locked: false, // lock only applies to team copies
          category: "Other",
        } as any)
        .select("id").single();
      if (cErr) throw cErr;

      const path = `templates/${created.id}/v1-${file.name}`;
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
      await supabase.from("files").update({ current_version_id: ver.id }).eq("id", created.id);

      toast.success("Template uploaded");
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" /> New template
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Upload template</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>File</Label>
            <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div>
            <Label>Display name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="(leave blank to use the file name)" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
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
        </div>
        <DialogFooter>
          <Button disabled={busy || !file} onClick={submit}>
            <Upload className="h-4 w-4 mr-1" /> {busy ? "Uploading…" : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Replace template with a new version ---------------- */

function NewTemplateVersionButton({
  template, userId, onDone,
}: {
  template: TemplateRow; userId: string; onDone: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    try {
      const { data: existing } = await supabase
        .from("file_versions").select("version_number")
        .eq("file_id", template.id)
        .order("version_number", { ascending: false }).limit(1);
      const nextVer = (existing?.[0]?.version_number ?? 0) + 1;
      const path = `templates/${template.id}/v${nextVer}-${f.name}`;
      const { error: upErr } = await supabase.storage
        .from("vault").upload(path, f, { contentType: f.type, upsert: false });
      if (upErr) throw upErr;
      const { data: v, error: vErr } = await supabase
        .from("file_versions")
        .insert({
          file_id: template.id, version_number: nextVer, storage_path: path,
          file_size: f.size, mime_type: f.type, uploaded_by: userId,
        })
        .select("id").single();
      if (vErr) throw vErr;
      await supabase.from("files")
        .update({ current_version_id: v.id, updated_at: new Date().toISOString() })
        .eq("id", template.id);
      toast.success(`Template updated to v${nextVer}`);
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
        onClick={() => inputRef.current?.click()} title="Replace with new version"
      >
        <Upload className="h-4 w-4" />
      </Button>
    </>
  );
}

/* ---------------- Push helpers ---------------- */

async function pushTemplateToTeams(
  template: TemplateRow,
  current: VersionRow | undefined,
  userId: string,
): Promise<{ pushed: number; skipped: number }> {
  if (!current) {
    toast.error(`"${template.file_name}" has no file to push`);
    return { pushed: 0, skipped: 0 };
  }

  const { data: teams, error: tErr } = await supabase.from("teams").select("id");
  if (tErr) throw tErr;

  let pushed = 0;
  let skipped = 0;

  for (const team of teams ?? []) {
    try {
      // Find or create the team-side file row
      let { data: existing } = await supabase
        .from("files")
        .select("id")
        .eq("team_id", team.id)
        .eq("template_source_id", template.id)
        .maybeSingle();

      let teamFileId = existing?.id as string | undefined;

      if (!teamFileId) {
        const { data: created, error: cErr } = await supabase
          .from("files")
          .insert({
            team_id: team.id,
            file_name: template.file_name,
            description: template.description,
            section: template.section,
            subsection: template.subsection,
            uploaded_by: userId,
            is_template: false,
            is_locked: true,
            template_source_id: template.id,
            category: "Other",
          } as any)
          .select("id").single();
        if (cErr) throw cErr;
        teamFileId = created.id;
      }

      // Next version number for this team's file
      const { data: vs } = await supabase
        .from("file_versions").select("version_number")
        .eq("file_id", teamFileId!)
        .order("version_number", { ascending: false }).limit(1);
      const nextVer = (vs?.[0]?.version_number ?? 0) + 1;

      const baseName = template.file_name.replace(/[^\w.\-]+/g, "_");
      const dstPath = `teams/${team.id}/${teamFileId}/v${nextVer}-${baseName}`;

      // Copy storage object from template to team
      const { error: cpErr } = await supabase.storage
        .from("vault").copy(current.storage_path, dstPath);
      if (cpErr) throw cpErr;

      const { data: nv, error: nvErr } = await supabase
        .from("file_versions")
        .insert({
          file_id: teamFileId!,
          version_number: nextVer,
          storage_path: dstPath,
          file_size: current.file_size,
          mime_type: current.mime_type,
          uploaded_by: userId,
        })
        .select("id").single();
      if (nvErr) throw nvErr;

      await supabase.from("files")
        .update({ current_version_id: nv.id, updated_at: new Date().toISOString() })
        .eq("id", teamFileId!);
      pushed += 1;
    } catch (e: any) {
      console.error("Push failed for team", team.id, e);
      skipped += 1;
    }
  }

  return { pushed, skipped };
}

function PushOneButton({
  template, current, userId, onDone,
}: {
  template: TemplateRow;
  current: VersionRow | undefined;
  userId: string;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="ghost" size="icon" disabled={busy || !current}
      title="Push this template to all teams"
      onClick={async () => {
        if (!confirm(`Push "${template.file_name}" to all teams now?`)) return;
        setBusy(true);
        try {
          const res = await pushTemplateToTeams(template, current, userId);
          toast.success(`Pushed to ${res.pushed} team(s)${res.skipped ? ` · ${res.skipped} skipped` : ""}`);
          onDone();
        } catch (e: any) {
          toast.error(e.message ?? "Push failed");
        } finally {
          setBusy(false);
        }
      }}
    >
      <Send className="h-4 w-4" />
    </Button>
  );
}

function PushAllButton({
  templates, vMap, userId, onDone,
}: {
  templates: TemplateRow[];
  vMap: Map<string, VersionRow>;
  userId: string;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const ready = templates.filter((t) => vMap.get(t.id));
  return (
    <Button
      variant="default" size="sm" disabled={busy || ready.length === 0}
      onClick={async () => {
        if (!confirm(`Push ${ready.length} template(s) to all teams?\n\nExisting team copies will get a new version; team members keep their own uploads untouched.`)) return;
        setBusy(true);
        let pushed = 0, skipped = 0;
        try {
          for (const t of ready) {
            const r = await pushTemplateToTeams(t, vMap.get(t.id), userId);
            pushed += r.pushed;
            skipped += r.skipped;
          }
          toast.success(`Pushed ${pushed} file(s) total${skipped ? ` · ${skipped} skipped` : ""}`);
          onDone();
        } catch (e: any) {
          toast.error(e.message ?? "Push failed");
        } finally {
          setBusy(false);
        }
      }}
    >
      <Send className="h-4 w-4 mr-1" /> {busy ? "Pushing…" : "Push all to teams"}
    </Button>
  );
}
