/**
 * Stage C: the ten individual role practice activities ("proofs").
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
    howTo:
      "Read the situation below and write one usable agenda for a 45 minute meeting. Give the purpose, what members must prepare, the discussion topics in order, the decisions or actions you intend to reach, and time allocations that actually fit 45 minutes. This is practice — it does not replace Professor Hillman's kickoff agenda.",
    scenario:
      "Your team met once. The client proposal is due in five days, two members have not filed their interview questions, and nobody has confirmed who is writing the research brief. One member has missed the last two meetings. You have 45 minutes on Tuesday.",
    checklist: [
      "A clear purpose, not just a list of topics",
      "Topics that genuinely need the whole team",
      "What each member should prepare beforehand",
      "The decisions or actions that must come out of it",
      "Time allocations that add up to the meeting length",
    ],
    fields: [
      { name: "purpose", label: "Meeting purpose", required: true },
      { name: "preparation", label: "What members must prepare beforehand", required: true },
      { name: "topics", label: "Discussion topics, in order, with time allocations", required: true },
      { name: "decisions", label: "Decisions and actions you intend to reach", required: true },
    ],
  },
  {
    key: "pm_norms",
    role: "PM",
    title: "Apply the Group Norms",
    alias: "PM Proof B",
    howTo:
      "Answer all four questions. Refer to your team's posted norms if you have them. If your team has not posted norms yet, say so plainly, describe the agreement you would need, and explain how you would establish it — do not claim an unagreed rule is already team policy. You can submit now without waiting for the team.",
    scenario:
      "A teammate arrives late, has not completed an assigned task, and the delay is holding up work other members need to finish.",
    checklist: [
      "Uses your team's actual norms where they exist",
      "Addresses the person directly and respectfully",
      "Explains the impact on the team",
      "Follows the agreed accountability process",
      "Does not jump straight to the professor before the team has used its own process",
    ],
    fields: [
      { name: "first_step", label: "What would you do first?", required: true },
      { name: "what_say", label: "What would you say to the teammate?", required: true },
      { name: "which_norms", label: "Which Group Norm(s) apply?", required: true },
      { name: "if_repeated", label: "What happens if the behaviour occurs again?", required: true },
    ],
  },
  {
    key: "pm_voicemail",
    role: "PM",
    title: "Handle a Voicemail from Professor Hillman",
    alias: "PM Proof C",
    needsMaterials: true,
    howTo:
      "Listen to the voicemail from Professor Hillman. It contains exactly five items your team needs to act on, mixed in with conversation that does not belong on a project action list. Outline the five items, name who on the team should know or own each one, and list what you deliberately left off. You are describing your process — do not actually call or message anyone.",
    scenario:
      "Professor Hillman leaves you a voicemail before your team's kickoff meeting. Some of it is project business, some of it is course news, and some of it is just conversation. Your job is to separate them and get the right details to the right teammates.",
    checklist: [
      "All five project items identified — nothing missed",
      "Each item paired with the teammate who should know or own it",
      "Distractions and course-only news kept off the project action list",
      "Follow-up actions and deadlines you set yourself where none were given",
      "The message preserved in ClientVault where the team can find it later",
    ],
    fields: [
      {
        name: "five_items",
        label: "The five items your team must act on — for each one, who on the team should know or own it",
        help: "Numbered list of five. Be specific about names/roles and what each person needs to do.",
        required: true,
      },
      {
        name: "not_actions",
        label: "What you deliberately left off the project action list, and why",
        required: true,
      },
      {
        name: "follow_up",
        label: "Follow-up actions and deadlines you would set, and where you record this in ClientVault",
        required: true,
      },
    ],
  },
  {
    key: "comms_minutes",
    role: "Communication Specialist",
    title: "Create Minutes Using Audio and an Optional Transcript",
    alias: "Communications Proof A",
    needsMaterials: true,
    howTo:
      "Listen to the supplied recording, and consult the reference transcript if it helps. Write one set of minutes below. Capture the decisions, actions, owners, deadlines and next meeting; leave out the irrelevant chatter. If a detail is not stated in the recording, write that it is not stated. Write minutes — do not paste the transcript.",
    checklist: [
      "Every decision that was reached",
      "Action items with the named owner and deadline",
      "The next meeting date and time",
      "Irrelevant conversation left out",
      "Ambiguity flagged rather than guessed",
    ],
    fields: [
      { name: "date_attendees", label: "Meeting date and attendees", required: true },
      { name: "discussion", label: "Discussion", required: true },
      { name: "decisions", label: "Conclusions / decisions", required: true },
      { name: "actions", label: "Action items, person responsible, deadline", required: true },
      { name: "next_meeting", label: "Next meeting", required: true },
    ],
  },
  {
    key: "comms_record",
    role: "Communication Specialist",
    title: "Maintain the Team Record",
    alias: "Communications Proof B",
    howTo:
      "For each item below, say whether and where you would preserve it in ClientVault, and briefly why. Say which item is a reference transcript and which is the final minutes. Explain how you would use the Liaison's existing client email record without duplicating it.",
    scenario:
      "Five items land in your inbox this week: (1) an auto-generated transcript of Tuesday's meeting, (2) the finished minutes you wrote from it, (3) a team-wide email confirming the shoot date, (4) a client email the Company Liaison has already filed in the vault, (5) an update to the team's management/project information — the manager's title changed.",
    checklist: [
      "Distinguishes the reference transcript from the official minutes",
      "Names a specific vault location for each item kept",
      "Does not duplicate the Liaison's client correspondence",
      "Puts the information update into the existing project record rather than a new file",
    ],
    fields: [
      { name: "item_placement", label: "Each item: keep or not, and where it goes", required: true },
      { name: "transcript_vs_minutes", label: "Transcript versus final minutes — how you tell them apart in the vault", required: true },
      { name: "no_duplication", label: "How you use the Liaison's client email without duplicating it", required: true },
      { name: "info_update", label: "How you handle the management/project information update", required: true },
    ],
  },
  {
    key: "liaison_interview",
    role: "Company Liaison",
    title: "Build the Interview",
    alias: "Liaison Proof A",
    howTo:
      "Review the twelve questions below. Submit the ones you would keep, in interview order, improving weak wording where it helps. Say which you would drop and briefly explain the important choices. This is practice — do not contact a manager.",
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
    fields: [
      { name: "selected", label: "Your selected questions, in interview order", required: true },
      { name: "removed", label: "Questions you would remove, and why", required: true },
      { name: "rewrites", label: "Wording you improved", required: true },
      { name: "reasoning", label: "Brief explanation of your important choices", required: true },
    ],
  },
  {
    key: "liaison_loop",
    role: "Company Liaison",
    title: "Close the Communication Loop",
    alias: "Liaison Proof B",
    howTo:
      "Submit a numbered sequence of what you would do next. Cover confirming by email, informing your teammates, preserving the communication in ClientVault, and recording and following up the resulting actions. You are describing the process — do not send an actual email or contact a client.",
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
    fields: [
      { name: "steps", label: "Your numbered steps, in order", required: true },
      { name: "confirmation", label: "What your confirming email would say", required: true },
      { name: "vault", label: "What you preserve in ClientVault, and where", required: true },
      { name: "actions", label: "The team actions this creates, and who owns them", required: true },
    ],
  },
  {
    key: "video_disaster",
    role: "Video Specialist",
    title: "Production Day Disaster",
    alias: "Video Proof",
    howTo:
      "Read the scenario. Submit the problems you see, what you would do and in what order, and what you would postpone rather than let the team record it wrong. Explain your reasoning about appearance, scripts, B-roll, participation and consistency. No recording is required.",
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
    fields: [
      { name: "problems", label: "What problems do you see?", required: true },
      { name: "actions", label: "What would you do?", required: true },
      { name: "order", label: "In what order?", required: true },
      { name: "postpone", label: "What would you postpone rather than record incorrectly?", required: true },
    ],
  },
  {
    key: "tech_zip",
    role: "Client Vault & Tech Administrator",
    title: "ClientVault Disaster ZIP Challenge",
    alias: "Tech Proof A",
    needsMaterials: true,
    requiresFile: true,
    fileHint: "Upload your finished .zip (max 100MB).",
    howTo:
      "Download the challenge ZIP, unzip it, and read README_FIRST. Rename and place the files as instructed, keep every file extension unchanged, delete nothing that is required, then re-zip the completed structure and upload that ZIP here. A successful upload records completion. Automated feedback tells you what differs from the expected structure — you do not redo it.",
    checklist: [
      "Required folder structure created",
      "Naming convention followed exactly",
      "File extensions unchanged",
      "No required file deleted",
      "Files inspected where the name alone does not say where they belong",
      "The completed structure re-zipped and uploaded",
    ],
    fields: [
      {
        name: "notes",
        label: "Anything you had to judge, and how you decided",
        help: "Optional, but useful where a file's home was not obvious.",
      },
    ],
  },
  {
    key: "tech_presentation",
    role: "Client Vault & Tech Administrator",
    title: "Presentation Emergency",
    alias: "Tech Proof B",
    howTo:
      "Submit a numbered troubleshooting sequence: what you check first, what you try next when that fails, and your practical backup plan. Explain your sequence briefly. No equipment demonstration is required.",
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
    fields: [
      { name: "steps", label: "Your troubleshooting steps, in order", required: true },
      { name: "backup", label: "Your backup plan if nothing works", required: true },
      { name: "reasoning", label: "Why this order", required: true },
    ],
  },
  {
    key: "research_company",
    role: "Researcher",
    title: "Know the Company",
    alias: "Research Proof",
    contactWarning: CONTACT_WARNING,
    howTo:
      "Research Steelcase, and the Senior Project Manager role held by Zach Guy, using public sources only. Attach source links to the facts they support, say which sources are strongest and why, and keep verified facts about the person separate from general expectations of the role. Mark anything you cannot verify as not found. Submit once. No organisational chart is required for this activity.",
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
    fields: [
      { name: "company", label: "Location, size, number of locations", required: true },
      { name: "industry", label: "Industry and major competitors", required: true },
      { name: "history", label: "Company history and background", required: true },
      { name: "role_duties", label: "Where you would look for the role's likely duties, and what you found", required: true },
      { name: "sources", label: "Your sources, and which are strongest and why", required: true },
    ],
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
