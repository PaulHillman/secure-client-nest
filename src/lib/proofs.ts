/**
 * Stage C: the twelve individual role practice activities ("proofs").
 *
 * Rules from the course spec:
 *  - Participation only. A recorded submission is Complete, whatever the quality.
 *  - One submission per student per proof. No drafts, no resubmission, no score.
 *  - Feedback is coaching. It never blocks completion and never reverses it.
 *  - Research is only assigned on six-person teams.
 */

import type { TeamJob } from "@/lib/team-roles";

export type ProofField = {
  name: string;
  label: string;
  help?: string;
  placeholder?: string;
  required?: boolean;
};

export type Proof = {
  key: string;
  role: TeamJob;
  title: string;
  /** Spec wording shown as an alias so the handout matches. */
  alias: string;
  howTo: string;
  scenario?: string;
  fields: ProofField[];
  /** Needs a file upload (the tech ZIP challenge). */
  requiresFile?: boolean;
  fileHint?: string;
  /** Cannot open until the professor has posted the course material. */
  needsMaterials?: boolean;
  /** Real person: an unmissable do-not-contact warning plus a required tick. */
  contactWarning?: string;
  /** How many key points the answer key holds, for the professor's record. */
  maxScore?: number;
};

/** Key points recorded for a proof with an answer key. */
export function proofMaxScore(key: string): number {
  return proofByKey(key)?.maxScore ?? 5;
}

export const CONTACT_WARNING =
  "Zach Guy is a real person, and Professor Hillman knows him personally. Research him from public sources only. Do not email, message, call, or contact him or anyone at Steelcase for this activity.";

export const PROOFS: Proof[] = [
  {
    key: "pm_agenda",
    role: "PM",
    title: "Build an Agenda",
    alias: "PM Proof A",
    howTo: "As the PM, what are the topics that should be on your agenda?",
    scenario:
      "Your team has met four times, and you’re heading to the client’s office for the interview in five days. Two members still haven’t posted their interview questions, and the research brief has come up a couple of times, although everyone seems to have a different idea about who is pulling it together. Someone mentions something the team discussed two weeks ago, but nobody is quite sure where that ended up. Last week’s notes are there somewhere, too—you haven’t really gone back through either. One member has missed the last two meetings. You meet together on Tuesday.",
    maxScore: 5,
    fields: [
      {
        name: "topics",
        label: "As the PM, what are the topics that should be on your agenda?",
        required: true,
      },
    ],
  },
  {
    key: "pm_norms",
    role: "PM",
    title: "Apply the Group Norms",
    alias: "PM Proof B",
    howTo: "What would you do if a teammate broke your Group Norms and delayed the team's work?",
    scenario:
      "A teammate arrives late, has not completed an assigned task, and the delay is holding up work other members need to finish.",
    fields: [{ name: "response", label: "What would you do?", required: true }],
  },
  {
    key: "pm_voicemail",
    role: "PM",
    title: "Handle a Voicemail from Professor Hillman",
    alias: "PM Proof C",
    needsMaterials: true,
    howTo: "What does your team need to do after listening to this voicemail?",
    scenario:
      "Professor Hillman leaves you a voicemail before your team's kickoff meeting. Some of it is project business, some of it is course news, and some of it is just conversation. Your job is to separate them and get the right details to the right teammates.",
    fields: [{ name: "response", label: "What does your team need to do?", required: true }],
  },
  {
    key: "comms_minutes",
    role: "Communication Specialist",
    title: "Create Minutes Using Audio and an Optional Transcript",
    alias: "Communications Proof A",
    needsMaterials: true,
    maxScore: 8,
    howTo: "Listen to the recording. What should you record in the meeting minutes?",
    fields: [{ name: "minutes", label: "Meeting minutes", required: true }],
  },
  {
    key: "comms_record",
    role: "Communication Specialist",
    title: "Maintain the Team Record",
    alias: "Communications Proof B",
    howTo: "Where should each item in this situation be kept in ClientVault, if at all?",
    scenario:
      "Six items land in your inbox this week: (1) an auto-generated transcript of Tuesday's meeting, (2) the finished minutes you wrote from it, (3) a team-wide email confirming the shoot date, (4) a client email the Company Liaison has already filed in the vault, (5) an update to the team's management/project information — the manager's title changed, (6) a duplicate copy of the finished meeting minutes that has already been filed correctly.\n\nFolders you can use: Meetings (with date subfolders), Client Communications, Client Research, B-Roll, Group Norms — or Do Not File.",
    fields: [{ name: "response", label: "Where should the items be kept?", required: true }],

  },
  {
    key: "liaison_interview",
    role: "Company Liaison",
    title: "Build the Interview",
    alias: "Liaison Proof A",
    howTo: "Which questions would you ask the manager, and in what order?",
    scenario: [
      "1. Do you like your job?",
      "2. What does a typical week look like for you?",
      "3. How many employees work here?",
      "4. Tell us about a project that did not go to plan and what you did.",
      "5. What is your favourite part of the job?",
      "6. Are you busy?",
      "7. How does your team decide priorities when everything is urgent?",
      "8. What is the company's revenue?",
      "9. What skills matter most in someone you hire?",
      "10. Do you enjoy working here?",
      "11. Can you walk us through how a project moves from request to delivery?",
      "12. What advice would you give a student entering this field?",
    ].join("\n"),
    fields: [{ name: "questions", label: "Your interview questions, in order", required: true }],
  },
  {
    key: "liaison_voicemail",
    role: "Company Liaison",
    title: "Handle a Voicemail from the Client Contact",
    alias: "Liaison Proof B",
    needsMaterials: true,
    maxScore: 8,
    howTo: "What do you need to do after listening to this voicemail?",
    scenario:
      "Your client contact leaves one voicemail with all the logistics for the interview visit. He talks fast, interrupts himself, and does not repeat anything. Some details would stop the interview happening if you missed them; others barely matter.",
    fields: [{ name: "response", label: "What do you need to do?", required: true }],
  },
  {
    key: "video_disaster",
    role: "Video Specialist",
    title: "Production Day Disaster",
    alias: "Video Proof",
    howTo: "What should you do before recording starts? No recording is required.",
    scenario:
      "It is shoot day. Jimmy turns up in a T-shirt and flip-flops. Sarah's script section is not written. Marcus has captured no B-roll at all and the team is well short overall. Two members are set to be on screen for four minutes each while another has under thirty seconds. Recording starts in an hour, and one teammate keeps saying you should just record it anyway and fix it later.",
    fields: [{ name: "response", label: "What should you do?", required: true }],
  },
  {
    key: "tech_zip",
    role: "Client Vault & Tech Administrator",
    title: "ClientVault Disaster ZIP Challenge",
    alias: "Tech Proof A",
    needsMaterials: true,
    requiresFile: true,
    fileHint: "Upload your finished Team No. 5 - Client Vault - Completed.zip (max 100MB).",
    howTo:
      "Download the starter ZIP below, extract it, and open the 'Team No. 5 - Client Vault' folder. Read READ_ME!.rtf and follow it exactly: rename and move the files it lists, keep every file extension, and leave the other files where they are. Do not change the contents of any document, image, PDF, presentation or video — this is only about names, locations and folders. When you are done, zip the completed 'Team No. 5 - Client Vault' folder, name it 'Team No. 5 - Client Vault - Completed.zip', and upload it here.",
    fields: [],
  },

  {
    key: "tech_presentation",
    role: "Client Vault & Tech Administrator",
    title: "Presentation Emergency",
    alias: "Tech Proof B",
    howTo: "What would you check, and what is your backup plan if the projector still does not work?",
    scenario:
      "Your team presents in ten minutes. The laptop is connected but nothing appears on the classroom projector. Everyone is looking at you.",
    fields: [{ name: "response", label: "What would you do?", required: true }],
  },
  {
    key: "research_company",
    role: "Researcher",
    title: "Know the Company",
    alias: "Research Proof",
    contactWarning: CONTACT_WARNING,
    howTo:
      "What did you learn about Steelcase and Zach Guy's Senior Project Manager role? Include links to your public sources.",
    scenario:
      "Company: Steelcase. Manager: Zach Guy. Role to research: Senior Project Manager. These are the professor's research inputs — they are not your team's client, and no outreach of any kind is part of this activity.",
    fields: [{ name: "research", label: "What did you learn?", required: true }],
  },
];

export function proofsForRole(role: string | null | undefined): Proof[] {
  if (!role) return [];
  return PROOFS.filter((p) => p.role === role);
}

export function proofByKey(key: string): Proof | undefined {
  return PROOFS.find((p) => p.key === key);
}

export const FEEDBACK_STATUS_LABEL: Record<string, string> = {
  pending: "Feedback pending",
  available: "Feedback available",
  unavailable: "Feedback temporarily unavailable",
};

/** Required fields with no entry. An empty form is not a recorded attempt. */
export function missingProofFields(key: string, answers: Record<string, string>) {
  const proof = proofByKey(key);
  if (!proof) return [] as string[];
  return proof.fields
    .filter((f) => f.required && !(answers[f.name] ?? "").trim())
    .map((f) => f.label);
}
