import { test } from "node:test";
import { strict as assert } from "node:assert";
import { filterStudentLogins, loginPeriodRange, type StudentLogin } from "./student-logins";

const now = "2026-10-31T13:09:00Z";
const row = (name: string, latest: string | null, recent: string[] = latest ? [latest] : []): StudentLogin => ({ user_id: name, student_name: name, email: null, section: "04", teams: "Team 1", roles: ["PM"], last_login_at: latest, recent_logins: recent });
test("today uses Detroit midnight and returns most recent logins first", () => {
  const students = [row("Earlier", "2026-10-31T04:00:00Z"), row("Yesterday", "2026-10-31T03:59:59Z"), row("Latest", "2026-10-31T12:00:00Z")];
  assert.deepEqual(filterStudentLogins(students, "recent", "today", 7, now).map(r => r.user_id), ["Latest", "Earlier"]);
});
test("yesterday includes a student who also logged in today", () => {
  const student = row("Both", "2026-10-31T12:00:00Z", ["2026-10-31T12:00:00Z", "2026-10-30T15:00:00Z"]);
  assert.equal(filterStudentLogins([student], "recent", "yesterday", 7, now).length, 1);
});
test("last week is the previous Monday through Sunday, not this week", () => {
  assert.deepEqual(loginPeriodRange("last_week", now), { start: "2026-10-19", end: "2026-10-25" });
  const students = [row("Last week", "2026-10-26T03:59:00Z"), row("This week", "2026-10-26T04:00:00Z")];
  assert.deepEqual(filterStudentLogins(students, "recent", "last_week", 7, now).map(r => r.user_id), ["Last week"]);
});
for (const days of [7, 14, 21, 10]) {
  test(`no login for ${days} days includes the exact cutoff and never-signed-in students`, () => {
    const cutoff = Date.parse(now) - days * 86400000;
    const students = [row("Recent", new Date(cutoff + 1000).toISOString()), row("Absent", new Date(cutoff).toISOString()), row("Never", null)];
    assert.deepEqual(filterStudentLogins(students, "inactive", "today", days, now).map(r => r.user_id), ["Absent", "Never"]);
  });
}
test("Detroit date boundaries remain correct after daylight saving ends", () => {
  assert.deepEqual(loginPeriodRange("today", "2026-11-02T04:59:00Z"), { start: "2026-11-01", end: "2026-11-01" });
});
test("returning while still signed in is not 21-day inactivity", () => {
  const student = { ...row("Anthony", "2026-10-09T14:47:52Z"), last_visit_at: "2026-10-31T01:59:18Z", recent_visits: ["2026-10-31T01:59:18Z"] };
  assert.equal(filterStudentLogins([student], "inactive", "all", 21, now, "visit").length, 0);
  assert.equal(filterStudentLogins([student], "inactive", "all", 21, now, "signin").length, 1);
  assert.equal(filterStudentLogins([student], "recent", "yesterday", 21, now, "visit").length, 1);
});
test("a missing observed visit stays unknown rather than inheriting a fabricated date", () => {
  const student = { ...row("Unknown", null), last_visit_at: null, recent_visits: [] };
  assert.equal(filterStudentLogins([student], "recent", "today", 7, now, "visit").length, 0);
  assert.equal(filterStudentLogins([student], "inactive", "today", 7, now, "visit").length, 1);
});