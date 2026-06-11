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
  /** Tailwind classes applied to the section card to tint it. Optional. */
  tone?: string;
};

export const VAULT_STRUCTURE: VaultSection[] = [
  {
    name: "Team Documents",
    subsections: [
      { name: "Group Norms" },
      { name: "Agendas" },
      { name: "Minutes" },
      { name: "Other" },
      { name: "Mid-Semester Peer Reviews" },
    ],
  },
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
    ],
  },


  {
    name: "Video",
    subsections: [
      { name: "B-Roll" },
      { name: "Transcript" },
      { name: "Files" },
      { name: "Project Drafts" },
      { name: "Final Submission" },
    ],
  },
  {
    name: "Competition #1",
    subsections: [{ name: "Submission" }, { name: "Supporting Materials" }],
    tone: "bg-gold/5 border-gold/30",
  },
  {
    name: "Competition #2",
    subsections: [{ name: "Submission" }, { name: "Supporting Materials" }],
    tone: "bg-gold/10 border-gold/40",
  },
  {
    name: "Competition #3",
    subsections: [{ name: "Submission" }, { name: "Supporting Materials" }],
    tone: "bg-gold/20 border-gold/50",
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
