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
