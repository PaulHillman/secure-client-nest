import { test } from "node:test";
import { strict as assert } from "node:assert";
import { newestHealthReports, isCurrentHealthWeek, type StudentHealthReport } from "./student-health-history";

const row = (id: string, date: string): StudentHealthReport => ({ id, team_id: "section04-team01", team_label: "Team 01 · Section 04", generated_at: date, shared_at: date, good: 2, fair: 3, bad: 1, vault_file_id: null, vault_version_id: null });
test("this week's report is first and the earliest is last without a three-week limit", () => {
  const rows = [row("earliest", "2026-10-09T03:00:00Z"), row("current", "2026-10-31T00:45:00Z"), row("second", "2026-10-17T00:00:00Z"), row("third", "2026-10-24T00:00:00Z")];
  assert.deepEqual(newestHealthReports(rows).map(r => r.id), ["current", "third", "second", "earliest"]);
  assert.equal(rows[0].id, "earliest");
});
test("this week uses Detroit dates across the UTC midnight boundary", () => {
  assert.equal(isCurrentHealthWeek(row("current", "2026-10-31T00:45:00Z"), "2026-10-31T01:07:00Z"), true);
  assert.equal(isCurrentHealthWeek(row("older", "2026-10-24T00:00:00Z"), "2026-10-31T01:07:00Z"), false);
});