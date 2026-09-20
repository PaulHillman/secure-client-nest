import { AlertTriangle, CheckCircle2, CircleSlash, XCircle } from "lucide-react";
import type { ReadinessColor } from "@/lib/team-readiness-assessment";

const TONE: Record<ReadinessColor, string> = {
  green: "border-emerald-500/40 bg-emerald-500/15 text-emerald-400",
  yellow: "border-amber-500/40 bg-amber-500/15 text-amber-400",
  red: "border-rose-500/40 bg-rose-500/15 text-rose-400",
};

const ICON: Record<ReadinessColor, typeof CheckCircle2> = {
  green: CheckCircle2,
  yellow: AlertTriangle,
  red: XCircle,
};

const LABEL: Record<ReadinessColor, string> = {
  green: "Ready",
  yellow: "Attention needed",
  red: "Blocker",
};

/** Colour is never the only signal: the word and an icon always travel with it. */
export function ReadinessStatusBadge({
  color,
  className = "",
}: {
  color: ReadinessColor;
  className?: string;
}) {
  const Icon = ICON[color];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${TONE[color]} ${className}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      <span>{LABEL[color]}</span>
    </span>
  );
}

/** Test fixtures get a neutral label instead of a readiness colour. */
export function TestFixtureBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground ${className}`}
    >
      <CircleSlash className="h-3.5 w-3.5" aria-hidden />
      Test fixture — excluded
    </span>
  );
}
