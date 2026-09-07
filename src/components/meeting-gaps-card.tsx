import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "@tanstack/react-router";
import { CalendarX, BellRing } from "lucide-react";
import { toast } from "sonner";
import { notifyMeetingGaps } from "@/lib/meeting.functions";
import { fmtTime } from "@/lib/meeting-agreement";

export function MeetingGapsCard() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["meeting-gaps"],
    queryFn: async () => {
      const [{ data: teams }, { data: logs }] = await Promise.all([
        supabase.from("teams").select("id, name, display_name, section"),
        supabase.from("meeting_logs").select("team_id, meeting_date, meeting_time, minutes_posted, as_agreed"),
      ]);
      const byTeam = new Map<string, any[]>();
      for (const l of (logs ?? []) as any[]) {
        byTeam.set(l.team_id, [...(byTeam.get(l.team_id) ?? []), l]);
      }
      return (teams ?? [])
        .map((t: any) => {
          const rows = (byTeam.get(t.id) ?? []).sort((a, b) => (a.meeting_date < b.meeting_date ? 1 : -1));
          const last = rows[0];
          const weeks = last
            ? Math.floor((Date.now() - new Date(last.meeting_date).getTime()) / (7 * 24 * 3600 * 1000))
            : null;
          return {
            id: t.id,
            label: `${t.display_name || t.name}${t.section ? ` · Section ${t.section}` : ""}`,
            last,
            weeks,
            moved: rows.filter((r) => !r.as_agreed).length,
            noMinutes: rows.filter((r) => !r.minutes_posted).length,
          };
        })
        .sort((a, b) => (b.weeks ?? 999) - (a.weeks ?? 999));
    },
  });

  const notify = useMutation({
    mutationFn: async () => notifyMeetingGaps({ data: { weeks: 2 } }),
    onSuccess: (r: any) =>
      toast.success(
        r.teams === 0 ? "Every team is up to date" : `Alerted ${r.teams} team${r.teams === 1 ? "" : "s"}`,
      ),
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = data ?? [];
  const behind = rows.filter((r) => r.weeks === null || r.weeks >= 2);

  return (
    <Card className="border-border/60">
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="font-display text-xl flex items-center gap-2">
          <CalendarX className="h-5 w-5 text-gold" />
          Meetings &amp; minutes
          {behind.length > 0 && <Badge variant="destructive">{behind.length} behind</Badge>}
        </CardTitle>
        <Button size="sm" variant="outline" onClick={() => notify.mutate()} disabled={notify.isPending}>
          <BellRing className="h-3.5 w-3.5 mr-1" />
          Ding teams behind
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No teams yet.</p>
        ) : (
          <ul className="divide-y">
            {rows.map((r) => (
              <li key={r.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                <Link to="/app/teams/$teamId" params={{ teamId: r.id }} className="hover:underline">
                  {r.label}
                </Link>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {r.moved > 0 && (
                    <span className="text-amber-500">{r.moved} moved</span>
                  )}
                  {r.noMinutes > 0 && <span>{r.noMinutes} without minutes</span>}
                  {r.last ? (
                    <span>
                      Last: {r.last.meeting_date} at {fmtTime(r.last.meeting_time)}
                    </span>
                  ) : (
                    <span className="text-destructive">No meetings logged</span>
                  )}
                  {r.weeks !== null && r.weeks >= 2 && (
                    <Badge variant="destructive">{r.weeks}w silent</Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <button className="mt-3 text-xs text-muted-foreground underline" onClick={() => refetch()}>
          Refresh
        </button>
      </CardContent>
    </Card>
  );
}
