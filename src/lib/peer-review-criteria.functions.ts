import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
import { validReminderMonthDay } from './peer-review-criteria';

export const getPeerReviewCriteria = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const role = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' });
    if (role.error || !role.data) throw new Error('Admin access required');
    const { data, error } = await context.supabase.from('peer_review_criteria').select('*').eq('id', 'peer-review').single();
    if (error) throw error;
    return data;
  });

export const savePeerReviewCriteria = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    content: z.string().trim().min(1).max(100000),
    reminder_month_day: z.string().refine(validReminderMonthDay, 'Enter a valid month and day'),
    expected_updated_at: z.string(),
    markReviewed: z.boolean(),
  }))
  .handler(async ({ context, data }) => {
    const role = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' });
    if (role.error || !role.data) throw new Error('Admin access required');
    const now = new Date();
    const year = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Detroit', year: 'numeric' }).format(now));
    const { data: saved, error } = await context.supabase.from('peer_review_criteria').update({
      content: data.content,
      reminder_month_day: data.reminder_month_day,
      updated_at: now.toISOString(),
      updated_by: context.userId,
      // Any ordinary edit requires a fresh acknowledgement before evaluation.
      reviewed_year: data.markReviewed ? year : null,
      reviewed_at: data.markReviewed ? now.toISOString() : null,
    }).eq('id', 'peer-review').eq('updated_at', data.expected_updated_at).select('*').maybeSingle();
    if (error) throw error;
    if (!saved) throw new Error('This document changed elsewhere. Reload before saving to avoid overwriting those edits.');
    return saved;
  });