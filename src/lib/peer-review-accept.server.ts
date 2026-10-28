import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

const INSTRUCTOR_EMAIL = 'hillmanp@gvsu.edu';

/**
 * After a peer review is accepted: cancel the student's upcoming Calendly
 * peer-review meetings and email the student (copies to instructor and PM)
 * that they are done. Idempotent per assessment and recipient.
 */
export async function onPeerAccepted(db: SupabaseClient<Database>, assessmentId: string) {
  const { data: a, error } = await db.from('peer_review_assessments').select('id,user_id,team_id,score,detailed_regrade,accepted_at').eq('id', assessmentId).single();
  if (error || !a?.accepted_at) return { sent: 0, canceled: 0 };
  const { data: student } = await db.from('profiles').select('name,email').eq('id', a.user_id).single();
  if (!student || /parfunkel/i.test(student.name)) return { sent: 0, canceled: 0 };
  const { data: team } = await db.from('teams').select('is_test').eq('id', a.team_id).single();
  if (!team || team.is_test) return { sent: 0, canceled: 0 };

  // Cancel upcoming bookings.
  const { data: meetings } = await db.from('peer_review_meetings').select('id,calendly_event_uri,scheduled_at').eq('student_id', a.user_id).gte('scheduled_at', new Date().toISOString());
  let canceled = 0; const canceledTimes: string[] = []; const failures: string[] = [];
  const key = process.env['LOVABLE_API_KEY']; const conn = process.env['CALENDLY_API_KEY'];
  for (const m of meetings ?? []) {
    const uuid = m.calendly_event_uri.split('/').pop();
    if (!uuid || !key || !conn) { failures.push(m.scheduled_at); continue; }
    const r = await fetch(`https://connector-gateway.lovable.dev/calendly/scheduled_events/${encodeURIComponent(uuid)}/cancellation`, {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'X-Connection-Api-Key': conn, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Your peer review was accepted — no meeting is needed.' }),
    });
    const text = r.ok ? '' : await r.text();
    // 403 "already canceled" style responses still mean the event is not active.
    if (r.ok || /cancel/i.test(text)) {
      await db.from('peer_review_meetings').delete().eq('id', m.id);
      canceled++; canceledTimes.push(m.scheduled_at);
    } else { console.error('Calendly cancellation failed', r.status, text); failures.push(m.scheduled_at); }
  }

  const fmt = (iso: string) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(iso));
  const regrade = (a.detailed_regrade as { precise_score?: number; score?: number } | null);
  const shown = regrade?.precise_score ?? regrade?.score ?? a.score;
  const first = student.name.split(' ')[0];
  const meetingLine = canceledTimes.length
    ? `Because you're done, your peer-review meeting on ${canceledTimes.map(fmt).join(' and ')} has been canceled — you do not need to attend.`
    : 'You do not need to schedule or attend a peer-review meeting.';
  const body = [
    `Hi ${first},`,
    `Your mid-semester peer review has been accepted${shown != null ? ` (${shown}/10)` : ''}. You are done with this assignment — no further revisions are needed.`,
    meetingLine,
    'Thank you for the work you put into your revisions.',
    'Prof. Hillman',
  ].join('\n\n');
  const subject = `Peer review accepted — ${student.name} — no meeting needed`;

  const { sendTemplateEmail } = await import('@/lib/email-templates/send-email');
  let sent = 0;
  const send = async (copy: string, to: string | null | undefined) => {
    if (!to) return;
    const res = await sendTemplateEmail('peer-review-meeting-confirmed', to, {
      templateData: { name: student.name, body, subject: copy === 'student' ? subject : `Copy: ${subject}` },
      replyTo: INSTRUCTOR_EMAIL,
      idempotencyKey: `peer-accepted-${a.id}-${copy}-${to.toLowerCase()}`,
    });
    if (res.sent) sent++;
  };
  await send('student', student.email);
  await send('instructor', INSTRUCTOR_EMAIL);
  const { data: pm } = await db.from('team_members').select('user_id').eq('team_id', a.team_id).eq('job_title', 'PM').maybeSingle();
  if (pm && pm.user_id !== a.user_id) {
    const { data: p } = await db.from('profiles').select('email').eq('id', pm.user_id).single();
    await send('pm', p?.email);
  }
  return { sent, canceled, failures };
}
