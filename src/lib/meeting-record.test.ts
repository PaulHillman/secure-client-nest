import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { readMeetingAttendance, validateMeetingAttendance } from "./meeting-record";

describe("meeting attendance corrections", () => {
  it("requires a reason for an absence", () => {
    assert.throws(() => validateMeetingAttendance([{ user_id: "member-1", status: "absent", reason: " " }]));
  });
  it("retains absent and late records, including former members", () => {
    const entries = readMeetingAttendance([{ user_id: "former-member", status: "absent", reason: "Ill" }, { user_id: "member-2", status: "late", reason: "10 minutes" }]);
    assert.deepEqual(validateMeetingAttendance(entries), [{ user_id: "former-member", status: "absent", reason: "Ill" }, { user_id: "member-2", status: "late", reason: "10 minutes" }]);
  });
});