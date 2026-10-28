import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
import { discussionOutcome, discussionScore } from './peer-review-discussion';

export const getPeerWorkspace = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data: admin, error: roleError } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' });
  if (roleError || !admin) throw new Error('Admin access required');
  const db = context.supabase;
  const [assessments, meetings, permissions] = await Promise.all([
    db.from('peer_review_assessments').select('*, profiles!peer_review_assessments_user_id_fkey(name,email), teams!inner(name,display_name,section,is_test), file_versions(id,storage_path,mime_type,uploaded_at), files(file_name)').eq('teams.is_test', false).neq('status', 'ownership_invalid').order('attempt'),
    db.from('peer_review_meetings').select('*, profiles!peer_review_meetings_student_id_fkey(name,email), teams!inner(name,display_name,section,is_test)').eq('teams.is_test', false).order('scheduled_at'),
    db.from('peer_review_final_uploads').select('*'),
  ]);
  for (const result of [assessments, meetings, permissions]) if (result.error) throw result.error;
  return { assessments: (assessments.data ?? []).filter(a => !/parfunkel/i.test(a.profiles?.name ?? '')), meetings: (meetings.data ?? []).filter(m => !/parfunkel/i.test(m.profiles?.name ?? '')), permissions: permissions.data ?? [] };
});

export const authorizeFinalPeerUpload = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ studentId: z.string().uuid(), teamId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { data: admin, error: roleError } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' });
    if (roleError || !admin) throw new Error('Admin access required');
    const { data: latest, error: latestError } = await context.supabase.from('peer_review_assessments').select('score').eq('user_id', data.studentId).eq('team_id', data.teamId).eq('status', 'assessed').order('attempt', { ascending: false }).limit(1).maybeSingle();
    if (latestError || latest?.score == null || latest.score >= 8) throw new Error('A saved peer review below 8/10 is required');
    const { data: existing, error: readError } = await context.supabase.from('peer_review_final_uploads').select('*').eq('student_id', data.studentId).eq('team_id', data.teamId).maybeSingle();
    if (readError) throw readError;
    if (existing) { if (existing.consumed_at) throw new Error('The final upload has already been used'); return existing; }
    const { data: permission, error } = await context.supabase.from('peer_review_final_uploads').insert({ student_id: data.studentId, team_id: data.teamId, authorized_by: context.userId }).select().single();
    if (error) throw error;
    return permission;
  });

export const syncPeerMeetings = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data: admin, error: roleError } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' });
  if (roleError || !admin) throw new Error('Admin access required');
  const { syncCalendlyPeerMeetings } = await import('./peer-review-calendar.server');
  return syncCalendlyPeerMeetings(context.supabase);
});

export const acceptPeerAfterDiscussion = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ assessmentId: z.string().uuid(), accept: z.boolean(), note: z.string().max(500).optional() }))
  .handler(async ({ context, data }) => {
    const { data: admin, error: roleError } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' });
    if (roleError || !admin) throw new Error('Admin access required');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: a, error } = await supabaseAdmin.from('peer_review_assessments').select('*').eq('id', data.assessmentId).single();
    if (error || !a || a.status !== 'assessed') throw new Error('Only a scored submission can be accepted');
    const { data: newer } = await supabaseAdmin.from('peer_review_assessments').select('id').eq('user_id', a.user_id).eq('team_id', a.team_id).eq('status', 'assessed').gt('attempt', a.attempt).limit(1);
    if (data.accept && newer?.length) throw new Error('Only the latest submission can be accepted');
    if (data.accept && a.discussion_deduction < 0 && !discussionOutcome(discussionScore(a), a.discussion_min_score, a.discussion_deduction).canAccept) throw new Error('This final submission must meet the instructor-set threshold before acceptance');
    const patch = data.accept ? { accepted_at: new Date().toISOString(), accepted_by: context.userId, accepted_note: data.note ?? null } : { accepted_at: null, accepted_by: null, accepted_note: null };
    const { error: upErr } = await supabaseAdmin.from('peer_review_assessments').update(patch).eq('id', a.id);
    if (upErr) throw upErr;
    if (data.accept) { const { onPeerAccepted } = await import('./peer-review-accept.server'); return { ok: true, followUp: await onPeerAccepted(supabaseAdmin, a.id) }; }
    return { ok: true };
  });

export const savePeerDiscussion = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ assessmentId: z.string().uuid(), held: z.boolean(), note: z.string().max(2000), decision: z.enum(['note', 'accept', 'deduct', 'reopen']) }))
  .handler(async ({ context, data }) => {
    const { data: admin, error: roleError } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' });
    if (roleError || !admin) throw new Error('Admin access required');
    const db = context.supabase;
    const { data: a, error } = await db.from('peer_review_assessments').select('*').eq('id', data.assessmentId).single();
    if (error || !a) throw new Error('Submission not found');
    const { data: newer, error: newerError } = await db.from('peer_review_assessments').select('id').eq('user_id', a.user_id).eq('team_id', a.team_id).neq('status', 'ownership_invalid').gt('attempt', a.attempt).limit(1);
    if (newerError) throw newerError;
    if (newer?.length && data.decision !== 'note') throw new Error('Review the latest submission before saving a decision');
    if (data.decision !== 'note' && data.decision !== 'reopen' && (!data.held || a.status !== 'assessed')) throw new Error('Confirm the meeting and review a scored submission first');
    const outcome = discussionOutcome(discussionScore(a), a.discussion_min_score, a.discussion_deduction);
    if (data.decision === 'accept' && a.discussion_deduction < 0 && !outcome.canAccept) throw new Error('The final submission is below the instructor-set acceptance threshold');
    if (data.decision === 'deduct' && !outcome.canDeduct) throw new Error('A deduction is not permitted for this score');
    if (data.decision === 'deduct' && !a.detailed_regrade) throw new Error('Run the detailed re-grade before recording the final deduction');
    if ((data.decision === 'deduct' || data.decision === 'accept') && !data.note.trim()) throw new Error('Enter a decision comment');
    const now = new Date().toISOString();
    const patch = { discussion_held_at: data.held ? a.discussion_held_at ?? now : null, discussion_note: data.note.trim(),
      ...(data.decision === 'accept' ? { accepted_at: now, accepted_by: context.userId, accepted_note: data.note.trim(), discussion_resolved_at: now, final_points_adjustment: 0 } : {}),
      ...(data.decision === 'deduct' ? { accepted_at: null, accepted_by: null, accepted_note: null, discussion_resolved_at: now, final_points_adjustment: outcome.adjustment } : {}),
      ...(data.decision === 'reopen' ? { accepted_at: null, accepted_by: null, accepted_note: null, discussion_resolved_at: null, final_points_adjustment: 0 } : {}) };
    const { error: updateError } = await db.from('peer_review_assessments').update(patch).eq('id', a.id);
    if (updateError) throw updateError;
    if (data.decision === 'accept') {
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
      const { onPeerAccepted } = await import('./peer-review-accept.server');
      return { ok: true, followUp: await onPeerAccepted(supabaseAdmin, a.id) };
    }
    return { ok: true };
  });

export const regradePeerAfterDiscussion = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ assessmentId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { data: admin, error: roleError } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' });
    if (roleError || !admin) throw new Error('Admin access required');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { regradePeerAssessment } = await import('./peer-review-regrade.server');
    return regradePeerAssessment(supabaseAdmin, data.assessmentId, context.userId);
  });

export const comparePeerVersions = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ before: z.string().uuid(), after: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { data: admin, error: roleError } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' });
    if (roleError || !admin) throw new Error('Admin access required');
    const { data: rows, error } = await context.supabase.from('peer_review_assessments').select('user_id,team_id,version_id').in('version_id', [data.before, data.after]).eq('status', 'assessed');
    if (error || rows?.length !== 2 || rows[0].user_id !== rows[1].user_id || rows[0].team_id !== rows[1].team_id) throw new Error('Choose two assessed submissions by the same student');
    const { extractPeerText } = await import('./peer-review-text.server');
    const read = async (id: string) => {
      const { data: v, error: ve } = await context.supabase.from('file_versions').select('storage_path,file_size').eq('id', id).single();
      if (ve || !v || (v.file_size ?? 0) > 50_000_000) return null;
      const { data: blob } = await context.supabase.storage.from('vault').download(v.storage_path);
      return blob ? extractPeerText(blob, v.storage_path) : null;
    };
    const [before, after] = await Promise.all([read(data.before), read(data.after)]);
    return { before, after };
  });