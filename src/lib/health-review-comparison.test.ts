import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { compareConcerns, researchCoverage } from "./health-review-comparison";

describe("weekly shared-report concern comparisons", () => {
  const old = { check: "readiness", level: "yellow" as const, reason: "No selection rationale recorded" };
  test("specific fixed concern earns recognition only with verified zero remaining", () => {
    const [change] = compareConcerns([old], [], [{ ruleId: "readiness:no_rationale", evidence: "A selection rationale is recorded.", remaining: 0, verified: true }]);
    assert.equal(change.status, "Resolved");
    assert.match(change.current, /selection rationale is recorded/);
  });
  test("disappearing concern without evidence is unverified", () => {
    assert.equal(compareConcerns([old], [], [])[0].status, "Unable to verify");
  });
  test("nonzero remaining cannot receive resolved credit", () => {
    assert.equal(compareConcerns([old], [], [{ ruleId: "readiness:no_rationale", evidence: "Still missing", remaining: 1, verified: true }])[0].status, "Unable to verify");
  });
  test("red to yellow is partial improvement, not resolution", () => {
    const concern = { ...old, ruleId: "readiness:no_rationale" };
    assert.equal(compareConcerns([{ ...concern, level: "red" }], [concern], [{ ruleId: concern.ruleId, evidence: "Progress", remaining: 1, verified: true }])[0].status, "Partially improved");
  });
  test("unchanged concern remains outstanding", () => {
    assert.equal(compareConcerns([old], [old], [])[0].status, "Still outstanding");
  });
  test("previous lock-flag error is a reporting correction, not student credit", () => {
    assert.equal(compareConcerns([{ ...old, reason: "Group Norms not signed and locked." }], [], [])[0].status, "Reporting correction");
  });
  test("new keyed concern is identified separately", () => {
    assert.equal(compareConcerns([], [{ ...old, ruleId: "readiness:no_rationale" }], [])[0].status, "New concern");
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
});