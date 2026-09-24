/**
 * Teams are scoped by section: "Team 1" in section 01 is NOT the same team as
 * "Team 1" in section 02. Always render team names with their section so the
 * two never look identical in admin views.
 *
 * A team may also have a member-chosen display name, which takes precedence.
 */
type TeamLike = {
  name: string;
  section?: string | null;
  display_name?: string | null;
} | null | undefined;

export function teamPrimaryName(team: TeamLike): string {
  if (!team) return "Unassigned";
  const custom = team.display_name?.trim();
  return custom || team.name;
}

export function teamLabel(team: TeamLike): string {
  if (!team) return "Unassigned";
  const primary = teamPrimaryName(team);
  const parts: string[] = [primary];
  if (team.display_name?.trim()) parts.push(team.name);
  if (team.section) parts.push(`Section ${team.section}`);
  return parts.join(" · ");
}

export function extractTeamNumber(name?: string | null): number {
  if (!name) return Infinity;
  const match = name.match(/\d+/);
  return match ? parseInt(match[0], 10) : Infinity;
}

/** "Team 3" → "Team 03"; falls back to the raw name when it has no number. */
export function teamPaddedName(team: TeamLike): string {
  const name = team?.name ?? "";
  const n = extractTeamNumber(name);
  if (!Number.isFinite(n)) return name || "Team";
  return `Team ${String(n).padStart(2, "0")}`;
}

/**
 * Canonical admin ordering: Section first (04 before 05), then the team number
 * (01, 02, 03…), then the record name as a stable tiebreaker.
 */
export function compareTeamsBySectionThenNumber(a: TeamLike, b: TeamLike): number {
  const sa = a?.section ?? "";
  const sb = b?.section ?? "";
  const na = parseInt(sa, 10);
  const nb = parseInt(sb, 10);
  if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
  if (sa !== sb) return sa.localeCompare(sb);
  const ta = extractTeamNumber(a?.name);
  const tb = extractTeamNumber(b?.name);
  if (ta !== tb) return ta - tb;
  return (a?.name ?? "").localeCompare(b?.name ?? "");
}

/**
 * One-line team label: "Team 03 · Upper Mismanagement · Section 04"
 * (record name, member-chosen name when present, then the section).
 */
export function teamLineLabel(team: TeamLike): string {
  if (!team) return "Unassigned";
  const parts: string[] = [teamPaddedName(team)];
  const custom = team.display_name?.trim();
  if (custom) parts.push(custom);
  if (team.section) parts.push(`Section ${team.section}`);
  return parts.join(" · ");
}
