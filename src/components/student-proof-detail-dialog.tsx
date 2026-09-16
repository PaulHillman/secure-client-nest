import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getStudentProofDetail } from "@/lib/proofs.functions";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const REVIEW_LABEL: Record<string, string> = {
  pending: "Awaiting your review",
  approved: "Approved",
  sent_back: "Sent back",
};

function fieldLabel(key: string) {
  return key.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function StudentProofDetailDialog({
  studentId,
  studentName,
  onOpenChange,
}: {
  studentId: string | null;
  studentName: string;
  onOpenChange: (open: boolean) => void;
}) {
  const fetchDetail = useServerFn(getStudentProofDetail);
  const { data, isLoading } = useQuery({
    queryKey: ["student-proof-detail", studentId],
    enabled: !!studentId,
    queryFn: () => fetchDetail({ data: { studentId: studentId! } }),
  });

  const items = data?.submissions ?? [];

  return (
    <Dialog open={!!studentId} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {data?.name ?? studentName}
          </DialogTitle>
          <DialogDescription>
            What they submitted for each role activity, and the coaching feedback they received.
          </DialogDescription>
        </DialogHeader>

        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && items.length === 0 && (
          <p className="text-sm text-muted-foreground">
            This student has not submitted any role activities yet.
          </p>
        )}

        <div className="space-y-4">
          {items.map((s) => (
            <div key={s.key} className="rounded-lg border p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{s.title}</span>
                {s.alias && <Badge variant="outline">{s.alias}</Badge>}
                <Badge variant="outline">{REVIEW_LABEL[s.reviewStatus] ?? s.reviewStatus}</Badge>
                {s.score !== null && (
                  <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30">
                    Key points: {s.score}
                    {s.maxScore ? ` / ${s.maxScore}` : ""}
                  </Badge>
                )}
                {s.resubmitCount > 0 && <Badge variant="outline">Resubmitted</Badge>}
                <span className="ml-auto text-xs text-muted-foreground">
                  {s.submittedAt ? new Date(s.submittedAt).toLocaleString() : ""}
                </span>
              </div>

              {s.fileName && (
                <p className="text-xs text-muted-foreground">Uploaded file: {s.fileName}</p>
              )}

              <div className="space-y-2">
                {Object.entries(s.answers).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No written response recorded.</p>
                ) : (
                  Object.entries(s.answers).map(([k, v]) => (
                    <div key={k}>
                      <p className="text-xs font-medium text-muted-foreground">{fieldLabel(k)}</p>
                      <p className="whitespace-pre-wrap text-sm">{v}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="rounded-md border border-border/60 bg-muted/40 p-3">
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  Feedback the student received
                </p>
                {s.feedback ? (
                  <p className="whitespace-pre-wrap text-sm">{s.feedback}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {s.feedbackStatus === "unavailable"
                      ? "Feedback was not available when they submitted."
                      : "No feedback recorded."}
                  </p>
                )}
              </div>

              {s.reviewNote && (
                <p className="text-sm">
                  <span className="font-medium">Your note: </span>
                  {s.reviewNote}
                </p>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
