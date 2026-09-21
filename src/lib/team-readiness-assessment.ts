/**
 * Team Readiness Assessment (pre-kickoff).
 *
 * One deterministic calculation, shared by the Teams view indicator, the admin
 * assessment list, the detailed team report and the print/PDF view. Nothing here
 * touches the network: the server function gathers the live records and hands
 * them to `assessTeam`, so every surface shows exactly the same result.
 *
 * Deliberately out of scope for this first report: attendance, past meeting
 * history and mid-semester participation trends. Those belong to the later
 * Mid-Semester Assessment.
 */

import { findVagueLanguage, missingNorms, NORM_SECTIONS, normalizeNorms, type NormsContent } from "@/lib/group-norms";
import { proofsForRole, proofByKey, proofMaxScore } from "@/lib/proofs";

/* -------------------------------------------------------------------------- */
/* Configuration                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The instructor's West Michigan definition. Editable in one place; a location
 * is only ever flagged when it is explicitly recognisable as somewhere else.
 */
export const WEST_MICHIGAN = {
  label: "West Michigan",
  /** Cities/townships treated as inside the region. */
  places: [
    "grand rapids",
    "grandville",
    "wyoming",
    "kentwood",
    "walker",
    "comstock park",
    "belmont",
    "rockford",
    "cedar springs",
    "sparta",
    "ada",
    "cascade",
    "forest hills",
    "lowell",
    "caledonia",
    "byron center",
    "jenison",
    "hudsonville",
    "georgetown",
    "allendale",
    "coopersville",
    "marne",
    "holland",
    "zeeland",
    "hamilton",
    "saugatuck",
    "douglas",
    "grand haven",
    "spring lake",
    "ferrysburg",
    "muskegon",
    "norton shores",
    "north muskegon",
    "fruitport",
    "whitehall",
    "montague",
    "greenville",
    "ionia",
    "belding",
    "hastings",
    "big rapids",
    "fremont",
    "newaygo",
    "grant",
    "wayland",
    "middleville",
    "dorr",
  ],
  /** Michigan spellings that keep a location "in state". */
  stateWords: ["michigan", " mi ", ", mi", " mi,"],
};

const OTHER_STATES = [
  "alabama","alaska","arizona","arkansas","california","colorado","connecticut","delaware","florida",
  "georgia","hawaii","idaho","illinois","indiana","iowa","kansas","kentucky","louisiana","maine",
  "maryland","massachusetts","minnesota","mississippi","missouri","montana","nebraska","nevada",
  "new hampshire","new jersey","new mexico","new york","north carolina","north dakota","ohio",
  "oklahoma","oregon","pennsylvania","rhode island","south carolina","south dakota","tennessee",
  "texas","utah","vermont","virginia","washington","west virginia","wisconsin","wyoming ,","canada",
];

/** Michigan places well outside the configured West Michigan area. */
const OUTSTATE_MI = [
  "detroit","ann arbor","lansing","east lansing","flint","warren","troy","sterling heights","dearborn",
  "livonia","novi","southfield","royal oak","pontiac","saginaw","bay city","midland","port huron",
  "kalamazoo","battle creek","jackson","monroe","traverse city","marquette","alpena","sault ste",
];

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export type ReadinessColor = "green" | "yellow" | "red";

export const COLOR_LABEL: Record<ReadinessColor, string> = {
  green: "Ready",
  yellow: "Attention needed",
  red: "Action required",
};

export type Finding = {
  /** Machine key, so the same reason can be filtered or counted. */
  key: string;
  level: "blocker" | "warning";
  /** Plain-language reason, e.g. "No client selected". */
  reason: string;
  /** Optional supporting evidence from the stored records. */
  detail?: string;
};

export type FieldState = "complete" | "missing" | "not_provided" | "not_applicable" | "pending";

export type CheckItemStatus = "found" | "missing" | "needs_clarification";

export type NormsCheckItem = {
  key: string;
  label: string;
  status: CheckItemStatus;
  /** Exact wording from the posted norms that satisfied (or half-satisfied) the check. */
  evidence: string | null;
  /** Section the evidence came from. */
  source: string | null;
  /** What needs to be made measurable, when the item is not clean. */
  note: string | null;
};

export type NormsCategory = {
  key: "communication" | "deadlines" | "accountability";
  title: string;
  items: NormsCheckItem[];
};

export type MemberProofView = {
  key: string;
  title: string;
  alias: string;
  submitted: boolean;
  submittedAt: string | null;
  feedbackState: "pending" | "available" | "unavailable" | "not_applicable";
  feedback: string | null;
  reviewStatus: string | null;
  /** Objective key-point coverage from the answer key, when one exists. */
  score: number | null;
  maxScore: number | null;
};

export type MemberAssessment = {
  userId: string;
  name: string;
  role: string;
  hasRole: boolean;
  requiredProofs: number;
  completedProofs: number;
  missingProofs: number;
  /** Participation completion only — never a quality judgement. */
  status: "not_started" | "in_progress" | "complete" | "no_proofs_assigned" | "no_role";
  statusLabel: string;
  feedbackSummary: string;
  followUp: string | null;
  agreedToNorms: boolean;
  agreedToMeeting: boolean;
  proofs: MemberProofView[];
  suggestedQuestion: string;
  nextAction: string;
};

export type ClientInfo = {
  present: boolean;
  companyName: string | null;
  industry: string | null;
  managerName: string | null;
  managerTitle: string | null;
  email: string | null;
  website: string | null;
  companySize: string | null;
  location: string | null;
  locationVerdict: "missing" | "inside" | "outside" | "review";
  locationNote: string;
  rationale: string | null;
  submittedBy: string | null;
  submittedAt: string | null;
  proposalStatus: string;
  professorDecision: string | null;
};

export type TeamAssessment = {
  teamId: string;
  teamName: string;
  teamRecordName: string;
  teamNumber: number | null;
  section: string | null;
  isTest: boolean;
  color: ReadinessColor;
  colorLabel: string;
  blockers: Finding[];
  warnings: Finding[];
  /** The single short reason shown on a team card. */
  headline: string;
  priorities: string[];
  proofsRequired: number;
  proofsCompleted: number;
  setup: {
    teamNameState: FieldState;
    meetingDay: string | null;
    meetingTime: string | null;
    meetingLocation: string | null;
    communicationMethod: string | null;
    meetingState: FieldState;
    missingFields: string[];
    duplicateRoles: string[];
    unassignedMembers: string[];
    missingRoles: string[];
  };
  client: ClientInfo;
  members: MemberAssessment[];
  norms: {
    posted: boolean;
    version: number | null;
    postedAt: string | null;
    missingSections: string[];
    vague: { label: string; phrase: string; reason: string }[];
    agreed: string[];
    notAgreed: string[];
    pmVerified: boolean;
    pmVerificationNote: string;
    newerVersionNeedsAgreement: boolean;
    categories: NormsCategory[];
    /** The posted document itself, in document order, so it can be read in the report. */
    document: { label: string; text: string }[];
  };
  generatedAt: string;
};

/* -------------------------------------------------------------------------- */
/* Input shape (raw records, gathered by the server function)                  */
/* -------------------------------------------------------------------------- */

export type AssessmentInput = {
  team: { id: string; name: string; display_name: string | null; section: string | null; is_test: boolean };
  members: { user_id: string; job_title: string | null }[];
  profiles: Map<string, { name: string | null; email?: string | null }>;
  companyFocus: {
    company_name: string | null;
    industry: string | null;
    contact_person: string | null;
    contact_job_title: string | null;
    email: string | null;
    website: string | null;
    employee_count: string | null;
    hq_address: string | null;
    updated_at: string | null;
  } | null;
  /** The team's answers for the "client selected" module, if any. */
  clientSubmission: {
    answers: Record<string, string>;
    submitted_at: string | null;
    submitted_by: string | null;
  } | null;
  /** Professor decision on the client module. */
  clientStatus: { status: string; revision_note: string | null; decided_at: string | null } | null;
  /** Professor decision on team setup. */
  setupStatus: { status: string; submitted_at: string | null } | null;
  proposal: {
    day_of_week: number | null;
    meeting_time: string | null;
    location: string | null;
    meeting_mode: string | null;
  } | null;
  agreements: { user_id: string; status: string }[];
  norms: { version: number; content: unknown; uploaded_at: string | null; updated_at: string | null } | null;
  normsSignatures: { user_id: string; version: number }[];
  proofSubmissions: {
    user_id: string;
    proof_key: string;
    submitted_at: string | null;
    feedback: string | null;
    feedback_status: string | null;
    review_status: string | null;
    score?: number | null;
  }[];
  generatedAt: string;
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function fmtTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return t;
  const hr12 = ((h + 11) % 12) + 1;
  return `${hr12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export function teamNumberOf(name: string | null): number | null {
  const m = (name ?? "").match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

function clean(v: string | null | undefined): string | null {
  const s = (v ?? "").trim();
  if (!s) return null;
  if (/^(n\/?a|none|tbd|unknown|not provided)$/i.test(s)) return null;
  if (/@example\.invalid$/i.test(s)) return null;
  return s;
}

/** Classify a client address against the configured region. Never guesses. */
export function classifyLocation(address: string | null): {
  verdict: "missing" | "inside" | "outside" | "review";
  note: string;
} {
  const text = clean(address);
  if (!text) {
    return { verdict: "missing", note: "Company location was not provided. Reported for review only." };
  }
  const lower = ` ${text.toLowerCase()} `;
  if (WEST_MICHIGAN.places.some((p) => lower.includes(p))) {
    return { verdict: "inside", note: `Recognised as inside the configured ${WEST_MICHIGAN.label} area.` };
  }
  if (OUTSTATE_MI.some((p) => lower.includes(p))) {
    return {
      verdict: "outside",
      note: `In Michigan but outside the configured ${WEST_MICHIGAN.label} area.`,
    };
  }
  if (OTHER_STATES.some((s) => lower.includes(s))) {
    return { verdict: "outside", note: `Recognised as outside ${WEST_MICHIGAN.label}.` };
  }
  return {
    verdict: "review",
    note: `Not recognised against the configured ${WEST_MICHIGAN.label} list — shown for your review rather than guessed.`,
  };
}

/* ----------------------------- norms checking ----------------------------- */

/** The posted norms as readable sections, in document order. */
function normsDocument(content: NormsContent): { label: string; text: string }[] {
  const out: { label: string; text: string }[] = [];
  for (const s of NORM_SECTIONS) {
    if (s.levels) {
      for (const l of s.levels) {
        const text = (content[l.key] ?? "").trim();
        if (text) out.push({ label: `${s.title} — ${l.label}`, text });
      }
    } else {
      const text = (content[s.key] ?? "").trim();
      if (text) out.push({ label: s.title, text });
    }
  }
  return out;
}

const SENTENCE_SPLIT = /(?<=[.!?;\n])\s+/;

function sentences(text: string): string[] {
  return text
    .split(SENTENCE_SPLIT)
    .map((s) => s.trim())
    .filter(Boolean);
}

const HAS_PERIOD = /\b(\d+|one|two|three|four|five|six|twelve|twenty-four|24|48|72)\s*(minute|min|hour|hr|day|week|business day|calendar day)/i;
const HAS_CLOCK = /\b\d{1,2}(:\d{2})?\s*(am|pm)\b/i;

type NormsCheckDef = {
  key: string;
  label: string;
  /** Norms fields the evidence may come from, best first. */
  sources: string[];
  patterns: RegExp[];
  /** The evidence must contain a measurable amount of time. */
  needsPeriod?: boolean;
  note: string;
};

const NORMS_CHECKS: { key: NormsCategory["key"]; title: string; checks: NormsCheckDef[] }[] = [
  {
    key: "communication",
    title: "Communication",
    checks: [
      {
        key: "channel",
        label: "Named communication channel",
        sources: ["communication", "support", "other"],
        patterns: [/\b(group ?me|groupme|text|sms|imessage|email|e-mail|slack|discord|teams|whatsapp|snapchat|messenger|phone call)\b/i],
        note: "Name the exact channel the team uses (for example GroupMe or email).",
      },
      {
        key: "response_period",
        label: "Fixed response period",
        sources: ["communication"],
        patterns: [/\b(respond|reply|answer|acknowledg)/i],
        needsPeriod: true,
        note: "State one exact time limit for replies, such as \"within 12 hours\".",
      },
      {
        key: "late_notice",
        label: "Notice period for lateness or absence",
        sources: ["meeting_attendance", "class_attendance", "communication"],
        patterns: [/\b(late|lateness|absen|miss(ing)? (a|the) meeting|cannot attend|can't attend|unable to attend)\b/i],
        needsPeriod: true,
        note: "State how far in advance a member must give notice, with an exact number of hours.",
      },
      {
        key: "unavailable_process",
        label: "Process for notifying the team when unavailable",
        sources: ["outside_work", "communication", "meeting_attendance"],
        patterns: [/\b(notify|let the team know|inform|message the team|post in|tell the (team|pm|project manager))\b/i],
        note: "Describe exactly who is told and how, when someone becomes unavailable.",
      },
    ],
  },
  {
    key: "deadlines",
    title: "Deadlines",
    checks: [
      {
        key: "internal_deadlines",
        label: "Internal deadlines set before the course deadline",
        sources: ["deadlines"],
        patterns: [
          /\b(internal deadline|our own deadline|set a deadline|complete[d]? .*(before|prior|ahead)|finish(ed)? .*(before|prior|ahead)|submit(ted)? .*(before|prior|ahead)|before the (due date|deadline)|ahead of (the )?(due date|deadline)|\d+\s*(hour|hr|day)s?\s*(before|prior|ahead)|(a|one|1)\s*(day|week)\s*(before|prior|early))/i,
        ],
        note: "Say how much earlier the team's own deadline sits, in hours or days.",
      },
    ],

  },
  {
    key: "accountability",
    title: "Accountability",
    checks: [
      {
        key: "first_response",
        label: "First response when a commitment is missed",
        sources: ["accountability_level_1"],
        patterns: [/.+/],
        note: "Describe the exact first step, who takes it, and what is recorded.",
      },
      {
        key: "repeat_step",
        label: "Next step if the issue repeats",
        sources: ["accountability_level_2"],
        patterns: [/.+/],
        note: "Describe the step taken when the first response did not fix it.",
      },
      {
        key: "who_addresses",
        label: "Who addresses the issue",
        sources: ["accountability_level_1", "accountability_level_2", "accountability_level_3"],
        patterns: [/\b(pm|project manager|team|member|professor|whole team|liaison)\b/i],
        note: "Name the person or role who acts at each level.",
      },
      {
        key: "pm_involved",
        label: "PM involvement",
        sources: ["accountability_level_1", "accountability_level_2", "accountability_level_3", "role_responsibility"],
        patterns: [/\b(pm|project manager)\b/i],
        note: "State where the Project Manager steps in.",
      },
      {
        key: "professor_escalation",
        label: "Professor escalation when unresolved",
        sources: ["accountability_level_3", "accountability_level_2"],
        patterns: [/\b(professor|instructor|hillman|faculty)\b/i],
        note: "State that unresolved issues go to the professor, and when.",
      },
      {
        key: "consequences",
        label: "Specific and enforceable consequences",
        sources: ["accountability_level_2", "accountability_level_3"],
        patterns: [/\b(consequence|peer (review|evaluation)|report|removed|reduced|documented|written|meeting with|grade)\b/i],
        note: "State a consequence that can actually be applied and recorded.",
      },
    ],
  },
];

function labelOfSection(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\blevel (\d)\b/, "Level $1")
    .replace(/^\w/, (c) => c.toUpperCase());
}

function runNormsChecks(content: NormsContent): NormsCategory[] {
  const vague = findVagueLanguage(content);
  const vagueByKey = new Map<string, string[]>();
  for (const v of vague) {
    if (!vagueByKey.has(v.key)) vagueByKey.set(v.key, []);
    vagueByKey.get(v.key)!.push(v.phrase);
  }

  return NORMS_CHECKS.map((cat) => ({
    key: cat.key,
    title: cat.title,
    items: cat.checks.map<NormsCheckItem>((check) => {
      for (const source of check.sources) {
        const text = (content[source] ?? "").trim();
        if (!text) continue;
        for (const sentence of sentences(text)) {
          if (!check.patterns.some((re) => re.test(sentence))) continue;
          const vaguePhrases = (vagueByKey.get(source) ?? []).filter((p) =>
            sentence.toLowerCase().includes(p.toLowerCase()),
          );
          const measurable = !check.needsPeriod || HAS_PERIOD.test(sentence) || HAS_CLOCK.test(sentence);
          if (measurable && vaguePhrases.length === 0) {
            return {
              key: check.key,
              label: check.label,
              status: "found",
              evidence: sentence,
              source: labelOfSection(source),
              note: null,
            };
          }
          return {
            key: check.key,
            label: check.label,
            status: "needs_clarification",
            evidence: sentence,
            source: labelOfSection(source),
            note: vaguePhrases.length
              ? `Vague wording: ${vaguePhrases.map((p) => `"${p}"`).join(", ")}. ${check.note}`
              : check.note,
          };
        }
      }
      return {
        key: check.key,
        label: check.label,
        status: "missing",
        evidence: null,
        source: null,
        note: check.note,
      };
    }),
  }));
}

/* -------------------------------------------------------------------------- */
/* The assessment                                                              */
/* -------------------------------------------------------------------------- */

export function assessTeam(input: AssessmentInput): TeamAssessment {
  const blockers: Finding[] = [];
  const warnings: Finding[] = [];
  const add = (list: Finding[], key: string, reason: string, detail?: string) =>
    list.push({ key, level: list === blockers ? "blocker" : "warning", reason, detail });

  const team = input.team;
  const teamName = (team.display_name ?? "").trim() || team.name;
  const memberCount = input.members.length;

  /* ------------------------------- team name ------------------------------ */
  const hasTeamName = !!clean(team.display_name) || !!clean(team.name);
  if (!hasTeamName) add(blockers, "team_name", "Team name is missing");

  /* ------------------------------- meeting -------------------------------- */
  const p = input.proposal;
  const meetingDay = p && p.day_of_week !== null && p.day_of_week !== undefined ? DAYS[p.day_of_week] ?? null : null;
  const meetingTime = p?.meeting_time ? fmtTime(p.meeting_time) : null;
  const meetingLocation = clean(p?.location ?? null);
  const communicationMethod = clean(p?.meeting_mode ?? null);
  if (!meetingDay || !meetingTime) {
    add(blockers, "meeting_time", "Meeting time has not been entered");
  } else if (!meetingLocation) {
    add(warnings, "meeting_location", "Meeting place has not been entered");
  }

  /* --------------------------------- roles -------------------------------- */
  const unassignedMembers: string[] = [];
  const roleCount = new Map<string, number>();
  for (const m of input.members) {
    const name = input.profiles.get(m.user_id)?.name ?? "A team member";
    const role = m.job_title ?? "Unassigned";
    if (!m.job_title || m.job_title === "Unassigned") unassignedMembers.push(name);
    else roleCount.set(role, (roleCount.get(role) ?? 0) + 1);
  }
  const duplicateRoles = [...roleCount.entries()].filter(([, n]) => n > 1).map(([r, n]) => `${r} (${n} members)`);
  if (unassignedMembers.length) {
    add(
      blockers,
      "roles",
      unassignedMembers.length === 1
        ? "1 member has no assigned role"
        : `${unassignedMembers.length} members have no assigned role`,
      unassignedMembers.join(", "),
    );
  }
  if (duplicateRoles.length) {
    add(blockers, "duplicate_roles", "The same role is held by more than one member", duplicateRoles.join("; "));
  }
  const missingRoles: string[] = [];
  const REQUIRED_ROLES = ["PM", "Communication Specialist", "Video Specialist", "Company Liaison", "Client Vault & Tech Administrator"];
  for (const r of REQUIRED_ROLES) if (!roleCount.has(r)) missingRoles.push(r);
  if (!roleCount.has("PM")) add(blockers, "no_pm", "No Project Manager assigned");
  const otherMissing = missingRoles.filter((r) => r !== "PM");
  if (otherMissing.length && memberCount >= REQUIRED_ROLES.length) {
    add(warnings, "roles_unfilled", `Role not filled: ${otherMissing.join(", ")}`);
  }

  /* --------------------------------- client ------------------------------- */
  const cf = input.companyFocus;
  const answers = input.clientSubmission?.answers ?? {};
  const rationale =
    clean(answers["rationale"]) ??
    clean(answers["why"]) ??
    clean(answers["reason"]) ??
    clean(answers["selection_rationale"]) ??
    null;
  const clientPresent = !!(cf && clean(cf.company_name));
  const loc = classifyLocation(cf?.hq_address ?? null);
  const decision = input.clientStatus?.status ?? null;

  const client: ClientInfo = {
    present: clientPresent,
    companyName: clean(cf?.company_name ?? null),
    industry: clean(cf?.industry ?? null),
    managerName: clean(cf?.contact_person ?? null),
    managerTitle: clean(cf?.contact_job_title ?? null),
    email: clean(cf?.email ?? null),
    website: clean(cf?.website ?? null),
    companySize: clean(cf?.employee_count ?? null),
    location: clean(cf?.hq_address ?? null),
    locationVerdict: loc.verdict,
    locationNote: loc.note,
    rationale,
    submittedBy: input.clientSubmission?.submitted_by
      ? input.profiles.get(input.clientSubmission.submitted_by)?.name ?? null
      : null,
    submittedAt: input.clientSubmission?.submitted_at ?? cf?.updated_at ?? null,
    proposalStatus: decision ?? (clientPresent ? "recorded" : "not_started"),
    professorDecision:
      decision === "approved"
        ? "Approved"
        : decision === "needs_revision"
          ? `Sent back${input.clientStatus?.revision_note ? `: ${input.clientStatus.revision_note}` : ""}`
          : null,
  };

  // A client is not due until the Client Selected module's own deadline, so not
  // having one yet is reported as information only — never a penalty.
  if (clientPresent) {
    if (decision === "needs_revision") {
      add(blockers, "client_sent_back", "Client selection was sent back and has not been resubmitted", input.clientStatus?.revision_note ?? undefined);
    }
    if (!client.managerName) add(blockers, "no_manager", "No manager contact recorded for the client");
    if (!client.companySize) add(warnings, "no_size", "Company size was not provided");
    if (loc.verdict === "missing") add(warnings, "no_location", "Company location was not provided");
    if (loc.verdict === "outside") {
      add(warnings, "outside_region", `Client location is outside ${WEST_MICHIGAN.label}`, client.location ?? undefined);
    }
    if (loc.verdict === "review") {
      add(warnings, "location_review", "Client location needs your review", `${client.location} — ${loc.note}`);
    }
    if (!client.industry) add(warnings, "no_industry", "Client industry was not provided");
    if (!rationale) add(warnings, "no_rationale", "No selection rationale recorded");
  }

  /* --------------------------------- norms -------------------------------- */
  const normsContent = normalizeNorms(input.norms?.content ?? null);
  const normsPosted = !!input.norms && Object.values(normsContent).some((v) => v.trim());
  const normsMissingSections = normsPosted ? missingNorms(normsContent) : [];
  const currentVersion = input.norms?.version ?? null;
  const signedIds = new Set(
    input.normsSignatures.filter((s) => s.version === currentVersion).map((s) => s.user_id),
  );
  const olderSigners = new Set(
    input.normsSignatures.filter((s) => currentVersion !== null && s.version < currentVersion).map((s) => s.user_id),
  );
  const agreed: string[] = [];
  const notAgreed: string[] = [];
  for (const m of input.members) {
    const name = input.profiles.get(m.user_id)?.name ?? "A team member";
    (signedIds.has(m.user_id) ? agreed : notAgreed).push(name);
  }

  if (!normsPosted) {
    add(blockers, "no_norms", "Group Norms are not posted");
  } else {
    if (normsMissingSections.length) {
      add(blockers, "norms_incomplete", `Group Norms are incomplete (${normsMissingSections.length} sections blank)`, normsMissingSections.join(", "));
    }
    if (notAgreed.length) {
      add(
        blockers,
        "norms_not_agreed",
        notAgreed.length === 1
          ? "1 member has not agreed to the current Group Norms"
          : `${notAgreed.length} members have not agreed to the current Group Norms`,
        notAgreed.join(", "),
      );
    }
  }

  const categories = normsPosted ? runNormsChecks(normsContent) : [];
  for (const cat of categories) {
    const unclear = cat.items.filter((i) => i.status !== "found");
    if (unclear.length) {
      add(
        warnings,
        `norms_${cat.key}`,
        `Group Norms need clearer ${cat.title.toLowerCase()} detail`,
        unclear.map((i) => `${i.label}: ${i.status === "missing" ? "missing" : "too vague"}`).join("; "),
      );
    }
  }
  const vague = findVagueLanguage(normsContent).map((v) => ({ label: v.label, phrase: v.phrase, reason: v.reason }));

  /* -------------------------- PM verification ----------------------------- */
  const pm = input.members.find((m) => m.job_title === "PM");
  const pmSignedNorms = !!pm && signedIds.has(pm.user_id);
  const setupSubmitted = ["submitted", "approved"].includes(input.setupStatus?.status ?? "");
  const pmVerified = !!pm && pmSignedNorms && setupSubmitted;
  const pmVerificationNote = !pm
    ? "No Project Manager is assigned, so the team setup cannot be verified."
    : !setupSubmitted
      ? "The team has not submitted Team Setup for review."
      : !pmSignedNorms
        ? "The Project Manager has not personally agreed to the current Group Norms version."
        : "Team Setup submitted and the Project Manager has agreed to the current norms.";
  if (!pmVerified) add(blockers, "pm_verification", "PM verification is missing", pmVerificationNote);

  /* ------------------------------- meeting agreements --------------------- */
  const agreedMeeting = new Set(
    input.agreements.filter((a) => a.status === "agreed").map((a) => a.user_id),
  );

  /* --------------------------------- proofs ------------------------------- */
  const submissionsByUser = new Map<string, typeof input.proofSubmissions>();
  for (const s of input.proofSubmissions) {
    if (!submissionsByUser.has(s.user_id)) submissionsByUser.set(s.user_id, []);
    submissionsByUser.get(s.user_id)!.push(s);
  }

  let proofsRequired = 0;
  let proofsCompleted = 0;
  const notStarted: string[] = [];
  const inProgress: string[] = [];
  const concerns: string[] = [];

  const members: MemberAssessment[] = input.members.map((m) => {
    const name = input.profiles.get(m.user_id)?.name ?? "A team member";
    const role = m.job_title ?? "Unassigned";
    const hasRole = !!m.job_title && m.job_title !== "Unassigned";
    const assigned = proofsForRole(hasRole ? role : null).filter(
      (proof) => proof.role !== "Researcher" || memberCount >= 6,
    );
    const mine = submissionsByUser.get(m.user_id) ?? [];
    const byKey = new Map(mine.map((s) => [s.proof_key, s]));

    const proofs: MemberProofView[] = assigned.map((proof) => {
      const sub = byKey.get(proof.key);
      return {
        key: proof.key,
        title: proof.title,
        alias: proof.alias,
        submitted: !!sub,
        submittedAt: sub?.submitted_at ?? null,
        feedbackState: !sub
          ? "not_applicable"
          : sub.feedback && sub.feedback.trim()
            ? (sub.feedback_status as MemberProofView["feedbackState"]) ?? "available"
            : "pending",
        feedback: sub?.feedback ?? null,
        reviewStatus: sub?.review_status ?? null,
        score: sub?.score ?? null,
        maxScore: sub?.score != null ? proofMaxScore(proof.key) : null,
      };
    });

    const required = assigned.length;
    const completed = proofs.filter((x) => x.submitted).length;
    proofsRequired += required;
    proofsCompleted += completed;

    let status: MemberAssessment["status"];
    if (!hasRole) status = "no_role";
    else if (required === 0) status = "no_proofs_assigned";
    else if (completed === 0) status = "not_started";
    else if (completed < required) status = "in_progress";
    else status = "complete";

    const statusLabel = {
      no_role: "No role assigned",
      no_proofs_assigned: "No proofs assigned",
      not_started: "Not started",
      in_progress: "In progress",
      complete: "Complete",
    }[status];

    if (status === "not_started") notStarted.push(name);
    if (status === "in_progress") inProgress.push(name);

    const withFeedback = proofs.filter((x) => x.feedback && x.feedback.trim());
    const feedbackSummary = !hasRole
      ? "No role assigned, so no practice activities apply yet."
      : withFeedback.length
        ? `Coaching feedback recorded on ${withFeedback.length} of ${completed} submitted ${completed === 1 ? "activity" : "activities"}. No formal quality judgment recorded; completion status and available feedback are shown.`
        : completed
          ? "No feedback stored yet. No formal quality judgment recorded; completion status and available feedback are shown."
          : "Nothing submitted yet.";

    const reviewConcern = proofs.find((x) => x.reviewStatus === "needs_revision");
    if (reviewConcern) concerns.push(`${name} — ${reviewConcern.title} was sent back`);

    const missingTitles = proofs.filter((x) => !x.submitted).map((x) => proofByKey(x.key)?.title ?? x.key);
    const followUp =
      status === "not_started"
        ? "Has not started their role practice activities."
        : status === "in_progress"
          ? `Still to submit: ${missingTitles.join(", ")}.`
          : reviewConcern
            ? `${reviewConcern.title} was sent back for revision.`
            : null;

    const suggestedQuestion = !hasRole
      ? "Which role are you taking, and what is stopping you choosing one?"
      : status === "not_started"
        ? `What do you need in order to start your ${role} practice activities this week?`
        : status === "in_progress"
          ? `What is holding up ${missingTitles[0] ?? "your remaining activity"}?`
          : reviewConcern
            ? `What will you change in ${reviewConcern.title} after the feedback you received?`
            : `As ${role}, what will you own between now and the client interview?`;

    const nextAction = !hasRole
      ? "Assign a role."
      : status === "not_started"
        ? "Start the assigned role practice activities."
        : status === "in_progress"
          ? "Complete the remaining activities."
          : reviewConcern
            ? "Resubmit the activity that was sent back."
            : "Nothing outstanding before kickoff.";

    return {
      userId: m.user_id,
      name,
      role,
      hasRole,
      requiredProofs: required,
      completedProofs: completed,
      missingProofs: Math.max(0, required - completed),
      status,
      statusLabel,
      feedbackSummary,
      followUp,
      agreedToNorms: signedIds.has(m.user_id),
      agreedToMeeting: agreedMeeting.has(m.user_id),
      proofs,
      suggestedQuestion,
      nextAction,
    };
  });

  if (notStarted.length) {
    add(
      warnings,
      "proofs_not_started",
      notStarted.length === 1
        ? "1 member has not started their proofs"
        : `${notStarted.length} members have not started their proofs`,
      notStarted.join(", "),
    );
  }
  if (inProgress.length) {
    add(
      warnings,
      "proofs_incomplete",
      `${inProgress.length} ${inProgress.length === 1 ? "member has" : "members have"} proofs still outstanding`,
      inProgress.join(", "),
    );
  }
  for (const c of concerns) add(warnings, "proof_feedback", "Proof feedback identifies a concern", c);

  if (memberCount === 0) {
    add(blockers, "no_members", "No members are on this team");
  }

  const notAgreedMeeting = input.members
    .filter((m) => !agreedMeeting.has(m.user_id))
    .map((m) => input.profiles.get(m.user_id)?.name ?? "A team member");
  if (meetingDay && meetingTime && notAgreedMeeting.length) {
    add(
      warnings,
      "meeting_not_agreed",
      `${notAgreedMeeting.length} ${notAgreedMeeting.length === 1 ? "member has" : "members have"} not agreed to the meeting time`,
      notAgreedMeeting.join(", "),
    );
  }

  /* --------------------------------- result ------------------------------- */
  const color: ReadinessColor = blockers.length ? "red" : warnings.length ? "yellow" : "green";
  const headline = blockers[0]?.reason ?? warnings[0]?.reason ?? "Everything required before kickoff is in place";

  const priorities = [...blockers, ...warnings].slice(0, 5).map((f) => f.reason);

  const setupMissing: string[] = [];
  if (!hasTeamName) setupMissing.push("Team name");
  if (!meetingDay) setupMissing.push("Meeting day");
  if (!meetingTime) setupMissing.push("Meeting time");
  if (!meetingLocation) setupMissing.push("Meeting place");
  if (!communicationMethod) setupMissing.push("Meeting mode");
  if (unassignedMembers.length) setupMissing.push("Role for every member");

  return {
    teamId: team.id,
    teamName,
    teamRecordName: team.name,
    teamNumber: teamNumberOf(team.name),
    section: team.section,
    isTest: team.is_test,
    color,
    colorLabel: COLOR_LABEL[color],
    blockers,
    warnings,
    headline,
    priorities,
    proofsRequired,
    proofsCompleted,
    setup: {
      teamNameState: hasTeamName ? "complete" : "missing",
      meetingDay,
      meetingTime,
      meetingLocation,
      communicationMethod,
      meetingState: meetingDay && meetingTime ? "complete" : "missing",
      missingFields: setupMissing,
      duplicateRoles,
      unassignedMembers,
      missingRoles,
    },
    client,
    members,
    norms: {
      posted: normsPosted,
      version: currentVersion,
      postedAt: input.norms?.updated_at ?? input.norms?.uploaded_at ?? null,
      missingSections: normsMissingSections,
      vague,
      agreed,
      notAgreed,
      pmVerified,
      pmVerificationNote,
      newerVersionNeedsAgreement:
        normsPosted && notAgreed.length > 0 && [...olderSigners].some((id) => !signedIds.has(id)),
      categories,
      document: normsPosted ? normsDocument(normsContent) : [],
    },
    generatedAt: input.generatedAt,
  };
}
