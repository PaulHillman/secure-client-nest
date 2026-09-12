/**
 * Stage A: the five-state readiness model shared by every project requirement.
 *
 * ClientVault keeps its own names for roles and artefacts. The course spec uses
 * different words for some of the same things, so those are carried as aliases
 * and shown alongside our name wherever students read it.
 */

export const READINESS_STATUSES = [
  "not_started",
  "in_progress",
  "submitted",
  "needs_revision",
  "approved",
] as const;

export type ReadinessStatus = (typeof READINESS_STATUSES)[number];

export const READINESS_LABEL: Record<ReadinessStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  submitted: "Submitted",
  needs_revision: "Needs revision",
  approved: "Approved",
};

export const READINESS_TONE: Record<ReadinessStatus, string> = {
  not_started: "bg-muted text-muted-foreground border-border",
  in_progress: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  submitted: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  needs_revision: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  approved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

/** States a team can set for itself. Approved / Needs revision are the professor's. */
export const TEAM_SETTABLE: ReadinessStatus[] = ["not_started", "in_progress", "submitted"];

/** States only the professor may set. */
export const DECISION_STATUSES: ReadinessStatus[] = ["approved", "needs_revision"];

export function isDecision(status: ReadinessStatus) {
  return DECISION_STATUSES.includes(status);
}

/**
 * Spec wording -> our wording. We keep our name; the alias is shown in brackets
 * so students who read the course handout recognise it.
 */
export const NAME_ALIASES: Record<string, string> = {
  "Client Vault & Tech Administrator": "Tech / Vault Admin",
  "Communication Specialist": "Communications Lead",
  "Company Liaison": "Client Liaison",
  Researcher: "Research Specialist",
  PM: "Project Manager",
};

export function withAlias(name: string) {
  const alias = NAME_ALIASES[name];
  return alias && alias !== name ? `${name} (${alias})` : name;
}

/** A member with no role picked is not "done" — they need chasing. */
export const NEEDS_ROLE_LABEL = "Needs a role";
