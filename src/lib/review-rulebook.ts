import { z } from 'zod';

const sunday = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
  const d = new Date(`${v}T12:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v && d.getUTCDay() === 0;
}, 'Choose a Sunday; deadlines are 11:59 p.m. Detroit time.');
const labels = z.array(z.string().trim().min(1).max(120)).min(1).max(20).refine(v => new Set(v.map(s => s.toLowerCase())).size === v.length, 'Remove duplicate sections.');
export const operationalSchema = z.object({
  original_pass: z.number().int().min(1).max(10),
  revision_pass: z.number().int().min(1).max(10),
  max_submissions: z.number().int().min(2).max(6),
  original_due: sunday, revision_due: sunday, meeting_due: sunday,
  final_pass: z.number().min(0).max(10).multipleOf(0.1),
  final_deduction: z.number().int().min(-100).max(0),
  summary_mode: z.enum(['brief', 'with_fixes']),
  summary_fixes: z.number().int().min(1).max(3),
  missing_meeting_warning: z.boolean(),
  research_topics: z.array(z.object({ topic: z.string().trim().min(1).max(120), keywords: labels })).min(1).max(12),
  minutes_markers: labels,
}).strict().superRefine((v, ctx) => {
  if (v.original_due > v.revision_due || v.revision_due > v.meeting_due) ctx.addIssue({ code: 'custom', message: 'Original, revision and meeting deadlines must be in chronological order.' });
  if (v.revision_pass < v.original_pass) ctx.addIssue({ code: 'custom', message: 'The revision target cannot be below the original passing score.' });
  if (v.final_pass > v.revision_pass) ctx.addIssue({ code: 'custom', message: 'The final-discussion threshold cannot exceed the revision target.' });
});
export type OperationalRules = z.infer<typeof operationalSchema>;
export const OPERATIONAL_DEFAULTS: OperationalRules = {
  original_pass: 7, revision_pass: 8, max_submissions: 3,
  original_due: '2026-10-25', revision_due: '2026-11-01', meeting_due: '2026-11-08',
  final_pass: 7.6, final_deduction: -10, summary_mode: 'brief', summary_fixes: 3, missing_meeting_warning: true,
  research_topics: [
    { topic: 'Company history/information', keywords: ['company history', 'history of', 'founded', 'established', 'company overview', 'company profile'] },
    { topic: 'Industry information', keywords: ['industry', 'sector', 'market trends'] },
    { topic: 'Competitors', keywords: ['competitor', 'competitors', 'competition', 'competitive landscape'] },
    { topic: 'Client job description', keywords: ['job description', 'job responsibilities', 'duties', 'responsibilities of', 'client role'] },
  ],
  minutes_markers: ['project manager', 'notetaker', 'missing attendees', 'arriving late', 'agenda topics', 'discussion', 'conclusions'],
};
export function resolveOperationalRules(raw: unknown): OperationalRules {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return structuredClone(OPERATIONAL_DEFAULTS);
  const result = operationalSchema.safeParse({ ...OPERATIONAL_DEFAULTS, ...raw });
  return result.success ? result.data : structuredClone(OPERATIONAL_DEFAULTS);
}
/** UTC conversion follows Detroit's actual offset, including DST, not the server timezone. */
export function detroitDeadline(day: string): string {
  let ms = Date.parse(`${day}T23:59:59Z`);
  const format = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Detroit', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  const target = ms;
  for (let i = 0; i < 3; i++) {
    const p = Object.fromEntries(format.formatToParts(new Date(ms)).map(p => [p.type, p.value]));
    const local = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);
    ms += target - local;
  }
  return new Date(ms).toISOString();
}
export function deadlineLabel(day: string, long = false) {
  return `${new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'America/Detroit', ...(long ? { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric' }) })}, 11:59 p.m.`;
}
export function rulebookEffects(before: OperationalRules, after: OperationalRules): string[] {
  const changed = (keys: (keyof OperationalRules)[]) => keys.some(k => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
  const effects: string[] = [];
  if (changed(['original_pass', 'revision_pass'])) effects.push('Future assessment completion, badges, student emails and weekly next steps use the new passing targets. Existing assessments retain their saved policy and scores.');
  if (changed(['max_submissions'])) effects.push('New upload eligibility and required-meeting timing change. Existing documents, attempts and one-use final permissions remain retained.');
  if (changed(['original_due', 'revision_due', 'meeting_due'])) effects.push('Future assessment deadlines, email instructions and overdue badges change together. Previously sent emails are not rewritten.');
  if (changed(['final_pass', 'final_deduction'])) effects.push('Future final assessments use the new discussion threshold and personal-point adjustment. Existing decisions and instructor overrides are preserved.');
  if (changed(['summary_mode', 'summary_fixes', 'missing_meeting_warning'])) effects.push('Future weekly summaries change in length or meeting reminders; individual detailed feedback stays separate.');
  if (changed(['research_topics'])) effects.push('Future research coverage checks use these topics and evidence phrases. Changed requirements are not student-earned fixes.');
  if (changed(['minutes_markers'])) effects.push('Future minutes checks use these section labels. Keep the required-section count no higher than the number of labels.');
  return effects;
}