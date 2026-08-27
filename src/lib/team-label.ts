/**
 * Teams are scoped by section: "Team 1" in section 01 is NOT the same team as
 * "Team 1" in section 02. Always render team names with their section so the
 * two never look identical in admin views.
 */
export function teamLabel(
  team: { name: string; section?: string | null } | null | undefined,
): string {
  if (!team) return "Unassigned";
  return team.section ? `${team.name} · Sec ${team.section}` : team.name;
}
