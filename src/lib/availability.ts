export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** 6:00am through 11:30pm, half-hour steps (minutes from midnight). */
export const SLOT_START = 6 * 60;
export const SLOT_END = 24 * 60; // exclusive
export const SLOT_STEP = 30;

export const SLOT_MINUTES: number[] = (() => {
  const out: number[] = [];
  for (let m = SLOT_START; m < SLOT_END; m += SLOT_STEP) out.push(m);
  return out;
})();

export function slotKey(day: number, minutes: number) {
  return `${day}-${minutes}`;
}

export function fmtSlot(minutes: number) {
  const h24 = Math.floor(minutes / 60);
  const mm = minutes % 60;
  const ampm = h24 >= 12 ? "pm" : "am";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(mm).padStart(2, "0")}${ampm}`;
}

export function slotRangeLabel(day: number, minutes: number) {
  return `${DAY_LABELS[day]} ${fmtSlot(minutes)}–${fmtSlot(minutes + SLOT_STEP)}`;
}

/** Distinct, accessible-ish colors for overlaying teammates. */
export const MEMBER_COLORS = [
  "#c2410c",
  "#1d4ed8",
  "#15803d",
  "#a21caf",
  "#b45309",
  "#0f766e",
  "#be123c",
  "#4338ca",
  "#65a30d",
  "#0369a1",
] as const;

export function memberColor(index: number) {
  return MEMBER_COLORS[index % MEMBER_COLORS.length] as string;
}
