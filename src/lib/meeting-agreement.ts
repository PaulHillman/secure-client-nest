export const AGREEMENT_VERSION = "1.0";

export const FACE_TO_FACE = "In person (face-to-face)";

// Face-to-face is the only acceptable meeting mode.
export const MEETING_MODES = [FACE_TO_FACE] as const;

export const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function fmtTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const hr12 = ((h + 11) % 12) + 1;
  const ampm = h < 12 ? "AM" : "PM";
  return `${hr12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export const AGREEMENT_CLAUSES = [
  "I agree to the weekly meeting day, time, place and meeting mode listed above for my team, and I will attend and participate every week.",
  "If I need this meeting time changed at any point in the semester, it is MY responsibility — not the Project Manager's and not the rest of the team's — to find a new day and time that works for every member and to obtain their agreement.",
  "Any new meeting day, time, place or mode must be entered in ClientVault so that every team member can re-approve it.",
  "Professor Hillman must be notified whenever the meeting day or time changes.",
  "I understand that changing any of these details clears all prior approvals, and every member of my team must approve the new time before it counts as agreed.",
];

export function agreementText(details: string) {
  return [
    `ClientVault Team Meeting Agreement (v${AGREEMENT_VERSION})`,
    details,
    ...AGREEMENT_CLAUSES.map((c, i) => `${i + 1}. ${c}`),
  ].join("\n");
}

export function meetingDetailsLine(p: {
  day_of_week: number;
  meeting_time: string;
  location?: string | null;
  meeting_mode?: string | null;
}) {
  const parts = [`${DAYS[p.day_of_week]} at ${fmtTime(p.meeting_time)}`];
  if (p.location) parts.push(`Place: ${p.location}`);
  if (p.meeting_mode) parts.push(`Mode: ${p.meeting_mode}`);
  return parts.join(" · ");
}
