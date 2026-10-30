import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { bookingIdentity } from './peer-review-workspace';

type Event = { uri: string; start_time: string; location?: { join_url?: string }; };
type Invitee = { email: string; name: string; status: string; questions_and_answers?: { question: string; answer: string }[] };
export async function syncCalendlyPeerMeetings(db: SupabaseClient<Database>) {
  const key = process.env['LOVABLE_API_KEY'];
  const connection = process.env['CALENDLY_API_KEY'];
  if (!key || !connection) throw new Error('Calendly connection is unavailable');
  async function get<T>(path: string): Promise<T> {
    const response = await fetch(`https://connector-gateway.lovable.dev/calendly${path}`, { headers: { Authorization: `Bearer ${key}`, 'X-Connection-Api-Key': connection ?? '' } });
    if (!response.ok) {
      const body = await response.text();
      console.error('Calendly sync failed', response.status, body);
      throw new Error(`Calendly could not load bookings (${response.status}). No further requests were made.`);
    }
    return response.json() as Promise<T>;
  }
  const me = await get<{ resource: { uri: string } }>('/users/me');
  const min = new Date(Date.now() - 7 * 86400000).toISOString();
  const max = new Date(Date.now() + 30 * 86400000).toISOString();
  const params = new URLSearchParams({ user: me.resource.uri, min_start_time: min, max_start_time: max, count: '100', status: 'active' });
  const events: Event[] = [];
  let token: string | null = null;
  do {
    if (token) params.set('page_token', token);
    const page = await get<{ collection: Event[]; pagination: { next_page_token: string | null } }>(`/scheduled_events?${params}`);
    events.push(...page.collection); token = page.pagination.next_page_token;
  } while (token);
  const { data: people, error: pe } = await db.from('profiles').select('id,name,email');
  if (pe) throw pe;
  let imported = 0;
  const unmatched: string[] = [];
  const activeKeys = new Set<string>();
  for (const event of events) {
    const id = event.uri.split('/').pop();
    if (!id) continue;
    const invitees: Invitee[] = [];
    let inviteeToken: string | null = null;
    do {
      const page: { collection: Invitee[]; pagination: { next_page_token: string | null } } = await get(`/scheduled_events/${encodeURIComponent(id)}/invitees?count=100${inviteeToken ? `&page_token=${encodeURIComponent(inviteeToken)}` : ''}`);
      invitees.push(...page.collection); inviteeToken = page.pagination.next_page_token;
    } while (inviteeToken);
    for (const invitee of invitees.filter(i => i.status === 'active')) {
      const identity = bookingIdentity(people ?? [], invitee.email, invitee.name);
      if (!identity || /parfunkel/i.test(identity.person.name)) { unmatched.push(invitee.name); continue; }
      const { data: latest, error: ae } = await db.from('peer_review_assessments').select('team_id,score,attempt,teams!inner(is_test)').eq('user_id', identity.person.id).eq('status', 'assessed').eq('teams.is_test', false).order('attempt', { ascending: false }).limit(1).maybeSingle();
      if (ae) throw ae;
      if (!latest) continue;
      activeKeys.add(`${event.uri}:${identity.person.id}`);
      const topic = invitee.questions_and_answers?.find(q => /discuss/i.test(q.question))?.answer ?? 'Topic not specified';
      const { error } = await db.from('peer_review_meetings').upsert({ calendly_event_uri: event.uri, student_id: identity.person.id, team_id: latest.team_id, scheduled_at: event.start_time, zoom_url: event.location?.join_url ?? null, attempt: latest.attempt, score: latest.score, booking_topic: topic, identity_match: identity.match }, { onConflict: 'calendly_event_uri' });
      if (error) throw error;
      imported++;
    }
  }
  // Reconcile only this fetched date window; do not discard records outside it.
  const { data: existing, error: ee } = await db.from('peer_review_meetings').select('id,calendly_event_uri,student_id').gte('scheduled_at', min).lte('scheduled_at', max);
  if (ee) throw ee;
  const canceled = (existing ?? []).filter(e => !activeKeys.has(`${e.calendly_event_uri}:${e.student_id}`)).map(e => e.id);
  if (canceled.length) { const { error } = await db.from('peer_review_meetings').delete().in('id', canceled); if (error) throw error; }
  return { imported, unmatched: unmatched.filter(n => !/parfunkel/i.test(n)) };
}