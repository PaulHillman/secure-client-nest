import type { Database } from "@/integrations/supabase/types";

export type TeamJob = Database["public"]["Enums"]["team_job"];

/** Roles a student may claim for themselves. One person per role, per team. */
export const SELECTABLE_ROLES: { value: TeamJob; blurb: string }[] = [
  {
    value: "PM",
    blurb:
      "Project Manager — runs the team, sets the agenda, keeps the milestones and the vault on schedule.",
  },
  {
    value: "Company Liaison",
    blurb:
      "Owns the relationship with the client manager — scheduling, follow-up and the interview.",
  },
  {
    value: "Client Vault & Tech Administrator",
    blurb:
      "Keeps client details current and everything in the vault correctly labelled, filed and visible.",
  },
  {
    value: "Communication Specialist",
    blurb:
      "Posts the agenda and minutes for every meeting, and keeps the team and the client talking.",
  },
  {
    value: "Video Specialist",
    blurb: "Plans and captures the B-roll and interview footage, and manages the final video.",
  },
];

/** Extra role offered only to teams with 6 members. */
export const RESEARCHER_ROLE = {
  value: "Researcher" as TeamJob,
  blurb: "Researches the client company and industry, and keeps the team's findings in the vault.",
};

export function selectableRoles(memberCount: number) {
  return memberCount >= 6 ? [...SELECTABLE_ROLES, RESEARCHER_ROLE] : SELECTABLE_ROLES;
}

export const UNASSIGNED: TeamJob = "Unassigned";

export const TEAM_ROLE_ORDER = [
  "PM",
  "Company Liaison",
  "Client Vault & Tech Administrator",
  "Communication Specialist",
  "Video Specialist",
  "Researcher",
  "Unassigned",
] as const;

export function compareTeamRoles(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  const aIndex = TEAM_ROLE_ORDER.indexOf((a ?? "Unassigned") as (typeof TEAM_ROLE_ORDER)[number]);
  const bIndex = TEAM_ROLE_ORDER.indexOf((b ?? "Unassigned") as (typeof TEAM_ROLE_ORDER)[number]);
  return (aIndex < 0 ? TEAM_ROLE_ORDER.length : aIndex) -
    (bIndex < 0 ? TEAM_ROLE_ORDER.length : bIndex);
}

export function roleBlurb(role: string) {
  return SELECTABLE_ROLES.find((r) => r.value === role)?.blurb ?? "";
}
