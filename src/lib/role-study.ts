import type { TeamJob } from "@/lib/team-roles";

export type RoleStudy = {
  role: TeamJob;
  blurb: string;
  items: string[];
};

/**
 * Step 1 of Team Readiness — "Study Your Role".
 * Wording comes from the professor's edited role-description document.
 * Every student must tick every item in their own role's list; all other
 * roles are readable but their boxes do not count.
 */
export const ROLE_STUDIES: RoleStudy[] = [
  {
    role: "PM",
    blurb:
      "Runs the team. Sets the agenda, keeps every milestone and the vault on schedule, and is accountable for the team meeting. They are the team's primary interface to Prof Hillman.",
    items: [
      "Set the management firm (team) name and confirm yourself as Project Manager in ClientVault.",
      "Make sure every teammate has picked a role, and chase anyone still unassigned.",
      "Enter the agreed weekly meeting day, time and place in ClientVault.",
      "Take the lead writing the Group Norms document, gathering input from the whole team.",
      "Make sure every member — including you — reads and approves the Group Norms.",
      "Build an agenda before every team meeting. Post it after the meeting.",
      "Check that agenda and minutes are filed in the vault after every meeting.",
      "Review last week's minutes at every meeting.",
      "Track each teammate's assigned work and follow up when something slips.",
      "Confirm the client company and manager details are entered and correct.",
      "Confirm the client interview is scheduled and the date is recorded.",
      "Review the Project Rubric carefully and ensure each item is completed.",
      "Raise anything the team cannot resolve with Prof Hillman early, not late.",
    ],
  },
  {
    role: "Communication Specialist",
    blurb:
      "Keeps the written record of the team. Posts agendas and minutes, and keeps the team and the client talking.",
    items: [
      "Attend every team meeting and take notes as it happens.",
      "Write the official minutes after each meeting — decisions, owners and deadlines.",
      "File minutes in the vault under Meetings, in the correct date subfolder.",
      "(Optional) Keep auto-generated transcripts as reference only; they never replace the minutes.",
      "Send team-wide notices (video shoot dates, deadlines, changes) and file the ones that matter.",
      "Update the team's project/management information when details change.",
      "Capture any client communications and ensure it is properly filed.",
      "Ensure last week's minutes are reviewed at each new week's meeting.",
      "Flag to the PM anything raised in a meeting that has no owner.",
    ],
  },
  {
    role: "Company Liaison",
    blurb:
      "Owns the relationship with the client manager — scheduling, follow-up and the interview.",
    items: [
      "Be the single point of contact with the client manager. All contact runs through you.",
      "Introduce the team to the manager and confirm the project scope.",
      "Schedule the client interview and confirm the date, time and location in writing, update the team.",
      "Collect interview questions from the whole team and put them in a sensible order.",
      "Send the agreed questions to the manager in advance when asked.",
      "Confirm in writing (email only) anything the manager tells you by phone or voicemail.",
      "Pass new client information to the PM and the Communication Specialist the same day.",
      "File all client emails in the vault under Client Communications.",
      "Take the lead on conducting the onsite interview.",
      "Thank the manager after the interview and keep the loop closed to the end.",
    ],
  },
  {
    role: "Video Specialist",
    blurb: "Plans and captures the B-roll and interview footage, and manages the final video.",
    items: [
      "Make sure scripts are written and reviewed before recording starts.",
      "Scripts are posted in the ClientVault before or on the deadline.",
      "Plan the shot list and the story the video needs to tell before shoot day.",
      "Set the dress code and confirm everyone knows it in advance.",
      "Remind all members to generate their own B-roll.",
      "Collect enough B-roll, and check what the team actually has, not what it promised.",
      "Balance on-screen time fairly across the team.",
      "Check equipment, audio, batteries and storage before the shoot.",
      "File raw footage and B-roll in the vault under B-Roll.",
      "(Optional) Edit and create the final video yourself if you have the skills.",
      "Supervise the editing and creation of the final video by outside resources.",
      "Deliver the final edited video by the deadline.",
    ],
  },
  {
    role: "Client Vault & Tech Administrator",
    blurb:
      "Keeps client details current and everything in the vault correctly labelled, filed and visible.",
    items: [
      "Know the vault folder structure and keep it clean, orderly, well labeled.",
      "Name files consistently so anyone on the team can find them.",
      "Move misfiled items to the right folder and remove duplicates.",
      "Keep client company and manager details current in ClientVault.",
      "CRITICAL: Make sure that nothing important is sitting only in someone's inbox or laptop.",
      "Make sure the team can actually open and access what is filed.",
      "Help team members with technical problems accessing the ClientVault.",
      "Own the technology for all presentations — cables, adapters, display, sound.",
      "Have a backup plan ready before any presentation or shoot.",
    ],
  },
  {
    role: "Researcher",
    blurb:
      "Researches the client company and industry, and keeps the team's findings in the vault. (Six-member teams only.)",
    items: [
      "Research the client company: what it does, size, market and recent news.",
      "Research the manager's role and what that job actually involves.",
      "Use public sources only — never contact the company or anyone at it.",
      "Record the links to every source you used.",
      "Turn the research into a short brief the team can read before the interview.",
      "File the brief and sources in the vault under Client Research.",
      "Feed research findings into the interview questions.",
      "Update the brief if the client shares new information.",
    ],
  },
];

export function roleStudy(role: string | null | undefined): RoleStudy | null {
  return ROLE_STUDIES.find((r) => r.role === role) ?? null;
}
