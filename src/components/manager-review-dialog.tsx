import { useState } from "react";
import type { AwaitingManager } from "@/lib/awaiting-review";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ExternalLink } from "lucide-react";

/**
 * Review window for one client-manager submission: shows what the team sent,
 * takes an optional note, and records Approve or Reject.
 */
export function ManagerReviewDialog({
  item,
  busy,
  onDecide,
  onOpenChange,
}: {
  item: AwaitingManager;
  busy: boolean;
  onDecide: (v: { status: "approved" | "rejected"; note?: string }) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [note, setNote] = useState("");

  const decide = (status: "approved" | "rejected") => {
    onDecide({ status, note: note.trim() || undefined });
    setNote("");
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {item.managerName || "Client manager"} — {item.companyName}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Submitted by {item.teamName}. Approve to accept this client manager, or reject with a
          note explaining why.
        </p>

        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Manager</dt>
            <dd>{item.managerName || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Company</dt>
            <dd>{item.companyName || "—"}</dd>
          </div>
          {item.companyWebsite && (
            <div>
              <dt className="text-xs text-muted-foreground">Website</dt>
              <dd>
                <a
                  href={
                    item.companyWebsite.startsWith("http")
                      ? item.companyWebsite
                      : `https://${item.companyWebsite}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary underline"
                >
                  <ExternalLink className="h-3 w-3" /> {item.companyWebsite}
                </a>
              </dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-muted-foreground">Industry</dt>
            <dd>{item.industry || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground"># of employees</dt>
            <dd>{item.numEmployees ?? "—"}</dd>
          </div>
        </dl>

        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note for the team (optional on approve, recommended on reject)"
          rows={3}
        />

        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => decide("rejected")}
          >
            Reject
          </Button>
          <Button disabled={busy} onClick={() => decide("approved")}>
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
