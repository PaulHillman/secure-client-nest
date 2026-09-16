import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSubmissionReview } from "@/lib/readiness.functions";
import { moduleForm } from "@/lib/modules";
import { READINESS_LABEL, READINESS_TONE, type ReadinessStatus } from "@/lib/readiness";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  teamName: string;
  requirementKey: string;
  busy?: boolean;
  onDecide: (v: { status: ReadinessStatus; note?: string }) => void;
};

function when(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString();
}

export function SubmissionReviewDialog({
  open,
  onOpenChange,
  teamId,
  teamName,
  requirementKey,
  busy,
  onDecide,
}: Props) {
  const fetchReview = useServerFn(getSubmissionReview);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["submission-review", teamId, requirementKey],
    queryFn: () => fetchReview({ data: { teamId, key: requirementKey } }),
    enabled: open,
  });

  const form = moduleForm(requirementKey);
  const fields = form?.fields ?? [];
  const extraKeys = Object.keys(data?.answers ?? {}).filter(
    (k) => !fields.some((f) => f.name === k),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {data?.title ?? "Review submission"}
          </DialogTitle>
          <DialogDescription>
            {teamName}
            {data?.submittedByName ? ` · sent by ${data.submittedByName}` : ""}
            {when(data?.submittedAt ?? null) ? ` · ${when(data!.submittedAt)}` : ""}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading their work…</p>
        ) : !data ? (
          <p className="text-sm text-muted-foreground">Nothing to show yet.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={READINESS_TONE[data.status]}>
                {READINESS_LABEL[data.status]}
              </Badge>
              {data.submitCount > 1 && (
                <span className="text-xs text-muted-foreground">
                  Sent {data.submitCount} times
                </span>
              )}
              {data.lastEditedByName && (
                <span className="text-xs text-muted-foreground">
                  Last edited by {data.lastEditedByName}
                  {when(data.lastEditedAt) ? ` · ${when(data.lastEditedAt)}` : ""}
                </span>
              )}
            </div>

            {data.revisionNote && (
              <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                Previous note: {data.revisionNote}
              </p>
            )}

            {data.roster.length > 0 && (
              <div className="rounded-lg border p-3">
                <div className="mb-2 text-xs font-medium text-muted-foreground">
                  Who is on the team
                </div>
                <ul className="space-y-1 text-sm">
                  {data.roster.map((m) => (
                    <li key={m.name} className="flex justify-between gap-3">
                      <span>{m.name}</span>
                      <span
                        className={
                          m.jobTitle === "Unassigned"
                            ? "text-amber-500"
                            : "text-muted-foreground"
                        }
                      >
                        {m.jobTitle}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-3">
              {fields.map((f) => {
                const value = (data.answers[f.name] ?? "").trim();
                return (
                  <div key={f.name} className="rounded-lg border p-3">
                    <div className="text-xs font-medium text-muted-foreground">{f.label}</div>
                    <p
                      className={`mt-1 whitespace-pre-wrap text-sm ${
                        value ? "" : "italic text-muted-foreground"
                      }`}
                    >
                      {value || "Left blank"}
                    </p>
                  </div>
                );
              })}
              {extraKeys.map((k) => (
                <div key={k} className="rounded-lg border p-3">
                  <div className="text-xs font-medium text-muted-foreground">{k}</div>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{data.answers[k]}</p>
                </div>
              ))}
              {fields.length === 0 && extraKeys.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  This module has no written answer sheet.
                </p>
              )}
            </div>

            {showNote && (
              <Textarea
                autoFocus
                rows={3}
                placeholder="What needs fixing?"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <div className="flex gap-2">
            {showNote ? (
              <Button
                variant="outline"
                disabled={!note.trim() || busy}
                onClick={() => onDecide({ status: "needs_revision", note })}
              >
                Send back with this note
              </Button>
            ) : (
              <Button variant="outline" disabled={busy} onClick={() => setShowNote(true)}>
                Send back
              </Button>
            )}
            <Button disabled={busy} onClick={() => onDecide({ status: "approved" })}>
              Approve
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
