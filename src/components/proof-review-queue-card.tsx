import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getProofReviewQueue, reviewProof } from "@/lib/proofs.functions";
import { proofMaxScore } from "@/lib/proofs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StudentName } from "@/components/student-avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronsUpDown, Download, Loader2 } from "lucide-react";

/** Professor's queue: approve a role activity, or send it back with a note. */
export function ProofReviewQueueCard() {
  const qc = useQueryClient();
  const fetchQueue = useServerFn(getProofReviewQueue);
  const decide = useServerFn(reviewProof);

  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["proof-review-queue"],
    queryFn: () => fetchQueue(),
  });

  async function act(id: string, decision: "approved" | "sent_back") {
    setBusyId(id);
    try {
      await decide({ data: { submissionId: id, decision, note: notes[id] ?? "" } });
      toast.success(decision === "approved" ? "Approved." : "Sent back with your note.");
      setNotes((n) => ({ ...n, [id]: "" }));
      void qc.invalidateQueries({ queryKey: ["proof-review-queue"] });
      void qc.invalidateQueries({ queryKey: ["proof-overview"] });
      void qc.invalidateQueries({ queryKey: ["team-proofs"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save that decision.");
    } finally {
      setBusyId(null);
    }
  }

  const items = data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Role activities waiting on you</CardTitle>
        <CardDescription>
          Approve the work, or send it back with a note saying what to fix. The student and their
          project manager are both told.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing is waiting for review right now.</p>
        ) : (
          items.map((s) => (
            <div key={s.id} className="space-y-2 rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <StudentName name={s.studentName} avatarUrl={s.avatarUrl} />
                  <span className="text-sm text-muted-foreground">
                    {s.teamLabel}
                    {s.section ? ` · Section ${s.section}` : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {s.score != null ? (
                    <Badge variant={s.score >= proofMaxScore(s.proofKey) ? "default" : "outline"}>
                      Found {s.score}/{proofMaxScore(s.proofKey)} items
                    </Badge>
                  ) : null}
                  {s.resubmitCount > 0 ? <Badge variant="outline">Resent</Badge> : null}
                  <Badge variant="secondary">{s.proofTitle}</Badge>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Submitted {new Date(s.submittedAt).toLocaleString()}
              </p>

              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm">
                    <ChevronsUpDown className="mr-2 size-4" /> Read what they wrote
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-2 text-sm">
                  {Object.entries(s.answers ?? {}).map(([k, v]) => (
                    <div key={k}>
                      <p className="font-medium">{k}</p>
                      <p className="whitespace-pre-wrap text-muted-foreground">{String(v)}</p>
                    </div>
                  ))}
                  {s.fileUrl ? (
                    <a
                      className="inline-flex items-center gap-1 text-primary underline"
                      href={s.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Download className="size-4" /> {s.fileName ?? "Download file"}
                    </a>
                  ) : null}
                </CollapsibleContent>
              </Collapsible>

              <Textarea
                rows={2}
                placeholder="Note for the student (required to send back)"
                value={notes[s.id] ?? ""}
                onChange={(e) => setNotes((n) => ({ ...n, [s.id]: e.target.value }))}
              />

              <div className="flex gap-2">
                <Button size="sm" disabled={busyId === s.id} onClick={() => act(s.id, "approved")}>
                  {busyId === s.id ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === s.id}
                  onClick={() => act(s.id, "sent_back")}
                >
                  Send back
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
