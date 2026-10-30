import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
import { operationalSchema, resolveOperationalRules } from './review-rulebook';
import { RULES_ROW_ID, RULE_FIELDS, resolveHealthReviewRules } from './health-review-rules';

const input = z.object({ operational: operationalSchema, thresholds: z.record(z.union([z.number(), z.string()])), expectedUpdatedAt: z.string() });
export function validateRulebook(values: z.infer<typeof input>) {
  for (const [key, raw] of Object.entries(values.thresholds)) {
    const field = RULE_FIELDS.find(f => f.key === key);
    if (!field) throw new Error('Unknown rule setting.');
    if (field.kind === 'date') {
      if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw) || !Number.isFinite(Date.parse(raw))) throw new Error(`Invalid date: ${field.label}`);
    } else if (!Number.isFinite(Number(raw)) || Number(raw) < field.min || Number(raw) > field.max || !Number.isInteger(Number(raw))) throw new Error(`Invalid value: ${field.label}`);
  }
  const thresholds = resolveHealthReviewRules(values.thresholds);
  if (thresholds.minutes_min_markers > values.operational.minutes_markers.length) throw new Error('The required minutes-section count exceeds the number of section labels.');
  return thresholds;
}
export const getReviewRulebook = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const role = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' });
  if (role.error || !role.data) throw new Error('Admin access required');
  const [row, history, teams] = await Promise.all([
    context.supabase.from('health_review_rules').select('*').eq('id', RULES_ROW_ID).single(),
    context.supabase.from('review_rule_history').select('*').order('effective_at', { ascending: false }).limit(20),
    context.supabase.from('teams').select('id,name,display_name,section').eq('is_test', false).order('section'),
  ]);
  // Actor IDs are plain UUIDs; resolve names without assuming a foreign key.
  if (row.error) throw row.error;
  const audit = history;
  if (audit.error || teams.error) throw new Error('Could not load rule history or teams');
  const profiles = await context.supabase.from('profiles').select('id,name');
  if (profiles.error) throw profiles.error;
  return { operational: resolveOperationalRules(row.data.operational_rules), thresholds: resolveHealthReviewRules(row.data), updatedAt: row.data.updated_at, history: (audit.data ?? []).map(h => ({ ...h, actorName: profiles.data.find(p => p.id === h.actor_id)?.name ?? 'Instructor' })), teams: teams.data ?? [] };
});
export const saveReviewRulebook = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(input).handler(async ({ context, data }) => {
  const role = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' });
  if (role.error || !role.data) throw new Error('Admin access required');
  const thresholds = validateRulebook(data);
  const { data: row, error } = await context.supabase.from('health_review_rules').update({ ...thresholds, operational_rules: data.operational, updated_by: context.userId }).eq('id', RULES_ROW_ID).eq('updated_at', data.expectedUpdatedAt).select('updated_at').maybeSingle();
  if (error) throw error;
  if (!row) throw new Error('Rules changed in another window. Reload before applying your changes.');
  return { updatedAt: row.updated_at };
});