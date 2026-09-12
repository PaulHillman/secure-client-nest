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

/* ---------------- Objective-language check ----------------
 * Norms must be measurable. Ranges of time and soft words like "reasonable"
 * or "as soon as possible" cannot be enforced, so we point them out.
 */

export type VagueFinding = {
  /** Field key the phrase was found in. */
  key: string;
  /** Human label of the section (and level) it sits in. */
  label: string;
  /** The exact wording we found. */
  phrase: string;
  /** Why it is a problem, in plain words. */
  reason: string;
};

const VAGUE_PATTERNS: { re: RegExp; reason: string }[] = [
  {
    // 5-10 minutes, 1 to 2 days, 24–48 hours
    re: /\b\d+\s*(?:-|–|—|\/|\s+to\s+)\s*\d+\s*(?:min(?:ute)?s?|hours?|hrs?|days?|weeks?)\b/gi,
    reason: "a range of times is not a single, enforceable deadline — pick one number",
  },
  {
    re: /\b(?:a\s+few|a\s+couple\s+of|several|some)\s+(?:min(?:ute)?s?|hours?|days?|weeks?)\b/gi,
    reason: "\"a few\" is not measurable — state an exact amount of time",
  },
  {
    re: /\b(?:about|around|approximately|roughly|or\s+so|give\s+or\s+take|more\s+or\s+less|ish)\b/gi,
    reason: "approximate wording cannot be measured — state the exact standard",
  },
  {
    re: /\b(?:as\s+soon\s+as\s+possible|asap|soon|shortly|promptly|quickly|in\s+a\s+timely\s+manner|timely)\b/gi,
    reason: "this has no deadline attached — state a specific time limit",
  },
  {
    re: /\b(?:reasonable|reasonably|acceptable|appropriate|adequate|sufficient|fair(?:ly)?\s+quickly)\b/gi,
    reason: "people disagree on what this means — define the measurable standard",
  },
  {
    re: /\b(?:try\s+to|attempt\s+to|do\s+(?:your|their|our)\s+best|make\s+an\s+effort|as\s+much\s+as\s+possible|when\s+possible|if\s+possible)\b/gi,
    reason: "this is an effort, not a commitment — state what must actually happen",
  },
  {
    re: /\b(?:frequently|regularly|often|periodically|from\s+time\s+to\s+time|usually|generally|typically|mostly)\b/gi,
    reason: "state how often, with a number or a named day",
  },
  {
    re: /\b(?:mostly\s+on\s+time|generally\s+on\s+time|not\s+too\s+late|a\s+little\s+late|slightly\s+late|excessive(?:ly)?|too\s+(?:many|much|late|long)|repeatedly|multiple\s+times)\b/gi,
    reason: "define the exact count or minutes that crosses the line",
  },
  {
    re: /\b(?:etc\.?|and\s+so\s+on|among\s+other\s+things)\b/gi,
    reason: "list the actual items instead of leaving them open",
  },
];

function labelFor(key: string): string {
  for (const s of NORM_SECTIONS) {
    if (s.key === key) return s.title;
    const level = s.levels?.find((l) => l.key === key);
    if (level) return `${s.title} — ${level.label}`;
  }
  return key;
}

/** Every vague phrase in the document, in document order. */
export function findVagueLanguage(content: NormsContent): VagueFinding[] {
  const out: VagueFinding[] = [];
  for (const key of normFieldKeys()) {
    const text = (content[key] ?? "").trim();
    if (!text) continue;
    const seen = new Set<string>();
    for (const { re, reason } of VAGUE_PATTERNS) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        const phrase = m[0].trim();
        const dedupe = phrase.toLowerCase();
        if (seen.has(dedupe)) continue;
        seen.add(dedupe);
        out.push({ key, label: labelFor(key), phrase, reason });
      }
    }
  }
  return out;
}
