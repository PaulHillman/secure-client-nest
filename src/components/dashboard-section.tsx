import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DashboardSection({
  id,
  open,
  onToggle,
  collapsedHeight = 430,
  children,
}: {
  id: string;
  open: boolean;
  onToggle: () => void;
  collapsedHeight?: number;
  children: React.ReactNode;
}) {
  return (
    <div id={id} className="mt-6 scroll-mt-6">
      <div className="relative">
        <div
          className="overflow-hidden transition-[max-height] duration-200"
          style={open ? undefined : { maxHeight: collapsedHeight }}
        >
          {children}
        </div>
        {!open && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent rounded-b-xl" />
        )}
      </div>
      <div className="mt-2 flex justify-center">
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onToggle}>
          {open ? (
            <>
              <ChevronUp className="h-4 w-4 mr-1" /> Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4 mr-1" /> Show all
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
