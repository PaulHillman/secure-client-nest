export type MeetingLinkRecord = { id: string; meeting_date: string; minutes_file_id?: string | null };
export type MeetingLinkFile = { id: string; file_name: string; subsection: string; meeting_log_id?: string | null; is_template?: boolean | null };

/** Explicit connections only: a date or folder total cannot establish a meeting attachment. */
export function meetingDocumentLinks(meetings: MeetingLinkRecord[], files: MeetingLinkFile[]) {
  const studentFiles = files.filter(f => !f.is_template);
  return meetings.map(meeting => ({
    id: meeting.id,
    date: meeting.meeting_date,
    agendas: studentFiles.filter(f => f.meeting_log_id === meeting.id && f.subsection === "Agendas" && !/minutes/i.test(f.file_name)).map(f => f.file_name),
    minutes: studentFiles.filter(f => (f.meeting_log_id === meeting.id || f.id === meeting.minutes_file_id) && f.subsection === "Minutes").map(f => f.file_name),
  }));
}