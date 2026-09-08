import { MAX_SKILLS_HAVE, MAX_SKILLS_LEARN } from "@/lib/student-skills";

/** Sleep is assumed midnight–8am, so the realistic week is 16 hours × 7 days. */
export const WAKING_HOURS_PER_WEEK = 112;
/** A 15-credit load is roughly 30 hours of class time. */
export const TYPICAL_CLASS_HOURS = 30;
/** A part-time job adds about 15 hours. */
export const TYPICAL_WORK_HOURS = 15;
export const TYPICAL_BLOCKED_HOURS = TYPICAL_CLASS_HOURS + TYPICAL_WORK_HOURS;

const WAKING_START_MINUTES = 8 * 60;

export const AVAILABILITY_GUIDANCE =
  "Only block time you absolutely cannot meet — class periods, regularly scheduled work shifts and athletic practices. Leave as much time open as possible so your team can actually find a slot that works for everyone.";

function slotMinutes(key: string) {
  return Number(key.split("-")[1] ?? 0);
}

export type BlockSummary = {
  blockedHours: number;
  wakingBlockedHours: number;
  openHours: number;
  overBlocked: boolean;
};

/** Turn busy half-hour slots into a plain-English weekly time budget. */
export function summarizeBlocks(slots: string[]): BlockSummary {
  const blockedHours = slots.length * 0.5;
  const wakingBlockedHours =
    slots.filter((key) => slotMinutes(key) >= WAKING_START_MINUTES).length * 0.5;
  const openHours = Math.max(0, WAKING_HOURS_PER_WEEK - wakingBlockedHours);
  return {
    blockedHours,
    wakingBlockedHours,
    openHours,
    overBlocked: wakingBlockedHours > TYPICAL_BLOCKED_HOURS,
  };
}

export type CompletionInput = {
  skillsHave: string[] | null | undefined;
  skillsLearn: string[] | null | undefined;
  hasAvailability: boolean;
};

export type CompletionStatus = {
  skillsHaveCount: number;
  skillsLearnCount: number;
  skillsHaveDone: boolean;
  skillsLearnDone: boolean;
  availabilityDone: boolean;
  complete: boolean;
  missing: string[];
};

export function completionStatus(input: CompletionInput): CompletionStatus {
  const skillsHaveCount = (input.skillsHave ?? []).length;
  const skillsLearnCount = (input.skillsLearn ?? []).length;
  const skillsHaveDone = skillsHaveCount >= MAX_SKILLS_HAVE;
  const skillsLearnDone = skillsLearnCount >= MAX_SKILLS_LEARN;
  const availabilityDone = input.hasAvailability;

  const missing: string[] = [];
  if (!skillsHaveDone) missing.push(`${MAX_SKILLS_HAVE} skills you have`);
  if (!skillsLearnDone) missing.push(`${MAX_SKILLS_LEARN} skills you want to learn`);
  if (!availabilityDone) missing.push("your weekly availability");

  return {
    skillsHaveCount,
    skillsLearnCount,
    skillsHaveDone,
    skillsLearnDone,
    availabilityDone,
    complete: missing.length === 0,
    missing,
  };
}
