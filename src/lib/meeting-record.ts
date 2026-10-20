export type MeetingAttendance = { user_id: string; status: "present" | "late" | "absent"; reason: string | null };

export function readMeetingAttendance(value: unknown): MeetingAttendance[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item.user_id !== "string" || !["present", "late", "absent"].includes(item.status)) return [];
    return [{ user_id: item.user_id, status: item.status as MeetingAttendance["status"], reason: typeof item.reason === "string" ? item.reason : null }];
  });
}

export function validateMeetingAttendance(attendance: MeetingAttendance[]) {
  const missing = attendance.find((entry) => entry.status === "absent" && !entry.reason?.trim());
  if (missing) throw new Error("Give a reason for each member who missed the meeting");
  return attendance.map((entry) => ({ ...entry, reason: entry.status === "present" ? null : entry.reason?.trim() || null }));
}