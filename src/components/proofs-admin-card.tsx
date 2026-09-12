import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getProofOverview, saveProofMaterial } from "@/lib/proofs.functions";
import { PROOFS, proofByKey } from "@/lib/proofs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StudentName } from "@/components/student-avatar";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";

const ALL = "__all__";

/** Professor view: post the course material, and see who has completed what. */
export function ProofsAdminCard() {
  const qc = useQueryClient();
  const fetchOverview = useServerFn(getProofOverview);
  const save = useServerFn(saveProofMaterial);

  const [section, setSection] = useState(ALL);
  const [editKey, setEditKey] = useState<string>("comms_minutes");
  const [transcript, setTranscript] = useState("");
  const [answerKey, setAnswerKey] = useState("");
  const [extra, setExtra] = useState("");
  const [busy, setBusy] = useState(false);

  const { data } = useQuery({ queryKey: ["proof-overview"], queryFn: () => fetchOverview() });

  const sections = useMemo(
    () => Array.from(new Set((data?.rows ?? []).map((r) => r.section).filter(Boolean))).sort(),
    [data],
  );
  const rows = (data?.rows ?? []).filter((r) => section === ALL || r.section === section);
  const editing = proofByKey(editKey);
  const materialState = data?.materials.find((m) => m.key === editKey);

  const refresh = () => void qc.invalidateQueries({ queryKey: ["proof-overview"] });

  async function persist(patch: Record<string, unknown>) {
    setBusy(true);
    try {
      await save({ data: { proofKey: editKey, ...patch } as never });
      toast.success("Saved.");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadCourseFile(file: File, field: "audioPath" | "zipPath") {
    setBusy(true);
    try {
      const path = `course/${editKey}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
      const { error } = await supabase.storage.from("proofs").upload(path, file);
      if (error) throw error;
      await save({ data: { proofKey: editKey, [field]: path } as never });
      toast.success("Uploaded.");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Role practice activities</CardTitle>
        <CardDescription>
          Twelve short individual exercises. Students submit each once; submitting completes it. Four
          use course material posted below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3 rounded-md border p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Label className="shrink-0">Activity</Label>
            <Select value={editKey} onValueChange={setEditKey}>
              <SelectTrigger className="w-[320px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROOFS.map((p) => (
                  <SelectItem key={p.key} value={p.key}>
                    {p.title} · {p.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="ml-auto flex items-center gap-2 text-sm">
              <Switch
                checked={materialState?.ready ?? false}
                disabled={busy}
                onCheckedChange={(v) => void persist({ ready: v })}
              />
              Open to students
            </label>
          </div>

          {editing?.needsMaterials && editing?.key !== "tech_zip" ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="proof-audio">
                  {editing?.key === "comms_minutes" ? "Meeting recording" : "Audio message"}
                </Label>
                <input
                  id="proof-audio"
                  type="file"
                  accept="audio/*,video/*"
                  className="block w-full text-sm"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadCourseFile(f, "audioPath");
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="proof-transcript">Reference transcript</Label>
                <Textarea
                  id="proof-transcript"
                  rows={5}
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="Paste the transcript here…"
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void persist({ transcript })}
                >
                  Save transcript
                </Button>
              </div>
            </>
          ) : null}

          {editing?.key === "tech_zip" ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="proof-zip">Challenge ZIP (with README_FIRST)</Label>
                <input
                  id="proof-zip"
                  type="file"
                  accept=".zip"
                  className="block w-full text-sm"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadCourseFile(f, "zipPath");
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="proof-key">Answer key</Label>
                <Textarea
                  id="proof-key"
                  rows={6}
                  value={answerKey}
                  onChange={(e) => setAnswerKey(e.target.value)}
                  placeholder="The expected folder and file structure, one line per item…"
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void persist({ answerKey })}
                >
                  Save answer key
                </Button>
              </div>
            </>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="proof-extra">Extra instructions shown to students</Label>
            <Textarea
              id="proof-extra"
              rows={2}
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void persist({ extraInstructions: extra })}
            >
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Save instructions
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {data?.materials
            .filter((m) => m.needsMaterials)
            .map((m) => (
              <Badge key={m.key} variant={m.ready ? "default" : "outline"}>
                {m.title}: {m.ready ? "open" : "waiting on material"}
              </Badge>
            ))}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Label className="shrink-0">Section</Label>
            <Select value={section} onValueChange={setSection}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All sections</SelectItem>
                {sections.map((s) => (
                  <SelectItem key={s} value={s}>
                    Section {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {rows.map((r) => (
            <div key={r.teamId} className="rounded-md border p-3">
              <p className="mb-2 text-sm font-medium">
                {r.label}{" "}
                <span className="text-muted-foreground">
                  · Section {r.section || "—"} · {r.name}
                </span>
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {r.people.map((p) => (
                  <div key={p.userId} className="flex items-center justify-between gap-2 text-sm">
                    <StudentName name={p.name} avatarUrl={p.avatarUrl} />
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      {p.assigned.length === 0 ? (
                        "Needs a role"
                      ) : p.completed.length === p.assigned.length ? (
                        <>
                          <CheckCircle2 className="size-4 text-emerald-600" /> All done
                        </>
                      ) : (
                        <>
                          <Circle className="size-4" /> {p.completed.length}/{p.assigned.length}
                        </>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
