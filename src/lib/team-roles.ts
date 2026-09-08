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
    value: "Communication Specialist",
    blurb:
      "Posts the agenda and minutes for every meeting, and keeps the team and the client talking.",
  },
  {
    value: "Video Specialist",
    blurb: "Plans and captures the B-roll and interview footage, and manages the final video.",
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
];

export const UNASSIGNED: TeamJob = "Unassigned";

export function roleBlurb(role: string) {
  return SELECTABLE_ROLES.find((r) => r.value === role)?.blurb ?? "";
}
