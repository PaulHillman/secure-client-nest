import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
import { RULES_ROW_ID, RULE_FIELDS, resolveHealthReviewRules } from './health-review-rules';

export type GuideImpact = {
  verdict: 'no_rule_change' | 'settings_change' | 'needs_code_change' | 'conflict';
  summary: string;
  settings_to_change: { setting: string; current: string; suggested: string }[];
  positives: string[];
  negatives: string[];
  other_checks_affected: string[];
};

const schema = {
  type: 'object', additionalProperties: false,
  required: ['verdict', 'summary', 'settings_to_change', 'positives', 'negatives', 'other_checks_affected'],
  properties: {
    verdict: { type: 'string', enum: ['no_rule_change', 'settings_change', 'needs_code_change', 'conflict'] },
    summary: { type: 'string' },
    settings_to_change: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['setting', 'current', 'suggested'], properties: { setting: { type: 'string' }, current: { type: 'string' }, suggested: { type: 'string' } } } },
    positives: { type: 'array', items: { type: 'string' } },
    negatives: { type: 'array', items: { type: 'string' } },
    other_checks_affected: { type: 'array', items: { type: 'string' } },
  },
};

/** Reviews an edit to the prose guide against the live settings. Advisory only: never changes settings. */
export const reviewHealthGuideChange = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ before: z.string().max(100000), after: z.string().max(100000) }))
  .handler(async ({ context, data }): Promise<GuideImpact> => {
    const role = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' });
    if (role.error || !role.data) throw new Error('Admin access required');
    const { data: row } = await context.supabase.from('health_review_rules').select('*').eq('id', RULES_ROW_ID).maybeSingle();
    const rules = resolveHealthReviewRules(row);
    const settings = RULE_FIELDS.map((f) => `- ${f.label} [${f.key}] = ${(rules as Record<string, unknown>)[f.key]}`).join('\n') + '\n- Fixed weekly peer-review presentation: short latest-valid-submission score and next step only; no repeated strengths, concerns or detailed fixes. Revisions need 8+, originals 7+ pass, instructor decisions are honored. Require revision or booking by Nov 1 at 11:59 p.m. Detroit, meeting by Nov 8 at 11:59 p.m.; identify missing required bookings after submission 3, and recognize verified peer-review bookings (not unrelated appointments). This presentation is already implemented and does not depend on prose edits.';
    const apiKey = process.env['LOVABLE_API_KEY'];
    if (!apiKey) throw new Error('AI key missing');
    const res = await fetch('https://ai.gateway.lovable.dev/v1/responses', {
      method: 'POST',
      headers: { 'Lovable-API-Key': apiKey, Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'X-Lovable-AIG-SDK': 'fetch' },
      body: JSON.stringify({
        model: 'openai/gpt-6-astra', store: false, reasoning: { effort: 'medium' },
        instructions: `An instructor edited the written description of a weekly student-team health review. The written document does NOT drive the review; only the editable settings below do, plus fixed checks in code (dashboard gaps, team readiness, meeting logs/minutes/absence reasons, agenda-minutes connections as no-penalty reminders, login/upload activity, low engagement escalation, research file count and topic coverage, client communications, semester milestone percentages, peer-review deadlines which are fixed, repeat-warning escalation). Compare BEFORE and AFTER. Decide: no_rule_change (wording only, or already matches settings), settings_change (achievable by changing listed settings — name each with current and suggested value), needs_code_change (a new or different check that settings cannot express), or conflict (contradicts settings or other rules). Give concrete positive and negative effects, and name other checks that would be affected (e.g. tighter meeting limit raises low-engagement and escalation counts). Plain language for a non-technical instructor; be specific and brief. Never claim anything was changed.\n\nCURRENT SETTINGS:\n${settings}`,
        input: [{ role: 'user', content: `BEFORE:\n${data.before.slice(0, 40000)}\n\nAFTER:\n${data.after.slice(0, 40000)}` }],
        text: { format: { type: 'json_schema', name: 'guide_impact', strict: true, schema } },
      }),
    });
    if (res.status === 429) throw new Error('The review assistant is busy. Try "Check again" in a minute.');
    if (res.status === 402) throw new Error('AI credits are used up, so the change could not be checked.');
    if (!res.ok) throw new Error(`Change check failed (${res.status}).`);
    const json = await res.json() as { output_text?: string; output?: { content?: { type: string; text?: string }[] }[] };
    const text = json.output_text ?? (json.output ?? []).flatMap((o) => o.content ?? []).filter((c) => c.type === 'output_text').map((c) => c.text).join('');
    return JSON.parse(text) as GuideImpact;
  });
