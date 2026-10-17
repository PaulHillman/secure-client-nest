import { describe, expect, it } from "vitest";
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
    expect(r.streak).toBe(1);
    expect(r.concern.level).toBe("yellow");
    expect(r.concern.reason).toBe("No manager contact recorded for the client");
  });

  it("upgrades a second consecutive appearance to red with a repeated-warning notice", () => {
    const prior = [[c("No manager contact recorded for the client", "readiness:no_manager")]];
    const [r] = escalateConcerns([c("No manager contact recorded for the client", "readiness:no_manager")], prior);
    expect(r.streak).toBe(2);
    expect(r.concern.level).toBe("red");
    expect(r.concern.reason).toContain("red warning");
  });

  it("adds a grade-deduction notice on the third consecutive appearance", () => {
    const prior = [
      [c("x", "readiness:no_manager")],
      [c("x", "readiness:no_manager")],
    ];
    const [r] = escalateConcerns([c("x", "readiness:no_manager")], prior);
    expect(r.streak).toBe(3);
    expect(r.concern.level).toBe("red");
    expect(r.concern.reason).toContain("points will begin being deducted");
  });

  it("resets the streak when a clean report sits in between (consecutive only)", () => {
    const prior = [
      [c("other", "readiness:no_pm")], // newest shared report: concern absent
      [c("x", "readiness:no_manager")],
    ];
    const [r] = escalateConcerns([c("x", "readiness:no_manager")], prior);
    expect(r.streak).toBe(1);
    expect(r.concern.level).toBe("yellow");
  });

  it("tracks each warning independently", () => {
    const prior = [[c("a", "readiness:no_manager"), c("b", "readiness:no_pm")]];
    const results = escalateConcerns(
      [c("a", "readiness:no_manager"), c("new", "readiness:team_name")],
      prior,
    );
    expect(results[0].streak).toBe(2);
    expect(results[0].concern.level).toBe("red");
    expect(results[1].streak).toBe(1);
    expect(results[1].concern.level).toBe("yellow");
  });

  it("escalates per-person concerns such as report-opening gaps by their own key", () => {
    const opened: Concern = { check: "reports", level: "yellow", reason: "No recorded opening of the report shared 2026-10-08.", person: "Sam", userId: "u1", ruleId: "reports:opened:u1" };
    const [r] = escalateConcerns([opened], [[{ ...opened }]]);
    expect(r.streak).toBe(2);
    expect(r.concern.level).toBe("red");
    expect(r.concern.person).toBe("Sam");
  });

  it("ignores concerns without a stable key", () => {
    const [r] = escalateConcerns([c("free-form text with no key")], [[c("free-form text with no key")]]);
    expect(r.streak).toBe(1);
  });
});
