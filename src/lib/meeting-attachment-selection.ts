export type MeetingAttachmentFile = {
  id: string;
  team_id: string | null;
  section: string;
  subsection: string;
  is_template: boolean;
  meeting_log_id: string | null;
};

/** Existing links, including legacy minutes pointers, must never be reassigned implicitly. */
export function meetingAttachmentState(file: MeetingAttachmentFile, meeting: { id: string; team_id: string; minutes_file_id: string | null }, meetings: { id: string; minutes_file_id: string | null }[]): "attached" | "available" | "unavailable" {
  if (file.team_id !== meeting.team_id || file.is_template || file.section !== "Team Documents" || !["Agendas", "Minutes"].includes(file.subsection)) return "unavailable";
  if (file.meeting_log_id && file.meeting_log_id !== meeting.id) return "unavailable";
  if (meetings.some((other) => other.id !== meeting.id && other.minutes_file_id === file.id)) return "unavailable";
  if (file.meeting_log_id === meeting.id || meeting.minutes_file_id === file.id) return "attached";
  return "available";
}