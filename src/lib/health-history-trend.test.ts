import { test } from "node:test";
import { strict as assert } from "node:assert";
import { assessHistoryTrend, threeWeekHistory, type HistoryScore } from "./health-history-trend";
const row = (id: string, date: string, red: number, yellow = 2, team = "real"): HistoryScore => ({ id, report_id: id, team_id: team, team_label: team, section: "04", good: 4, red, yellow, created_at: date });
const series = (reds: number[], yellows = [2, 2, 2]) => reds.map((red, i) => row(String(i), ["2026-10-24T18:00:00Z", "2026-10-17T18:00:00Z", "2026-10-09T18:00:00Z"][i], red, yellows[i]));
test("three reports stay together newest first and repeated weekly saves do not consume a week", () => {
  const rows = [...series([1, 2, 3]), row("repeat", "2026-10-23T18:00:00Z", 4), row("other", "2026-10-24T18:00:00Z", 0, 0, "other")];
  assert.deepEqual(threeWeekHistory(rows.reverse(), "real").map(r => r.id), ["0", "1", "2"]);
});
test("fewer red concerns yields green upward assessment", () => assert.equal(assessHistoryTrend(series([1, 2, 3])).direction, "up"));
test("more red concerns yields red downward assessment", () => assert.equal(assessHistoryTrend(series([3, 2, 1])).direction, "down"));
test("unchanged counts yields yellow sideways assessment", () => assert.equal(assessHistoryTrend(series([2, 2, 2])).label, "Steady"));
test("mixed weekly direction is yellow rather than claiming sustained improvement", () => assert.equal(assessHistoryTrend(series([1, 4, 3])).label, "Mixed trend"));
test("yellow decreases break a red-count tie", () => assert.equal(assessHistoryTrend(series([1, 1, 1], [1, 2, 3])).direction, "up"));
test("less than three weeks never invents a direction", () => assert.equal(assessHistoryTrend(series([1, 2])).label, "Not enough history"));
test("missing calendar week is not a three-week assessment", () => {
  const rows = series([1, 2, 3]); rows[2].created_at = "2026-10-02T18:00:00Z";
  assert.equal(assessHistoryTrend(rows).label, "Missing weekly report");
});