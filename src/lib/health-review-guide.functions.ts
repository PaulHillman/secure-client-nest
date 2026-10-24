import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';

const DOC_ID = 'health-review';

export const getHealthReviewGuide = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const role = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' });
    if (role.error || !role.data) throw new Error('Admin access required');
    const { data, error } = await context.supabase.from('peer_review_criteria').select('*').eq('id', DOC_ID).single();
    if (error) throw error;
    return data;
  });

export const saveHealthReviewGuide = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    content: z.string().trim().min(1).max(100000),
    expected_updated_at: z.string(),
    markReviewed: z.boolean(),
  }))
  .handler(async ({ context, data }) => {
    const role = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' });
    if (role.error || !role.data) throw new Error('Admin access required');
    const now = new Date().toISOString();
    const patch: { content: string; updated_at: string; updated_by: string; reviewed_at?: string } = {
      content: data.content, updated_at: now, updated_by: context.userId,
    };
    if (data.markReviewed) patch.reviewed_at = now;
    const { data: saved, error } = await context.supabase.from('peer_review_criteria').update(patch)
      .eq('id', DOC_ID).eq('updated_at', data.expected_updated_at).select('*').maybeSingle();
    if (error) throw error;
    if (!saved) throw new Error('This document changed elsewhere. Reload before saving to avoid overwriting those edits.');
    return saved;
  });
