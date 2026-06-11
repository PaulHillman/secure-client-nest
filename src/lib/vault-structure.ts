// Fixed Vault hierarchy. Every team gets the same shape.
// Subsections marked perMember create one slot per team member (e.g. Interview Questions).

export type VaultSubsection = {
  name: string;
  description?: string;
  perMember?: boolean;
  expectsCompiled?: boolean; // shows a separate "Final Compiled" slot
};

export type VaultSection = {
  name: string;
  subsections: VaultSubsection[];
};

export const VAULT_STRUCTURE: VaultSection[] = [
  {
    name: "Semester Long Project",
    subsections: [
      { name: "Client research" },
      {
        name: "Interview Questions",
        perMember: true,
        expectsCompiled: true,
        description: "One set per team member, plus a final compiled version.",
      },
      { name: "Organizational Chart" },
      { name: "Video — B-Roll" },
      { name: "Video — Transcript" },
      { name: "Video — Files" },
      { name: "Project Drafts" },
      { name: "Final Submission" },
    ],
  },
  { name: "Competition #1", subsections: [{ name: "Submission" }, { name: "Supporting Materials" }] },
  { name: "Competition #2", subsections: [{ name: "Submission" }, { name: "Supporting Materials" }] },
  { name: "Competition #3", subsections: [{ name: "Submission" }, { name: "Supporting Materials" }] },
  {
    name: "Team Documents",
    subsections: [
      { name: "Group Norms" },
      { name: "Peer Reviews" },
      { name: "Contact Info" },
      { name: "Other" },
    ],
  },
];

export const SECTION_NAMES = VAULT_STRUCTURE.map((s) => s.name);

export function findSubsection(section: string, sub: string): VaultSubsection | undefined {
  return VAULT_STRUCTURE.find((s) => s.name === section)?.subsections.find((x) => x.name === sub);
}

export const VAULT_STATUSES = [
  "Submitted",
  "Awaiting Review",
  "Reviewed",
  "Needs Revision",
  "Resolved",
  "Missing",
] as const;
export type VaultStatus = (typeof VAULT_STATUSES)[number];

export const STATUS_TONE: Record<VaultStatus, string> = {
  Submitted: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  "Awaiting Review": "bg-amber-500/15 text-amber-400 border-amber-500/30",
  Reviewed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  "Needs Revision": "bg-rose-500/15 text-rose-400 border-rose-500/30",
  Resolved: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  Missing: "bg-muted text-muted-foreground border-border",
};
