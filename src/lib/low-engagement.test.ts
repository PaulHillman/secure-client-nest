import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { lowEngagementStreak, lowEngagementLevel, isMaterialView, WEEK_MS } from "./low-engagement";

const now = Date.parse("2026-10-17T00:00:00Z");
const ago = (weeks: number) => new Date(now - weeks * WEEK_MS + 1000).toISOString();

describe("low engagement three-week cycle", () => {
  test("contribution this week resets the streak", () => {
    assert.equal(lowEngagementStreak("a", [{ userId: "a", at: ago(0) }], now), 0);
  });
  test("one quiet week is a note only", () => {
    assert.equal(lowEngagementLevel(lowEngagementStreak("a", [{ userId: "a", at: ago(1) }], now)), "note");
  });
  test("two consecutive quiet weeks are yellow", () => {
    assert.equal(lowEngagementLevel(lowEngagementStreak("a", [{ userId: "a", at: ago(2) }], now)), "yellow");
  });
  test("three consecutive quiet weeks are red", () => {
    assert.equal(lowEngagementLevel(lowEngagementStreak("a", [], now)), "red");
  });
  test("opening only the health report or dashboard does not count", () => {
    assert.equal(isMaterialView("/app/dashboard", null), false);
    assert.equal(isMaterialView("/app/vault", "Health Reports"), false);
    assert.equal(isMaterialView("/app/vault", null), true);
  });
});
