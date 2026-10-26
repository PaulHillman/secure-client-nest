import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';

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