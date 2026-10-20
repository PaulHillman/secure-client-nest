import { describe, expect, it } from "vitest";
import { readMeetingAttendance, validateMeetingAttendance } from "./meeting-record";

describe("meeting attendance corrections", () => {
  it("requires a reason for an absence", () => {
    expect(() => validateMeetingAttendance([{ user_id: "member-1", status: "absent", reason: " " }])).toThrow();
  });
  it("retains absent and late records, including former members", () => {
    const entries = readMeetingAttendance([{ user_id: "former-member", status: "absent", reason: "Ill" }, { user_id: "member-2", status: "late", reason: "10 minutes" }]);
    expect(validateMeetingAttendance(entries)).toEqual([{ user_id: "former-member", status: "absent", reason: "Ill" }, { user_id: "member-2", status: "late", reason: "10 minutes" }]);
  });
});