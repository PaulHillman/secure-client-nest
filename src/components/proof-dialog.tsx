import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getProofMaterial, submitProof } from "@/lib/proofs.functions";
import { proofByKey, proofMaxScore } from "@/lib/proofs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, Check, Download, FileUp, Loader2 } from "lucide-react";

type Props = {
  teamId: string;
  proofKey: string | null;
  userId: string;
  /** Prefilled when the professor sent the work back to be fixed. */
  initialAnswers?: Record<string, string>;
  sentBackNote?: string | null;
  onClose: () => void;
  onSubmitted: () => void;
};

export function ProofDialog({
  teamId,
  proofKey,
  userId,
  initialAnswers,
  sentBackNote,
  onClose,
  onSubmitted,
}: Props) {
  const proof = proofKey ? proofByKey(proofKey) : undefined;
  const loadMaterial = useServerFn(getProofMaterial);
  const send = useServerFn(submitProof);

  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers ?? {});
  const [ack, setAck] = useState(false);
  const [file, setFile] = useState<{ path: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{
    score: number | null;
    feedback: string | null;
  } | null>(null);

  const { data: material } = useQuery({
    queryKey: ["proof-material", proofKey],
    queryFn: () => loadMaterial({ data: { proofKey: proofKey! } }),
    enabled: !!proofKey && (!!proof?.needsMaterials || !!proof?.requiresFile),
  });

  const scenarioLines = useMemo(() => (proof?.scenario ?? "").split("\n"), [proof]);

  async function upload(f: File) {
    setUploading(true);
    try {
      const path = `submissions/${userId}/${proofKey}-${Date.now()}-${f.name.replace(/[^\w.-]+/g, "_")}`;
      const { error } = await supabase.storage.from("proofs").upload(path, f);
      if (error) throw error;
      setFile({ path, name: f.name });
      toast.success("File attached.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit() {
    if (!proof) return;
    setSaving(true);
    try {
      const res = await send({
        data: {
          teamId,
          proofKey: proof.key,
          answers,
          filePath: file?.path ?? null,
          fileName: file?.name ?? null,
          acknowledged: ack,
        },
      });
      toast.success("Sent to your professor for review.");
      onSubmitted();
      setResult({ score: res?.score ?? null, feedback: res?.feedback ?? null });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not record your submission.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!proof} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        {proof && result ? (
          <>
            <DialogHeader>
              <DialogTitle>Submitted — here is how you did</DialogTitle>
              <DialogDescription>
                {proof.title} · {proof.alias}
              </DialogDescription>
            </DialogHeader>
            {result.score != null ? (
              <p className="rounded-md border p-3 text-sm font-medium">
                You captured {result.score} of {proofMaxScore(proof.key)} key points.
              </p>
            ) : null}
            {result.feedback ? (
              <p className="whitespace-pre-wrap text-sm">{result.feedback}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Your work is recorded. Written feedback will appear on your team page shortly.
              </p>
            )}
            <DialogFooter>
              <Button onClick={onClose}>Close</Button>
            </DialogFooter>
          </>
        ) : proof ? (
          <>
            <DialogHeader>
              <DialogTitle>{proof.title}</DialogTitle>
              <DialogDescription>
                {proof.alias} · {proof.role}
              </DialogDescription>
            </DialogHeader>

            {proof.contactWarning ? (
              <div className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <p>{proof.contactWarning}</p>
              </div>
            ) : null}

            {sentBackNote ? (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                <p className="font-medium">Sent back by your professor</p>
                <p className="text-muted-foreground">{sentBackNote}</p>
              </div>
            ) : null}

            <p className="text-sm text-muted-foreground">{proof.howTo}</p>

            {material?.extraInstructions ? (
              <p className="rounded-md bg-muted p-3 text-sm">{material.extraInstructions}</p>
            ) : null}

            {proof.scenario ? (
              <div className="rounded-md border p-3 text-sm">
                <p className="mb-1 font-medium">The situation</p>
                {scenarioLines.map((line, i) => (
                  <p key={i} className="text-muted-foreground">
                    {line}
                  </p>
                ))}
              </div>
            ) : null}

            {material?.audioUrl ? (
              <div className="space-y-2">
                <Label>
                  {proof.key === "comms_minutes"
                    ? "Meeting recording"
                    : proof.key === "liaison_voicemail"
                      ? "Voicemail from your client contact"
                      : "Voicemail"}
                </Label>
                <audio
                  controls
                  controlsList="nodownload"
                  preload="metadata"
                  autoPlay={false}
                  src={material.audioUrl}
                  className="w-full"
                  aria-label="Recording for this activity"
                  ref={(el) => {
                    if (el) el.playbackRate = 1;
                  }}
                >
                  Your browser cannot play this recording.
                </audio>
                <Button asChild variant="outline" size="sm" className="w-fit">
                  <a href={material.audioUrl} download>
                    <Download className="mr-2 size-4" /> Download the recording
                  </a>
                </Button>
              </div>
            ) : null}

            {material?.transcript ? (
              <details className="rounded-md border p-3 text-sm">
                <summary className="cursor-pointer font-medium">Reference transcript</summary>
                <pre className="mt-2 whitespace-pre-wrap text-muted-foreground">
                  {material.transcript}
                </pre>
              </details>
            ) : null}

            {material?.zipUrl ? (
              <Button asChild variant="outline" className="w-fit">
                <a href={material.zipUrl} download>
                  <Download className="mr-2 size-4" /> Download the challenge files
                </a>
              </Button>
            ) : null}

            {proof.key !== "pm_agenda" ? (
              <div className="rounded-md border p-3 text-sm">
                <p className="mb-1 font-medium">A strong response covers</p>
                <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
                  {proof.checklist.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {proof.fields.map((f) => (
              <div key={f.name} className="space-y-1.5">
                <Label htmlFor={f.name}>
                  {f.label}
                  {f.required ? " *" : ""}
                </Label>
                {f.help ? <p className="text-xs text-muted-foreground">{f.help}</p> : null}
                <Textarea
                  id={f.name}
                  rows={4}
                  placeholder={f.placeholder}
                  value={answers[f.name] ?? ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [f.name]: e.target.value }))}
                />
              </div>
            ))}

            {proof.requiresFile ? (
              <div className="space-y-1.5">
                <Label htmlFor="proof-file">Your completed ZIP *</Label>
                <p className="text-xs text-muted-foreground">{proof.fileHint}</p>
                <input
                  id="proof-file"
                  type="file"
                  accept=".zip"
                  className="block w-full text-sm"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void upload(f);
                  }}
                />
                {uploading ? (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" /> Uploading…
                  </p>
                ) : null}
                {file ? (
                  <p className="flex items-center gap-2 text-xs text-emerald-600">
                    <FileUp className="size-3" /> {file.name} attached
                  </p>
                ) : null}
              </div>
            ) : null}

            {proof.contactWarning ? (
              <label className="flex items-start gap-2 text-sm">
                <Checkbox checked={ack} onCheckedChange={(v) => setAck(v === true)} />
                <span>
                  I understand I must not contact Zach Guy or anyone at Steelcase for this activity,
                  and I used public sources only.
                </span>
              </label>
            ) : null}

            <p className="text-xs text-muted-foreground">
              Your professor reviews this. Once approved it is locked; if it is sent back you can
              fix it and resend.
            </p>

            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={saving || uploading}>
                {saving ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Check className="mr-2 size-4" />
                )}
                {sentBackNote ? "Resend" : "Submit"}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
