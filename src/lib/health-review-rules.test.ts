import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import {
  HEALTH_REVIEW_RULE_DEFAULTS,
  RULE_FIELDS,
  resolveHealthReviewRules,
  lowEngagementStartMs,
} from "./health-review-rules";
import { LOW_ENGAGEMENT_START, lowEngagementLevel } from "./low-engagement";
import { escalateConcerns } from "./health-review-escalation";
import type { Concern } from "./health-review-comparison";

const c = (reason: string, ruleId: string, level: "red" | "yellow" = "yellow"): Concern => ({
  check: "readiness",
  level,
  reason,
  ruleId,
});

describe("health review rule defaults", () => {
  it("are exactly the thresholds the review used before they became editable", () => {
    assert.deepEqual(HEALTH_REVIEW_RULE_DEFAULTS, {
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
    });
  });

  it("every editable key has a labelled field in the editor", () => {
    const listed = RULE_FIELDS.map((f) => f.key).sort();
    assert.deepEqual(listed, Object.keys(HEALTH_REVIEW_RULE_DEFAULTS).sort());
  });
});

describe("resolveHealthReviewRules", () => {
  it("uses defaults when no row is saved", () => {
    assert.deepEqual(resolveHealthReviewRules(null), HEALTH_REVIEW_RULE_DEFAULTS);
  });

  it("applies a saved value the instructor changed", () => {
    const r = resolveHealthReviewRules({ meeting_yellow_days: 5, research_required_late: 6 });
    assert.equal(r.meeting_yellow_days, 5);
    assert.equal(r.research_required_late, 6);
  });

  it("keeps an untouched column at its default", () => {
    assert.equal(resolveHealthReviewRules({ video_percent: 75 }).video_final_percent, 90);
  });

  it("clamps a value outside its allowed range instead of applying it", () => {
    assert.equal(resolveHealthReviewRules({ meeting_yellow_days: 999 }).meeting_yellow_days, 90);
    assert.equal(resolveHealthReviewRules({ meeting_yellow_days: 0 }).meeting_yellow_days, 1);
    assert.equal(resolveHealthReviewRules({ video_percent: 140 }).video_percent, 100);
  });

  it("falls back to the default for blank or unreadable input", () => {
    const r = resolveHealthReviewRules({ meeting_red_days: "", activity_window_days: "abc", research_due: "not-a-date" });
    assert.equal(r.meeting_red_days, 13);
    assert.equal(r.activity_window_days, 7);
    assert.equal(r.research_due, "2026-10-18");
  });

  it("never lets the red meeting gap be shorter than the yellow one", () => {
    const r = resolveHealthReviewRules({ meeting_yellow_days: 10, meeting_red_days: 4 });
    assert.equal(r.meeting_red_days, 10);
  });

  it("never lets the grade-deduction notice arrive before the escalation to red", () => {
    const r = resolveHealthReviewRules({ escalate_red_after: 4, escalate_grade_after: 2 });
    assert.equal(r.escalate_grade_after, 5);
  });

  it("never asks for fewer research files after the due date than before it", () => {
    const r = resolveHealthReviewRules({ research_required_early: 5, research_required_late: 1 });
    assert.equal(r.research_required_late, 5);
  });
});

describe("lowEngagementStartMs", () => {
  it("reproduces the tracking start the review used before", () => {
    assert.equal(lowEngagementStartMs({ low_engagement_start: "2026-10-17" }), LOW_ENGAGEMENT_START);
  });

  it("moves to the saved date", () => {
    assert.equal(lowEngagementStartMs({ low_engagement_start: "2026-11-01" }), Date.parse("2026-11-01T04:00:00Z"));
  });
});

describe("lowEngagementLevel with a configured cycle", () => {
  it("keeps note/yellow/red at the default three weeks", () => {
    assert.equal(lowEngagementLevel(1, 3), "note");
    assert.equal(lowEngagementLevel(2, 3), "yellow");
    assert.equal(lowEngagementLevel(3, 3), "red");
  });

  it("moves the escalation with a four-week cycle", () => {
    assert.equal(lowEngagementLevel(2, 4), "note");
    assert.equal(lowEngagementLevel(3, 4), "yellow");
    assert.equal(lowEngagementLevel(4, 4), "red");
  });
});

describe("escalateConcerns with configured thresholds", () => {
  const prior = (n: number) => Array.from({ length: n }, () => [c("No manager contact recorded for the client", "readiness:no_manager")]);
  const current = c("No manager contact recorded for the client", "readiness:no_manager");

  it("keeps the original 2nd-red / 3rd-grade behaviour by default", () => {
    const [second] = escalateConcerns([current], prior(1));
    assert.equal(second.concern.level, "red");
    assert.match(second.concern.reason, /red warning/);
    const [third] = escalateConcerns([current], prior(2));
    assert.match(third.concern.reason, /points will begin being deducted/);
  });

  it("waits for the configured report before turning red", () => {
    const [second] = escalateConcerns([current], prior(1), { redAfter: 3, gradeAfter: 4 });
    assert.equal(second.concern.level, "yellow");
    const [third] = escalateConcerns([current], prior(2), { redAfter: 3, gradeAfter: 4 });
    assert.equal(third.concern.level, "red");
    assert.match(third.concern.reason, /red warning/);
  });

  it("delays the grade-deduction notice to the configured report", () => {
    const [third] = escalateConcerns([current], prior(2), { redAfter: 2, gradeAfter: 5 });
    assert.match(third.concern.reason, /red warning/);
    const [fifth] = escalateConcerns([current], prior(4), { redAfter: 2, gradeAfter: 5 });
    assert.match(fifth.concern.reason, /points will begin being deducted/);
  });
});
