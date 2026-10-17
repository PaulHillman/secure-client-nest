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
export function minutesFollowTemplate(text: string): boolean {
  return countMinutesTemplateMarkers(text) >= MINUTES_TEMPLATE_MIN_MARKERS;
}
