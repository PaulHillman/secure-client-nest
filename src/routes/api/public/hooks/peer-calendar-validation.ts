import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/public/hooks/peer-calendar-validation')({
  server: { handlers: { POST: async ({ request }) => {
    const token = request.headers.get('authorization')?.replace(/^Bearer /, '');
    if (!token || !/^[0-9a-f-]{36}$/i.test(token)) return new Response('Unauthorized', { status: 401 });
    const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
    // A private, expiring, single-use nonce created by the SQL-only daily dispatcher.
    const { data: claim, error } = await db.from('peer_calendar_dispatch').delete().eq('id', true).eq('token', token).gt('expires_at', new Date().toISOString()).select('id').maybeSingle();
    if (error || !claim) return new Response('Unauthorized', { status: 401 });
    try {
      const { syncCalendlyPeerMeetings } = await import('@/lib/peer-review-calendar.server');
      const result = await syncCalendlyPeerMeetings(db);
      const { error: logError } = await db.from('admin_audit_log').insert({ action: 'peer_calendar_validation', archive_name: 'Daily calendar check', details: { imported: result.imported, unmatchedCount: result.unmatched.length } });
      if (logError) throw logError;
      return Response.json({ success: true });
    } catch {
      await db.from('admin_audit_log').insert({ action: 'peer_calendar_validation_failed', archive_name: 'Daily calendar check failed', details: { message: 'Calendly validation failed; use Sync Calendly to retry.' } });
      return Response.json({ success: false }, { status: 502 });
    }
  } } },
});