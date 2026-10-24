import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { compareConcerns, researchCoverage } from "./health-review-comparison";

describe("weekly shared-report concern comparisons", () => {
  const old = { check: "readiness", level: "yellow" as const, reason: "Group Norms are not posted" };
  test("specific fixed concern earns recognition only with verified zero remaining", () => {
    const [change] = compareConcerns([old], [], [{ ruleId: "readiness:no_norms", evidence: "Group Norms are now posted.", remaining: 0, verified: true }]);
    assert.equal(change.status, "Resolved");
    assert.match(change.current, /Group Norms are now posted/);
  });
  test("retired selection-rationale check is a reporting correction, never student credit", () => {
    const rationale = { check: "readiness", level: "yellow" as const, reason: "No selection rationale recorded" };
    const [change] = compareConcerns([rationale], [], [{ ruleId: "readiness:no_rationale", evidence: "A selection rationale is recorded.", remaining: 0, verified: true }]);
    assert.equal(change.status, "Reporting correction");
  });
  test("disappearing concern without evidence is unverified", () => {
    assert.equal(compareConcerns([old], [], [])[0].status, "Unable to verify");
  });
  test("nonzero remaining cannot receive resolved credit", () => {
    assert.equal(compareConcerns([old], [], [{ ruleId: "readiness:no_norms", evidence: "Still missing", remaining: 1, verified: true }])[0].status, "Unable to verify");
  });
  test("red to yellow is partial improvement, not resolution", () => {
    const concern = { ...old, ruleId: "readiness:no_norms" };
    assert.equal(compareConcerns([{ ...concern, level: "red" }], [concern], [{ ruleId: concern.ruleId, evidence: "Progress", remaining: 1, verified: true }])[0].status, "Partially improved");
  });
  test("unchanged concern remains outstanding", () => {
    assert.equal(compareConcerns([old], [old], [])[0].status, "Still outstanding");
  });
  test("previous lock-flag error is a reporting correction, not student credit", () => {
    assert.equal(compareConcerns([{ ...old, reason: "Group Norms not signed and locked." }], [], [])[0].status, "Reporting correction");
  });
  test("new keyed concern is identified separately", () => {
    assert.equal(compareConcerns([], [{ ...old, ruleId: "readiness:no_norms" }], [])[0].status, "New concern");
  });
  test("a decrease in measured remaining problems earns partial recognition", () => {
    const issue = { ...old, ruleId: "readiness:norms_accountability" };
    assert.equal(compareConcerns([issue], [issue], [{ ruleId: issue.ruleId, evidence: "Two details remain", remaining: 2, verified: true }], [{ ruleId: issue.ruleId, evidence: "Four details missing", remaining: 4, verified: true }])[0].status, "Partially improved");
  });
  test("pre-correction activity findings do not earn improvement credit", () => {
    assert.equal(compareConcerns([{ ...old, check: "activity", reason: "No activity" }], [], [])[0].status, "Reporting correction");
  });
  test("last week's legacy research finding matches this week's keyed research concern", () => {
    const legacyResearch = { check: "vault", level: "yellow" as const, reason: "Client research: 0 files found — at least 2 expected now, 4 expected by 10/18." };
    const currentResearch = { check: "vault", level: "red" as const, reason: "Client research: 0 file(s); no text evidence found for company history, industry, competitors, client job description. Expected 4 files or combined coverage of all four topics.", ruleId: "vault:research" };
    assert.equal(compareConcerns([legacyResearch], [currentResearch], [])[0].status, "Still outstanding");
  });
  test("legacy zero-file research finding is credited Resolved once the file count is met", () => {
    const legacyResearch = { check: "vault", level: "yellow" as const, reason: "Client research: 0 files found — at least 2 expected now, 4 expected by 10/18." };
    const fact = { ruleId: "vault:research", evidence: "File count met; topic coverage has not been verified.", remaining: 0, verified: true };
    assert.equal(compareConcerns([legacyResearch], [], [fact])[0].status, "Resolved");
  });
  test("legacy meeting-agreement finding is credited Resolved once every member agrees", () => {
    const legacy = { check: "readiness", level: "yellow" as const, reason: "1 member has not agreed to the meeting time" };
    const fact = { ruleId: "readiness:meeting_not_agreed", evidence: "Every member has now agreed to the current weekly meeting day and time.", remaining: 0, verified: true };
    assert.equal(compareConcerns([legacy], [], [fact])[0].status, "Resolved");
  });
  test("legacy meeting-agreement finding stays outstanding against a named current finding", () => {
    const legacy = { check: "readiness", level: "yellow" as const, reason: "1 member has not agreed to the meeting time" };
    const current = { check: "readiness", level: "yellow" as const, reason: "1 member has not agreed to the meeting time: Jane Doe.", ruleId: "readiness:meeting_not_agreed" };
    assert.equal(compareConcerns([legacy], [current], [])[0].status, "Still outstanding");
  });
});

describe("research accepts combined coverage", () => {
  test("one file can cover history, industry, competitors and client job description", () => {
    const topics = researchCoverage([{ fileName: "Combined research.pdf", text: "The company was founded in 1990. Industry information describes market trends. Competitors include Acme. The client job description includes duties." }]);
    assert.equal(topics.length, 4);
    assert.equal(topics.filter(t => t.evidence.length === 1).length, 4);
  });
  test("unreadable document is not evidence of absent topics", () => {
    assert.equal(researchCoverage([{ fileName: "history industry competitors job description.pdf", text: null }]).flatMap(t => t.evidence).length, 0);
  });
  test("filename alone does not demonstrate content coverage", () => {
    assert.equal(researchCoverage([{ fileName: "company history.pdf", text: "Meeting agenda for Friday" }])[0].evidence.length, 0);
  });
  test("a previous concern whose check is switched off is not shown at all", () => {
    const old = { check: "readiness", level: "red", reason: "Group Norms need clearer communication detail", ruleId: "readiness:norms_communication" } as any;
    assert.equal(compareConcerns([old], [], [], [], new Set(["readiness:norms_communication"])).length, 0);
  });
});