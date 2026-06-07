import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Maximize2, FileText } from "lucide-react";
import projectArch from "@/assets/project-arch.pdf.asset.json";

type Props = {
  className?: string;
  /** Compact thumbnail vs. larger embed */
  variant?: "thumb" | "wide";
};

export function ProjectArchCard({ className, variant = "thumb" }: Props) {
  const [open, setOpen] = useState(false);
  const url = projectArch.url;

  return (
    <>
      <Card
        onClick={() => setOpen(true)}
        className={`group relative overflow-hidden border-border/60 cursor-pointer hover:border-gold/60 transition-colors ${className ?? ""}`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-card">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 text-gold shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">Semester Project Arch</p>
              <p className="text-[11px] text-muted-foreground">Architecture of Activities · click to expand</p>
            </div>
          </div>
          <Maximize2 className="h-4 w-4 text-muted-foreground group-hover:text-gold transition-colors" />
        </div>
        <div className={`relative ${variant === "wide" ? "h-[420px]" : "h-56"} bg-muted`}>
          <iframe
            src={`${url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
            title="Project Arch preview"
            className="w-full h-full border-0"
          />
          {/* Transparent click-catcher so the card's onClick fires instead of the iframe swallowing clicks */}
          <div className="absolute inset-0" aria-hidden="true" />
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[92vh] p-0 overflow-hidden">
          <DialogTitle className="sr-only">Semester Project Architecture of Activities</DialogTitle>
          <iframe
            src={`${url}#view=FitH`}
            title="Semester Project Architecture of Activities"
            className="w-full h-full border-0"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
