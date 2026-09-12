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
  checklist: string[];
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
    checklist: [],
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
    checklist: [
      "Uses your team's actual norms where they exist",
      "Addresses the person directly and respectfully",
      "Explains the impact on the team",
      "Follows the agreed accountability process",
      "Does not jump straight to the professor before the team has used its own process",
    ],
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
    checklist: [
      "All five project items identified — nothing missed",
      "Each item paired with the teammate who should know or own it",
      "Distractions and course-only news kept off the project action list",
      "Follow-up actions and deadlines you set yourself where none were given",
      "The message preserved in ClientVault where the team can find it later",
    ],
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
    checklist: [
      "Every decision that was reached",
      "Action items with the named owner and deadline",
      "The next meeting date and time",
      "Irrelevant conversation left out",
      "Ambiguity flagged rather than guessed",
    ],
    fields: [{ name: "minutes", label: "Meeting minutes", required: true }],
  },
  {
    key: "comms_record",
    role: "Communication Specialist",
    title: "Maintain the Team Record",
    alias: "Communications Proof B",
    howTo: "Where should each item in this situation be kept in ClientVault, if at all?",
    scenario:
      "Five items land in your inbox this week: (1) an auto-generated transcript of Tuesday's meeting, (2) the finished minutes you wrote from it, (3) a team-wide email confirming the shoot date, (4) a client email the Company Liaison has already filed in the vault, (5) an update to the team's management/project information — the manager's title changed.",
    checklist: [
      "Distinguishes the reference transcript from the official minutes",
      "Names a specific vault location for each item kept",
      "Does not duplicate the Liaison's client correspondence",
      "Puts the information update into the existing project record rather than a new file",
    ],
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
    checklist: [
      "Open-ended questions that invite examples and stories",
      "Questions appropriate to ask a manager",
      "Duplicates and yes/no questions removed",
      "A logical sequence, easy questions first",
      "Professional wording",
    ],
    fields: [{ name: "questions", label: "Your interview questions, in order", required: true }],
  },
  {
    key: "liaison_loop",
    role: "Company Liaison",
    title: "Close the Communication Loop",
    alias: "Liaison Proof B",
    howTo: "What should you do after this phone call?",
    scenario:
      "The manager phones you. She gives important new information about the project, moves the interview from Thursday to the following Monday, and asks the team to send its questions in advance.",
    checklist: [
      "Does not rely on memory",
      "Does not treat texting as the official client channel",
      "Sends a professional email confirming the conversation and details",
      "Keeps the right teammates informed",
      "Preserves the communication in ClientVault",
      "Creates and follows through on the resulting team actions",
    ],
    fields: [{ name: "response", label: "What should you do next?", required: true }],
  },
  {
    key: "liaison_voicemail",
    role: "Company Liaison",
    title: "Handle a Voicemail from the Client Contact",
    alias: "Liaison Proof C",
    needsMaterials: true,
    maxScore: 8,
    howTo: "What do you need to do after listening to this voicemail?",
    scenario:
      "Your client contact leaves one voicemail with all the logistics for the interview visit. He talks fast, interrupts himself, and does not repeat anything. Some details would stop the interview happening if you missed them; others barely matter.",
    checklist: [
      "The questions deadline: one combined list, at least 36 hours ahead, by email and text, with the actual questions in both",
      "Arrival and security: 20 minutes early, photo ID for all five, badges, ask for Jimmy in Sales, wait in the lobby for an escort",
      "No recording of any kind — no audio, video or AI transcription; phones away, paper and pens",
      "85 minutes maximum, including introductions and wrap-up; arriving late does not move the finish",
      "Parking: east-side Visitor entrance and Visitor spaces only",
      "A tour afterwards for all five, separate from the 85 minutes, length not yet confirmed",
      "Bring the gate ticket in and get it validated at security",
      "Lobby coffee is optional and at your own cost — and must not delay check-in",
      "Most consequential items first, exact numbers preserved",
      "Chatter and interruptions left off the team summary",
    ],
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
    checklist: [
      "Professional presentation on camera",
      "Scripts and transcripts ready before recording",
      "Adequate B-roll",
      "Required and even on-screen time",
      "Consistency across presenters",
      "Corrective feedback given before and during production",
      "Protecting the final product even when that means holding teammates accountable",
    ],
    fields: [{ name: "response", label: "What should you do?", required: true }],
  },
  {
    key: "tech_zip",
    role: "Client Vault & Tech Administrator",
    title: "ClientVault Disaster ZIP Challenge",
    alias: "Tech Proof A",
    needsMaterials: true,
    requiresFile: true,
    fileHint: "Upload your finished .zip (max 100MB).",
    howTo: "Organize the challenge files as directed, then upload your completed ZIP.",
    checklist: [
      "Required folder structure created",
      "Naming convention followed exactly",
      "File extensions unchanged",
      "No required file deleted",
      "Files inspected where the name alone does not say where they belong",
      "The completed structure re-zipped and uploaded",
    ],
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
    checklist: [
      "Physical connection, cable and adapter",
      "Correct display or input source",
      "Computer display settings",
      "Disconnect and reconnect",
      "Alternate cable or adapter if one is available",
      "Restart when it is worth the time",
      "A practical backup plan if the setup cannot be restored",
    ],
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
    checklist: [
      "Home office location, approximate employees, number of locations",
      "Industry and major competitors",
      "Basic company history",
      "Where you would find a credible description of the role's likely duties",
      "Useful information about the industry",
      "Sources attached to the facts they support, strongest ones identified",
      "Verified facts kept separate from general role expectations",
    ],
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
