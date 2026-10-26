import { createFileRoute, Navigate, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { CalendarClock } from 'lucide-react';

export const Route = createFileRoute('/app/admin_/peer-review-meetings')({
  head: () => ({
    meta: [
      { title: 'Peer-review Meetings — ClientVault Admin' },
      { name: 'description', content: 'Upcoming and past peer-review meetings booked with the instructor, with links to each student\'s latest submission.' },
      { property: 'og:title', content: 'Peer-review Meetings — ClientVault Admin' },
      { property: 'og:description', content: 'Booked peer-review meetings and each student\'s latest submission.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: Page,
});

type MeetingRow = {
  id: string;
  scheduled_at: string;
  zoom_url: string | null;
  score: number | null;
  attempt: number | null;
  student_id: string;
  team_id: string | null;
  profiles: { name: string; email: string | null } | null;
  teams: { display_name: string | null; name: string; section: string | null } | null;
};

function easternDateTime(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  }).format(new Date(iso));
}

function Page() {
  const { isAdmin, loading } = useAuth();
  const query = useQuery({
    queryKey: ['peer-review-meetings'],
    enabled: isAdmin,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('peer_review_meetings')
        .select('id, scheduled_at, zoom_url, score, attempt, student_id, team_id, profiles:profiles!peer_review_meetings_student_id_fkey(name, email), teams:teams!peer_review_meetings_team_id_fkey(display_name, name, section)')
        .order('scheduled_at');
      if (error) throw error;
      return (data ?? []) as MeetingRow[];
    },
  });

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/app/dashboard" />;

  const now = Date.now();
  const rows = query.data ?? [];
  const upcoming = rows.filter((r) => new Date(r.scheduled_at).getTime() >= now);
  const past = rows.filter((r) => new Date(r.scheduled_at).getTime() < now).reverse();
  const teamLabel = (t: MeetingRow['teams']) =>
    t ? `${t.display_name?.trim() || t.name}${t.section ? ` · Section ${t.section}` : ''}` : '—';

  const renderRows = (list: MeetingRow[]) => (
    <tbody>
      {list.map((row) => (
        <tr key={row.id} className="border-b align-top">
          <td className="p-2 min-w-48">
            <div className="font-medium">{row.profiles?.name ?? 'Unknown student'}</div>
            {row.profiles?.email && <div className="text-xs text-muted-foreground">{row.profiles.email}</div>}
          </td>
          <td className="p-2">{teamLabel(row.teams)}</td>
          <td className="p-2 whitespace-nowrap">{easternDateTime(row.scheduled_at)}</td>
          <td className="p-2">
            {row.zoom_url ? (
              <a href={row.zoom_url} target="_blank" rel="noreferrer" className="text-primary underline">Join link</a>
            ) : (
              <span className="text-muted-foreground text-xs">In calendar invite</span>
            )}
          </td>
          <td className="p-2 whitespace-nowrap">
            {row.score === null ? '—' : `${row.score}/10`} {row.attempt ? <span className="text-xs text-muted-foreground">(attempt {row.attempt})</span> : null}
          </td>
          <td className="p-2">
            <Link to="/app/vault" search={{ team: row.team_id ?? undefined }} className="text-primary underline text-sm">
              Latest submission
            </Link>
          </td>
        </tr>
      ))}
    </tbody>
  );

  return (
    <main className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <CalendarClock className="h-6 w-6 text-gold" />
        <h1 className="font-display text-3xl">Peer-review Meetings</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Students who used all three peer-review submissions without reaching 8/10 and booked a meeting with you.
        Bookings appear here automatically when a student schedules on your Calendly page.
      </p>
      {query.error && <p role="alert" className="text-destructive text-sm">{query.error.message}</p>}

      <section>
        <h2 className="font-display text-xl mb-2">Upcoming meetings ({upcoming.length})</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">No meetings booked yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-2">Student</th><th className="p-2">Team</th><th className="p-2">When</th>
                  <th className="p-2">Zoom</th><th className="p-2">Latest score</th><th className="p-2">Submission</th>
                </tr>
              </thead>
              {renderRows(upcoming)}
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-xl mb-2">Held meetings ({past.length})</h2>
        {past.length === 0 ? (
          <p className="text-sm text-muted-foreground">No past meetings.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-2">Student</th><th className="p-2">Team</th><th className="p-2">When</th>
                  <th className="p-2">Zoom</th><th className="p-2">Latest score</th><th className="p-2">Submission</th>
                </tr>
              </thead>
              {renderRows(past)}
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
