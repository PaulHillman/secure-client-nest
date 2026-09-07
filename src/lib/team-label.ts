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
