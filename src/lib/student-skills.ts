export const MAX_SKILLS_HAVE = 8;
export const MAX_SKILLS_LEARN = 5;
export const MAX_TOP_SKILLS = 3;

export type SkillCategory =
  | "Leadership & teamwork"
  | "Client & communication"
  | "Research & analysis"
  | "Creative & media"
  | "Technology & organization";

export type StudentSkill = {
  id: string;
  label: string;
  category: SkillCategory;
};

export const SKILL_CATEGORIES: SkillCategory[] = [
  "Leadership & teamwork",
  "Client & communication",
  "Research & analysis",
  "Creative & media",
  "Technology & organization",
];

export const STUDENT_SKILLS: StudentSkill[] = [
  { id: "project-management", label: "Project management", category: "Leadership & teamwork" },
  {
    id: "meeting-facilitation",
    label: "Running effective meetings",
    category: "Leadership & teamwork",
  },
  { id: "task-organization", label: "Organizing tasks", category: "Leadership & teamwork" },
  { id: "time-management", label: "Time management", category: "Leadership & teamwork" },
  { id: "leadership", label: "Team leadership", category: "Leadership & teamwork" },
  { id: "conflict-resolution", label: "Conflict resolution", category: "Leadership & teamwork" },
  { id: "follow-through", label: "Reliable follow-through", category: "Leadership & teamwork" },
  { id: "consensus-building", label: "Consensus building", category: "Leadership & teamwork" },

  { id: "client-communication", label: "Client communication", category: "Client & communication" },
  {
    id: "initial-meetings",
    label: "Leading initial client meetings",
    category: "Client & communication",
  },
  {
    id: "team-representation",
    label: "Representing the team professionally",
    category: "Client & communication",
  },
  { id: "active-listening", label: "Active listening", category: "Client & communication" },
  { id: "interviewing", label: "Interviewing", category: "Client & communication" },
  { id: "professional-writing", label: "Professional writing", category: "Client & communication" },
  { id: "editing", label: "Editing and proofreading", category: "Client & communication" },
  { id: "public-speaking", label: "Public speaking", category: "Client & communication" },
  {
    id: "presentation-development",
    label: "Presentation development",
    category: "Client & communication",
  },
  { id: "storytelling", label: "Business storytelling", category: "Client & communication" },

  { id: "online-research", label: "Online research", category: "Research & analysis" },
  { id: "survey-design", label: "Survey design", category: "Research & analysis" },
  { id: "data-analysis", label: "Data analysis", category: "Research & analysis" },
  { id: "financial-analysis", label: "Financial analysis", category: "Research & analysis" },
  { id: "process-mapping", label: "Process mapping", category: "Research & analysis" },
  { id: "critical-thinking", label: "Critical thinking", category: "Research & analysis" },
  {
    id: "market-analysis",
    label: "Market and competitor analysis",
    category: "Research & analysis",
  },

  { id: "creativity", label: "Creative ideation", category: "Creative & media" },
  { id: "video-production", label: "Video production", category: "Creative & media" },
  { id: "video-editing", label: "Video editing", category: "Creative & media" },
  { id: "photography", label: "Photography", category: "Creative & media" },
  { id: "graphic-design", label: "Graphic design", category: "Creative & media" },
  { id: "canva", label: "Canva", category: "Creative & media" },
  { id: "audio-production", label: "Audio recording and editing", category: "Creative & media" },
  { id: "social-media", label: "Social media", category: "Creative & media" },

  { id: "excel", label: "Excel or Google Sheets", category: "Technology & organization" },
  { id: "powerpoint", label: "PowerPoint or Google Slides", category: "Technology & organization" },
  { id: "ai-tools", label: "Artificial intelligence tools", category: "Technology & organization" },
  {
    id: "file-organization",
    label: "File and version organization",
    category: "Technology & organization",
  },
  {
    id: "password-troubleshooting",
    label: "Password and account troubleshooting",
    category: "Technology & organization",
  },
  {
    id: "technical-troubleshooting",
    label: "Technical troubleshooting",
    category: "Technology & organization",
  },
  { id: "web-development", label: "Website development", category: "Technology & organization" },
  { id: "automation", label: "Workflow automation", category: "Technology & organization" },
  { id: "cybersecurity", label: "Cybersecurity awareness", category: "Technology & organization" },
  { id: "database-tools", label: "Database or CRM tools", category: "Technology & organization" },
];

export const ROLE_SKILL_MAP: Record<string, { description: string; skills: string[] }> = {
  PM: {
    description:
      "Keeps the team organized, runs productive meetings, and helps commitments get finished.",
    skills: [
      "project-management",
      "meeting-facilitation",
      "task-organization",
      "time-management",
      "follow-through",
      "conflict-resolution",
      "consensus-building",
      "leadership",
    ],
  },
  "Company Liaison": {
    description:
      "Leads early client conversations and represents the team with confidence and good judgment.",
    skills: [
      "client-communication",
      "initial-meetings",
      "team-representation",
      "active-listening",
      "interviewing",
      "public-speaking",
      "professional-writing",
    ],
  },
  "Video Specialist": {
    description:
      "Brings a creative eye and enough video experience to shape, capture, and edit the team's story.",
    skills: [
      "video-production",
      "video-editing",
      "creativity",
      "storytelling",
      "photography",
      "graphic-design",
      "audio-production",
    ],
  },
  "Client Vault & Tech Administrator": {
    description:
      "Stays calm around passwords, permissions, files, and unfamiliar technology—and helps teammates do the same.",
    skills: [
      "password-troubleshooting",
      "technical-troubleshooting",
      "file-organization",
      "cybersecurity",
      "ai-tools",
      "web-development",
      "automation",
      "database-tools",
    ],
  },
  "Communication Specialist": {
    description: "Turns the team's thinking into clear, polished writing and presentations.",
    skills: [
      "professional-writing",
      "editing",
      "presentation-development",
      "powerpoint",
      "canva",
      "storytelling",
      "public-speaking",
      "graphic-design",
    ],
  },
};

const LABEL_BY_ID = new Map(STUDENT_SKILLS.map((skill) => [skill.id, skill.label]));

export function skillLabel(id: string) {
  return LABEL_BY_ID.get(id) ?? id.replace(/^custom:/, "");
}

export function roleMatches(skills: string[], topSkills: string[]) {
  const top = new Set(topSkills);
  return Object.entries(ROLE_SKILL_MAP)
    .map(([role, config]) => {
      const matches = config.skills.filter((skill) => skills.includes(skill));
      const score = matches.reduce((total, skill) => total + (top.has(skill) ? 2 : 1), 0);
      return { role, ...config, matches, score };
    })
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score || a.role.localeCompare(b.role));
}
