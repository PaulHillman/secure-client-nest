/**
 * Group Norms: the sections a team must agree on, with guidance only.
 * No sample answers live here on purpose — each team writes its own wording.
 */

export type NormSection = {
  key: string;
  title: string;
  guidance: string;
  optional?: boolean;
  /** Rendered as three separate fields (the accountability ladder). */
  levels?: { key: string; label: string; guidance: string }[];
  emphasis?: boolean;
};

export const NORMS_TITLE = "Group Norms";

export const NORMS_INTRO =
  "Develop these norms together and record your team's agreed expectations in each section. The guidance explains what to decide; each team writes its own agreements. Every member must log into ClientVault, read the saved document, and approve it personally. The PM coordinates completion and sees pending approvals.";

export const NORM_SECTIONS: NormSection[] = [
  {
    key: "mission",
    title: "Team Mission",
    guidance:
      "Define the team's shared purpose, intended outcomes, and agreed standard of quality and performance.",
  },
  {
    key: "communication",
    title: "Communication Timeliness",
    guidance:
      "Establish communication channels and response expectations, how members acknowledge messages and urgency, and how they notify others when unavailable.",
  },
  {
    key: "role_responsibility",
    title: "Role Responsibility",
    guidance:
      "Describe responsibility for fulfilling roles, balancing work, and keeping the team informed. Establish how performance concerns are addressed and role changes agreed and documented.",
  },
  {
    key: "deadlines",
    title: "Project Deadline Timeliness",
    guidance:
      "Define how internal deadlines are set, completion and quality checked before submission, and threatened or missed deadlines addressed.",
  },
  {
    key: "class_attendance",
    title: "Class Attendance",
    guidance:
      "State expectations for attendance, absence notification, catching up, and sharing information from class.",
  },
  {
    key: "meeting_attendance",
    title: "Meeting Attendance",
    guidance:
      "Define expectations for attendance, punctuality, participation, and notice of lateness or absence. Explain how missed participation is addressed.",
  },
  {
    key: "support",
    title: "Support to Other Team Members",
    guidance:
      "Establish how members ask for help, respond, and arrange support while maintaining responsibility for their commitments and a fair workload.",
  },
  {
    key: "outside_work",
    title: "Outside Work and Event Interference",
    guidance:
      "Explain how members disclose conflicts, provide notice, and resolve disruptions or arrange a mutually acceptable meeting time.",
  },
  {
    key: "other",
    title: "Other Group Norms",
    guidance: "Optional. Record additional agreements not covered above.",
    optional: true,
  },
  {
    key: "accountability",
    title: "Accountability Steps",
    emphasis: true,
    guidance:
      "The most important section. Define a fair progression for addressing unmet agreements. At each level specify the trigger, who is responsible, what is documented, and how improvement is reviewed.",
    levels: [
      {
        key: "accountability_level_1",
        label: "Level 1",
        guidance: "Your team's initial response to a violation.",
      },
      {
        key: "accountability_level_2",
        label: "Level 2",
        guidance: "Your team's response when Level 1 has not corrected the behavior.",
      },
      {
        key: "accountability_level_3",
        label: "Level 3",
        guidance: "Further escalation when the earlier steps have not resolved it.",
      },
    ],
  },
];

export const AFFIRMATION_TEXT =
  "I have read this version of our team's group norms. I agree to follow these norms, accept accountability for my commitments, and hold my teammates accountable to the same agreements.";

/** Every field key the document holds, in document order. */
export function normFieldKeys(): string[] {
  const keys: string[] = [];
  for (const s of NORM_SECTIONS) {
    if (s.levels) keys.push(...s.levels.map((l) => l.key));
    else keys.push(s.key);
  }
  return keys;
}

export type NormsContent = Record<string, string>;

export function normalizeNorms(value: unknown): NormsContent {
  const raw =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const out: NormsContent = {};
  for (const key of normFieldKeys()) {
    const v = raw[key];
    out[key] = typeof v === "string" ? v.trim() : "";
  }
  return out;
}

export function sameNorms(a: NormsContent, b: NormsContent) {
  return normFieldKeys().every((k) => (a[k] ?? "") === (b[k] ?? ""));
}

/** Labels of anything still blank. "Other Group Norms" is optional. */
export function missingNorms(content: NormsContent): string[] {
  const missing: string[] = [];
  for (const s of NORM_SECTIONS) {
    if (s.optional) continue;
    if (s.levels) {
      for (const l of s.levels) {
        if (!(content[l.key] ?? "").trim()) missing.push(`${s.title} — ${l.label}`);
      }
    } else if (!(content[s.key] ?? "").trim()) {
      missing.push(s.title);
    }
  }
  return missing;
}

export function isNormsComplete(content: NormsContent) {
  return missingNorms(content).length === 0;
}
