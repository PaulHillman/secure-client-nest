import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { escalateConcerns } from "./health-review-escalation";
import type { Concern } from "./health-review-comparison";

const c = (reason: string, ruleId?: string, level: "red" | "yellow" = "yellow"): Concern => ({
  check: "readiness",
  level,
  reason,
  ruleId,
});

describe("escalateConcerns", () => {
  it("leaves first appearances unchanged", () => {
    const [r] = escalateConcerns([c("No manager contact recorded for the client", "readiness:no_manager")], []);
    assert.equal(r.streak, 1);
    assert.equal(r.concern.level, "yellow");
    assert.equal(r.concern.reason, "No manager contact recorded for the client");
  });

  it("upgrades a second consecutive appearance to red with a repeated-warning notice", () => {
    const prior = [[c("No manager contact recorded for the client", "readiness:no_manager")]];
    const [r] = escalateConcerns([c("No manager contact recorded for the client", "readiness:no_manager")], prior);
    assert.equal(r.streak, 2);
    assert.equal(r.concern.level, "red");
    assert.match(r.concern.reason, /red warning/);
  });

  it("adds a grade-deduction notice on the third consecutive appearance", () => {
    const prior = [
      [c("x", "readiness:no_manager")],
      [c("x", "readiness:no_manager")],
    ];
    const [r] = escalateConcerns([c("x", "readiness:no_manager")], prior);
    assert.equal(r.streak, 3);
    assert.equal(r.concern.level, "red");
    assert.match(r.concern.reason, /points will begin being deducted/);
  });

  it("resets the streak when a clean report sits in between (consecutive only)", () => {
    const prior = [
      [c("other", "readiness:no_pm")], // newest shared report: concern absent
      [c("x", "readiness:no_manager")],
    ];
    const [r] = escalateConcerns([c("x", "readiness:no_manager")], prior);
    assert.equal(r.streak, 1);
    assert.equal(r.concern.level, "yellow");
  });

  it("tracks each warning independently", () => {
    const prior = [[c("a", "readiness:no_manager"), c("b", "readiness:no_pm")]];
    const results = escalateConcerns(
      [c("a", "readiness:no_manager"), c("new", "readiness:team_name")],
      prior,
    );
    assert.equal(results[0].streak, 2);
    assert.equal(results[0].concern.level, "red");
    assert.equal(results[1].streak, 1);
    assert.equal(results[1].concern.level, "yellow");
  });

  it("escalates per-person concerns such as report-opening gaps by their own key", () => {
    const opened: Concern = { check: "reports", level: "yellow", reason: "No recorded opening of the report shared 2026-10-08.", person: "Sam", userId: "u1", ruleId: "reports:opened:u1" };
    const [r] = escalateConcerns([opened], [[{ ...opened }]]);
    assert.equal(r.streak, 2);
    assert.equal(r.concern.level, "red");
    assert.equal(r.concern.person, "Sam");
  });

  it("ignores concerns without a stable key", () => {
    const [r] = escalateConcerns([c("free-form text with no key")], [[c("free-form text with no key")]]);
    assert.equal(r.streak, 1);
  });
});
