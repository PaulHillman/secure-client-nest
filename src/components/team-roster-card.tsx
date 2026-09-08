import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import { StudentName } from "@/components/student-avatar";

const JOB_ORDER = [
  "PM",
  "Client Vault & Tech Administrator",
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
        supabase.from("teams").select("id, name, section"),
        supabase.from("team_members").select("team_id, user_id, job_title"),
        supabase.from("profiles").select("id, name, email, avatar_url"),
      ]);
      if (tErr) throw tErr;
      if (mErr) throw mErr;
      if (pErr) throw pErr;

      const profMap = new Map((profiles ?? []).map((p) => [p.id, p] as const));
      const enriched = (teams ?? []).map((t) => {
        const roster = (members ?? [])
          .filter((m) => m.team_id === t.id)
          .map((m) => ({
            user_id: m.user_id,
            job_title: m.job_title ?? null,
            name: profMap.get(m.user_id)?.name ?? "—",
            email: profMap.get(m.user_id)?.email ?? null,
            avatar_url: profMap.get(m.user_id)?.avatar_url ?? null,
          }))
          .sort((a, b) => {
            const r = jobRank(a.job_title) - jobRank(b.job_title);
            if (r !== 0) return r;
            return (a.name ?? "").localeCompare(b.name ?? "");
          });
        return { ...t, roster };
      });

      enriched.sort((a, b) => {
        const sa = a.section ?? "";
        const sb = b.section ?? "";
        const na = parseInt(sa, 10);
        const nb = parseInt(sb, 10);
        if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
        if (sa !== sb) return sa.localeCompare(sb);
        return (a.name ?? "").localeCompare(b.name ?? "");
      });
      return enriched;
    },
  });

  const teams = data ?? [];
  const totalStudents = teams.reduce((acc, t) => acc + t.roster.length, 0);

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="font-display text-xl flex items-center gap-2">
          <Users className="h-5 w-5 text-gold" /> Students by team ({totalStudents})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {teams.length === 0 ? (
          <p className="text-sm text-muted-foreground">No teams yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground border-b">
                  <th className="py-2 pr-3">Section</th>
                  <th className="py-2 pr-3">Team</th>
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Role</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((t) =>
                  t.roster.length === 0 ? (
                    <tr key={t.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 text-muted-foreground">{t.section ?? "—"}</td>
                      <td className="py-2 pr-3 font-medium">{t.name}</td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground italic" colSpan={3}>
                        No members
                      </td>
                    </tr>
                  ) : (
                    t.roster.map((m, idx) => (
                      <tr
                        key={`${t.id}-${m.user_id}`}
                        className={idx === t.roster.length - 1 ? "border-b" : ""}
                      >
                        <td className="py-2 pr-3 text-muted-foreground">
                          {idx === 0 ? t.section ?? "—" : ""}
                        </td>
                        <td className="py-2 pr-3 font-medium">
                          {idx === 0 ? t.name : ""}
                        </td>
                        <td className="py-2 pr-3"><StudentName name={m.name} email={m.email} avatarUrl={m.avatar_url} /></td>
                        <td className="py-2 pr-3 text-muted-foreground">{m.email ?? "—"}</td>
                        <td className="py-2 pr-3">
                          {m.job_title ? (
                            <Badge variant="secondary">{m.job_title}</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
