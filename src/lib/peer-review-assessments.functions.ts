import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';

export const listPeerReviewAssessments = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth]).handler(async ({ context }) => {
    const { data: admin, error: roleError } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' });
    if (roleError || !admin) throw new Error('Admin access required');
    const { data, error } = await context.supabase.from('peer_review_assessments').select('*, profiles!peer_review_assessments_user_id_fkey(name, email), teams(display_name, section)').order('created_at');
    if (error) throw error;
    return data;
  });

/** One assessment event, one derived recipient; no arbitrary addresses or bulk sends. */
export const sendPeerReviewAssessment = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), copy: z.enum(['student', 'instructor', 'pm']) }))
  .handler(async ({ context, data }) => {
    const { data: admin, error: roleError } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' });
    if (roleError || !admin) throw new Error('Admin access required');
    const { data: assessment, error } = await context.supabase.from('peer_review_assessments').select('*').eq('id', data.id).single();
    if (error) throw error;
    const column = data.copy === 'student' ? 'student_email_status' : data.copy === 'instructor' ? 'instructor_email_status' : 'pm_email_status';
    if (assessment[column] === 'sent' || assessment[column] === 'suppressed' || assessment[column] === 'same_as_student') return { status: assessment[column] };
    const { data: student, error: studentError } = await context.supabase.from('profiles').select('name,email').eq('id', assessment.user_id).single();
    if (studentError) throw studentError;
    const { data: team, error: teamError } = await context.supabase.from('teams').select('is_test').eq('id', assessment.team_id).single();
    if (teamError || team?.is_test || /parfunkel/i.test(student.name)) throw new Error('Excluded test recipient');
    let recipient = student.email;
    if (data.copy === 'instructor') recipient = 'hillmanp@gvsu.edu';
    if (data.copy === 'pm') {
      const { data: pm, error: pmError } = await context.supabase.from('team_members').select('user_id').eq('team_id', assessment.team_id).eq('job_title', 'PM').maybeSingle();
      if (pmError) throw pmError;
      if (!pm) throw new Error('Team Project Manager not found');
      if (pm.user_id === assessment.user_id) {
        if (assessment.student_email_status !== 'sent') throw new Error('Send student analysis first');
        const { error: saveError } = await context.supabase.from('peer_review_assessments').update({ pm_email_status: 'same_as_student' }).eq('id', data.id);
        if (saveError) throw saveError;
        return { status: 'same_as_student' };
      }
      const { data: pmProfile, error: pmProfileError } = await context.supabase.from('profiles').select('email').eq('id', pm.user_id).single();
      if (pmProfileError) throw pmProfileError;
      recipient = pmProfile.email;
    }
    if (!recipient) throw new Error('Recipient email missing');
    const { sendTemplateEmail } = await import('./email-templates/send-email');
    const subject = assessment.status === 'missing' ? `Peer review due Sunday — ${student.name}` : assessment.score === null ? `Peer-review reading check — ${student.name}` : `Your peer-review analysis — ${student.name} — ${assessment.score}/10`;
    const result = await sendTemplateEmail('peer-review-analysis', recipient, { templateData: { name: student.name, body: assessment.email_body, subject: data.copy === 'student' ? subject : `Copy: ${subject}` }, replyTo: 'hillmanp@gvsu.edu', idempotencyKey: `peer-analysis-${assessment.id}-${data.copy}-${recipient.toLowerCase()}` });
    const status = result.sent ? 'sent' : 'suppressed';
    const update = data.copy === 'student' ? { student_email_status: status } : data.copy === 'instructor' ? { instructor_email_status: status } : { pm_email_status: status };
    const { error: saveError } = await context.supabase.from('peer_review_assessments').update(update).eq('id', data.id);
    if (saveError) throw saveError;
    return { status };
  });