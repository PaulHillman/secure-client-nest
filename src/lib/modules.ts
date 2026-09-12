/**
 * Stage B: each of the six requirements becomes a real submission with its own
 * short answer sheet. Fields live here so one edit changes the student form and
 * the professor's review panel at the same time.
 */

export type ModuleField = {
  name: string;
  label: string;
  help?: string;
  kind: "text" | "textarea";
  required?: boolean;
  placeholder?: string;
};

export type ModuleForm = {
  key: string;
  intro: string;
  fields: ModuleField[];
};

export const MODULE_FORMS: Record<string, ModuleForm> = {
  team_setup: {
    key: "team_setup",
    intro:
      "Confirm the basics of your team. Everyone must be holding a role before this can be submitted.",
    fields: [
      { name: "team_name", label: "Team name", kind: "text", required: true },
      { name: "pm_name", label: "Project Manager", kind: "text", required: true },
      {
        name: "meeting",
        label: "Agreed meeting day, time, place and mode",
        kind: "textarea",
        required: true,
        placeholder: "Tuesdays 4:00pm, Library room 214, in person",
      },
      {
        name: "notes",
        label: "Anything your professor should know",
        kind: "textarea",
      },
    ],
  },
  client_proposal: {
    key: "client_proposal",
    intro: "The company you want to work with, and why. Your professor approves or sends this back.",
    fields: [
      { name: "company_name", label: "Company name", kind: "text", required: true },
      { name: "manager_name", label: "Manager name", kind: "text", required: true },
      { name: "manager_title", label: "Manager job title", kind: "text", required: true },
      { name: "industry", label: "Industry", kind: "text", required: true },
      { name: "company_size", label: "Number of employees", kind: "text", required: true },
      { name: "location", label: "Headquarters / location", kind: "text", required: true },
      {
        name: "why_company",
        label: "Why this company",
        kind: "textarea",
        required: true,
        help: "Two or three sentences.",
      },
    ],
  },
  research_brief: {
    key: "research_brief",
    intro: "Summarise what you found, and say where the full research sits in your vault.",
    fields: [
      { name: "company_findings", label: "Company findings", kind: "textarea", required: true },
      { name: "industry_findings", label: "Industry findings", kind: "textarea", required: true },
      { name: "sources", label: "Sources used", kind: "textarea", required: true },
      {
        name: "vault_location",
        label: "Where in the vault the research is filed",
        kind: "text",
        required: true,
        placeholder: "Semester Long Project / Client research",
      },
    ],
  },
  interview_plan: {
    key: "interview_plan",
    intro: "Every member writes questions; the compiled final set is what you interview with.",
    fields: [
      {
        name: "members_submitted",
        label: "Members who have filed their questions",
        kind: "textarea",
        required: true,
      },
      { name: "compiled_location", label: "Where the compiled set is filed", kind: "text", required: true },
      { name: "top_questions", label: "Your five strongest questions", kind: "textarea", required: true },
      { name: "interview_plan", label: "Who asks what, and when the interview happens", kind: "textarea", required: true },
    ],
  },
  video_plan: {
    key: "video_plan",
    intro: "Your plan for the video: what you will shoot, who does what, and when.",
    fields: [
      { name: "concept", label: "Video concept", kind: "textarea", required: true },
      { name: "broll_plan", label: "B-roll you will capture", kind: "textarea", required: true },
      { name: "roles", label: "Who is responsible for filming, editing and transcript", kind: "textarea", required: true },
      { name: "timeline", label: "Timeline to final submission", kind: "textarea", required: true },
    ],
  },
  reflection: {
    key: "reflection",
    intro: "End-of-semester reflection and peer review.",
    fields: [
      { name: "went_well", label: "What went well", kind: "textarea", required: true },
      { name: "would_change", label: "What you would do differently", kind: "textarea", required: true },
      { name: "peer_review", label: "Peer review: contribution of each member", kind: "textarea", required: true },
    ],
  },
};

export function moduleForm(key: string): ModuleForm | undefined {
  return MODULE_FORMS[key];
}

export function missingRequired(key: string, answers: Record<string, string>) {
  const form = moduleForm(key);
  if (!form) return [];
  return form.fields
    .filter((f) => f.required && !(answers[f.name] ?? "").trim())
    .map((f) => f.label);
}
