import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";

const JOB_ORDER = [
  "PM",
  "Company Liaison",
  "Video Specialist",
  "Communication Specialist",
] as const;

function jobRank(job: string | null): number {
  if (!job) return 999;
  const i = (JOB_ORDER as readonly string[]).indexOf(job);
  return i === -1 ? 500 : i;
}

export function TeamRosterCard() {
  const { data } = useQuery({
    queryKey: ["admin", "team-roster"],
    queryFn: async () => {
      const [
        { data: teams, error: tErr },
        { data: members, error: mErr },
        { data: profiles, error: pErr },
      ] = await Promise.all([
        supabase.from("teams").select("id, name, section").order("name"),
        supabase.from("team_members").select("team_id, user_id, job_title"),
        supabase.from("profiles").select("id, name, email"),
      ]);
      if (tErr) throw tErr;
      if (mErr) throw mErr;
      if (pErr) throw pErr;

      const profMap = new Map((profiles ?? []).map((p) => [p.id, p] as const));
      return (teams ?? []).map((t) => {
        const roster = (members ?? [])
          .filter((m) => m.team_id === t.id)
          .map((m) => ({
            user_id: m.user_id,
            job_title: m.job_title ?? null,
            name: profMap.get(m.user_id)?.name ?? "—",
            email: profMap.get(m.user_id)?.email ?? null,
          }))
          .sort((a, b) => {
            const r = jobRank(a.job_title) - jobRank(b.job_title);
            if (r !== 0) return r;
            return (a.name ?? "").localeCompare(b.name ?? "");
          });
        return { ...t, roster };
      });
    },
  });

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="font-display text-xl flex items-center gap-2">
          <Users className="h-5 w-5 text-gold" /> Students by team
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!data?.length ? (
          <p className="text-sm text-muted-foreground">No teams yet.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {data.map((t) => (
              <div key={t.id} className="rounded-md border border-border/60 p-3">
                <div className="flex items-baseline justify-between mb-2">
                  <h3 className="font-display text-base">{t.name}</h3>
                  {t.section && (
                    <span className="text-xs text-muted-foreground">§ {t.section}</span>
                  )}
                </div>
                {t.roster.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No members</p>
                ) : (
                  <ul className="space-y-1.5">
                    {t.roster.map((m) => (
                      <li key={m.user_id} className="flex items-center justify-between gap-2 text-sm">
                        <div className="min-w-0">
                          <div className="truncate">{m.name}</div>
                          {m.email && (
                            <div className="text-xs text-muted-foreground truncate">{m.email}</div>
                          )}
                        </div>
                        {m.job_title ? (
                          <Badge variant="secondary" className="shrink-0">{m.job_title}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground italic shrink-0">—</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
