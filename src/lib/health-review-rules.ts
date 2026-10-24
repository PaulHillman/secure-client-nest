/**
 * Editable thresholds for the weekly Team Health Review.
 *
 * These are the numbers the review actually checks. `HEALTH_REVIEW_RULE_DEFAULTS`
 * reproduces exactly the values that were hardcoded before this became editable,
 * so an untouched settings row behaves identically to the old build.
 *
 * Pure and client-safe: the runner reads the saved row from the database and
 * passes it through `resolveHealthReviewRules`, which clamps anything out of
 * range and repairs impossible pairings (red tighter than yellow, etc.).
 */

export const RULES_ROW_ID = "global";

export type HealthReviewRules = {
  meeting_yellow_days: number;
  meeting_red_days: number;
  meetings_start_week: number;
  activity_window_days: number;
  low_engagement_weeks: number;
  low_engagement_start: string;
  research_required_early: number;
  research_required_late: number;
  research_due: string;
  comms_grace_weeks: number;
  comms_expected_files: number;
  interview_questions_percent: number;
  video_percent: number;
  video_final_percent: number;
  minutes_template_from: string;
  minutes_min_markers: number;
  escalate_red_after: number;
  escalate_grade_after: number;
};

/** Defaults = the behaviour of the review before these settings were editable. */
export const HEALTH_REVIEW_RULE_DEFAULTS: HealthReviewRules = {
  meeting_yellow_days: 7,
  meeting_red_days: 13,
  meetings_start_week: 3,
  activity_window_days: 7,
  low_engagement_weeks: 3,
  low_engagement_start: "2026-10-17",
  research_required_early: 2,
  research_required_late: 4,
  research_due: "2026-10-18",
  comms_grace_weeks: 3,
  comms_expected_files: 2,
  interview_questions_percent: 47,
  video_percent: 60,
  video_final_percent: 90,
  minutes_template_from: "2026-09-27",
  minutes_min_markers: 6,
  escalate_red_after: 2,
  escalate_grade_after: 3,
};

export type HealthReviewRuleKey = keyof HealthReviewRules;

export type RuleField = {
  key: HealthReviewRuleKey;
  group: string;
  label: string;
  hint: string;
  kind: "days" | "weeks" | "count" | "percent" | "date" | "week";
  min: number;
  max: number;
};

/** Ordered for the editor: the checks appear in the order the report runs them. */
export const RULE_FIELDS: RuleField[] = [
  {
    key: "meetings_start_week", group: "Weekly Meetings", kind: "week", min: 1, max: 15,
    label: "Start checking meetings in semester week",
    hint: "Weeks 1 and 2 are skipped: teams are still meeting each other and the vault expectation starts from this week.",
  },
  {
    key: "meeting_yellow_days", group: "Weekly Meetings", kind: "days", min: 1, max: 90,
    label: "Flag a meeting gap as yellow after",
    hint: "Days since the last logged meeting before the team is warned.",
  },
  {
    key: "meeting_red_days", group: "Weekly Meetings", kind: "days", min: 1, max: 180,
    label: "Flag a meeting gap as red after",
    hint: "Days since the last logged meeting before the warning becomes red.",
  },
  {
    key: "minutes_template_from", group: "Weekly Meetings", kind: "date", min: 0, max: 0,
    label: "Minutes must follow the shared template from",
    hint: "Minutes for meetings held before this date are exempt — the requirement is not applied retroactively.",
  },
  {
    key: "minutes_min_markers", group: "Weekly Meetings", kind: "count", min: 1, max: 7,
    label: "Template sections a minutes file must contain",
    hint: "Of the 7 labelled sections in the Meeting Minutes Template, how many must be present before the file counts as compliant.",
  },
  {
    key: "activity_window_days", group: "Activity", kind: "days", min: 1, max: 60,
    label: "Look back for sign-ins and uploads",
    hint: "Days of activity compared against each team's own median.",
  },
  {
    key: "low_engagement_weeks", group: "Activity", kind: "weeks", min: 1, max: 8,
    label: "Low engagement cycle length",
    hint: "A student with no meaningful contribution builds a streak week by week: week 1 is a note, week 2 is yellow, the final week is red.",
  },
  {
    key: "low_engagement_start", group: "Activity", kind: "date", min: 0, max: 0,
    label: "Low engagement tracking starts",
    hint: "Page-visit tracking only became reliable on this date; earlier weeks cannot be judged.",
  },
  {
    key: "research_required_early", group: "Client research", kind: "count", min: 0, max: 20,
    label: "Research files expected before the due date",
    hint: "Used while the due date has not passed; coverage of all four topics can satisfy the check instead.",
  },
  {
    key: "research_required_late", group: "Client research", kind: "count", min: 0, max: 20,
    label: "Research files expected after the due date",
    hint: "After the due date the same shortfall is reported red instead of yellow.",
  },
  {
    key: "research_due", group: "Client research", kind: "date", min: 0, max: 0,
    label: "Research due date",
    hint: "11:59 p.m. on this date.",
  },
  {
    key: "comms_grace_weeks", group: "Client communications", kind: "weeks", min: 0, max: 12,
    label: "Grace period after the client is confirmed",
    hint: "No correspondence is expected until this many weeks after the client confirmation date.",
  },
  {
    key: "comms_expected_files", group: "Client communications", kind: "count", min: 1, max: 10,
    label: "Client emails or texts expected",
    hint: "Once the grace period has passed: none on file is red, one short of this number is yellow, this number or more is on track.",
  },
  {
    key: "interview_questions_percent", group: "Semester vault", kind: "percent", min: 1, max: 100,
    label: "Interview questions expected at",
    hint: "Percentage of the semester after which a missing Interview Questions file is flagged.",
  },
  {
    key: "video_percent", group: "Semester vault", kind: "percent", min: 1, max: 100,
    label: "Video files expected at",
    hint: "Percentage of the semester after which a team with no Video files is flagged.",
  },
  {
    key: "video_final_percent", group: "Semester vault", kind: "percent", min: 1, max: 100,
    label: "Final video submission expected at",
    hint: "Percentage of the semester after which a missing Final Submission is red.",
  },
  {
    key: "escalate_red_after", group: "Repeat warnings", kind: "count", min: 2, max: 10,
    label: "Turn a warning red on its consecutive report",
    hint: "Each concern is tracked separately; fixing one resets only that one.",
  },
  {
    key: "escalate_grade_after", group: "Repeat warnings", kind: "count", min: 3, max: 12,
    label: "Add the grade-deduction notice on",
    hint: "The consecutive report number at which the report states points will begin being deducted.",
  },
];

const DATE_KEYS: readonly HealthReviewRuleKey[] = ["low_engagement_start", "research_due", "minutes_template_from"];

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/**
 * Merge a saved database row over the defaults. Anything missing, blank,
 * non-numeric or out of range falls back to the default rather than being
 * applied, so a half-saved row can never silently change a check.
 */
export function resolveHealthReviewRules(row: Record<string, unknown> | null | undefined): HealthReviewRules {
  const out: Record<string, unknown> = { ...HEALTH_REVIEW_RULE_DEFAULTS };
  if (row) {
    for (const key of Object.keys(HEALTH_REVIEW_RULE_DEFAULTS) as HealthReviewRuleKey[]) {
      const raw = row[key];
      if (raw === null || raw === undefined || raw === "") continue;
      const field = RULE_FIELDS.find((f) => f.key === key);
      if (DATE_KEYS.includes(key)) {
        if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw) && !Number.isNaN(Date.parse(raw))) out[key] = raw;
      } else if (field) {
        const n = typeof raw === "number" ? raw : Number(raw);
        if (Number.isFinite(n)) out[key] = clamp(Math.round(n), field.min, field.max);
      }
    }
  }
  // Ordering invariants: the red threshold can never be tighter than yellow, the
  // grade-deduction notice can never arrive before the escalation to red, and the
  // post-deadline research count can never ask for fewer files than before it.
  if (out.meeting_red_days < out.meeting_yellow_days) out.meeting_red_days = out.meeting_yellow_days;
  if (out.escalate_grade_after <= out.escalate_red_after) out.escalate_grade_after = out.escalate_red_after + 1;
  if (out.research_required_late < out.research_required_early) out.research_required_late = out.research_required_early;
  return out as HealthReviewRules;
}

/**
 * Low engagement tracking begins at the start of the given day in Eastern time.
 * The offset is UTC-4 because the tracking start date (10/17) falls inside
 * daylight saving time; the boundary only has to be consistent week to week.
 */
export function lowEngagementStartMs(rules: Pick<HealthReviewRules, "low_engagement_start">) {
  const parsed = Date.parse(`${rules.low_engagement_start}T04:00:00Z`);
  return Number.isNaN(parsed) ? Date.parse(`${HEALTH_REVIEW_RULE_DEFAULTS.low_engagement_start}T04:00:00Z`) : parsed;
}

/** Display form used in the report text and the editor summary. */
export function ruleValueLabel(field: RuleField, value: number | string) {
  if (field.kind === "date") return typeof value === "string" ? value : String(value);
  if (field.kind === "percent") return `${value}%`;
  if (field.kind === "days") return `${value} day${value === 1 ? "" : "s"}`;
  if (field.kind === "weeks") return `${value} week${value === 1 ? "" : "s"}`;
  if (field.kind === "week") return `week ${value}`;
  return `${value}`;
}
