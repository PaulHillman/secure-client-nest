import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Maximize2, FileText, ExternalLink } from "lucide-react";
import projectArch from "@/assets/project-arch.pdf.asset.json";
import projectArchThumb from "@/assets/project-arch-thumb.png.asset.json";

type Props = {
  className?: string;
  variant?: "thumb" | "wide";
};

export function ProjectArchCard({ className, variant = "thumb" }: Props) {
  const [open, setOpen] = useState(false);
  const pdfUrl = projectArch.url;
  const thumbUrl = projectArchThumb.url;

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
        <div className={`relative ${variant === "wide" ? "h-[520px]" : "h-64"} bg-muted overflow-hidden flex items-start justify-center`}>
          <img
            src={thumbUrl}
            alt="Semester Project Architecture of Activities — page 1 preview"
            className="w-full h-full object-contain object-top"
            loading="lazy"
          />
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[92vh] p-0 overflow-hidden flex flex-col">
          <DialogTitle className="sr-only">Semester Project Architecture of Activities</DialogTitle>
          <div className="flex items-center justify-between px-4 py-2 border-b">
            <p className="text-sm font-medium">Semester Project Arch</p>
            <Button asChild size="sm" variant="outline">
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open in new tab
              </a>
            </Button>
          </div>
          <div className="flex-1 overflow-auto bg-muted p-4 flex justify-center">
            <img
              src={thumbUrl}
              alt="Semester Project Architecture of Activities"
              className="max-w-full h-auto shadow-lg"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
