/**
 * Individual checks the instructor can switch off — either in saved settings
 * (every run) or just for one run. Keys are the stable concern identifiers the
 * runner already uses, so a switched-off check neither raises a concern nor
 * earns "fixed" credit in week-to-week comparisons.
 */
export type CheckSwitch = { key: string; group: string; label: string; hint: string };

export const CHECK_SWITCHES: CheckSwitch[] = [
  { key: "readiness:no_norms", group: "Group Norms", label: "Group Norms posted", hint: "Flags a team that has not posted Group Norms." },
  { key: "readiness:norms_incomplete", group: "Group Norms", label: "Every required section filled in", hint: "Flags blank required sections." },
  { key: "readiness:norms_communication", group: "Group Norms", label: "Communication wording is measurable", hint: "Flags vague wording such as \"ASAP\", \"a few hours\", \"5–10 minutes\", \"regularly\"." },
  { key: "readiness:norms_deadlines", group: "Group Norms", label: "Internal deadline wording is measurable", hint: "Flags deadlines without a single exact time or number." },
  { key: "readiness:norms_accountability", group: "Group Norms", label: "Accountability wording is concrete", hint: "Flags consequences that are not specific and enforceable (\"try to\", \"reasonable\", \"etc.\")." },
  { key: "readiness:norms_not_agreed", group: "Group Norms", label: "All members agreed to the current version", hint: "Names members who have not agreed in Team Readiness." },
  { key: "gaps:norms_signatures", group: "Group Norms", label: "All members signed the current version", hint: "Dashboard Gaps: names members who have not signed." },
];

const KNOWN = new Set(CHECK_SWITCHES.map((s) => s.key));

/** Keeps only known check keys, de-duplicated. */
export function cleanCheckKeys(keys: unknown): string[] {
  if (!Array.isArray(keys)) return [];
  return [...new Set(keys.filter((k): k is string => typeof k === "string" && KNOWN.has(k)))];
}

/** Saved switches plus this run's extra switches. */
export function effectiveDisabled(saved: unknown, forRun: unknown): Set<string> {
  return new Set([...cleanCheckKeys(saved), ...cleanCheckKeys(forRun)]);
}

export function checkLabel(key: string) {
  return CHECK_SWITCHES.find((s) => s.key === key)?.label ?? key;
}
