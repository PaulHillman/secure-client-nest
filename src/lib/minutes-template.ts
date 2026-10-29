/**
 * Meeting Minutes Template compliance (pure, client-safe logic).
 *
 * The shared "Meeting Minutes Template" every team receives requires these
 * labeled sections: date, meeting time, meeting location, project manager,
 * notetaker, attendees, missing attendees, attendees arriving late, agenda
 * topics with discussion and conclusions.
 *
 * Compliance is detected by the template's distinctive structural labels —
 * free-form minutes ("Time:", "Location:", "Present:") carry none of them.
 */
export const MINUTES_TEMPLATE_MARKERS = [
  "project manager",
  "notetaker",
  "missing attendees",
  "arriving late",
  "agenda topics",
  "discussion",
  "conclusions",
] as const;

/** Number of markers a file must show to be judged as following the template. */
export const MINUTES_TEMPLATE_MIN_MARKERS = 6;

/** A separate peer-review appendix/index is a minutes supplement, not standalone minutes. */
export function isPeerReviewMinutesSupplement(name: string): boolean {
  const normalized = normalizeMinutesText(name);
  return /\bpeer review\b/.test(normalized) && /\b(appendix|index)\b/.test(normalized);
}

/** Storage in another folder never turns a supplementary file into submitted minutes. */
export function isStandaloneMinutesSubmission(file: { section: string; subsection: string; file_name: string; category?: string | null; is_template?: boolean }): boolean {
  return file.section === "Team Documents" && file.subsection === "Minutes" && !file.is_template
    && file.category?.toLowerCase() !== "other" && !isPeerReviewMinutesSupplement(file.file_name);
}

export function normalizeMinutesText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function countMinutesTemplateMarkers(text: string): number {
  const norm = normalizeMinutesText(text);
  let n = 0;
  for (const marker of MINUTES_TEMPLATE_MARKERS) {
    if (norm.includes(marker)) n++;
  }
  return n;
}

/** True when the extracted minutes text follows the shared template structure. */
export function minutesFollowTemplate(text: string, minMarkers: number = MINUTES_TEMPLATE_MIN_MARKERS): boolean {
  return countMinutesTemplateMarkers(text) >= minMarkers;
}

/** Minutes for meetings held before this date are exempt from the template requirement. */
export const MINUTES_TEMPLATE_REQUIRED_FROM = "2026-09-27";

/** Date (YYYY-MM-DD) parsed from a minutes file name, e.g. 09-16-2026, 9-16-26, 2026-10-07, 10_21. */
export function dateFromMinutesFileName(name: string, fallbackYear: number): string | null {
  const pad = (n: number) => String(n).padStart(2, "0");
  const iso = name.match(/(20\d{2})[-_.](\d{1,2})[-_.](\d{1,2})/);
  if (iso) return `${iso[1]}-${pad(+iso[2])}-${pad(+iso[3])}`;
  const mdy = name.match(/(?:^|\D)(\d{1,2})[-_.](\d{1,2})(?:[-_.](\d{2,4}))?(?!\d)/);
  if (!mdy) return null;
  const m = +mdy[1], d = +mdy[2];
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const y = mdy[3] ? (mdy[3].length === 2 ? 2000 + +mdy[3] : +mdy[3]) : fallbackYear;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Meeting date a minutes file belongs to: connected meeting, else file-name date, else upload date. */
export function minutesMeetingDate(
  file: { id: string; file_name: string; created_at?: string | null; meeting_log_id?: string | null },
  meetings: { id: string; meeting_date: string; minutes_file_id?: string | null }[],
): string | null {
  const linked = meetings.find((m) => m.id === file.meeting_log_id || m.minutes_file_id === file.id);
  if (linked) return linked.meeting_date;
  const year = file.created_at ? new Date(file.created_at).getUTCFullYear() : new Date().getUTCFullYear();
  return dateFromMinutesFileName(file.file_name, year) ?? (file.created_at ? file.created_at.slice(0, 10) : null);
}

export function minutesExemptFromTemplate(
  file: Parameters<typeof minutesMeetingDate>[0],
  meetings: Parameters<typeof minutesMeetingDate>[1],
  requiredFrom: string = MINUTES_TEMPLATE_REQUIRED_FROM,
): boolean {
  const date = minutesMeetingDate(file, meetings);
  return !!date && date < requiredFrom;
}
