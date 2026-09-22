import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Users } from "lucide-react";
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
        supabase
          .from("profiles")
          .select(
            "id, name, first_name, last_name, initials, email, avatar_url, student_id, section, phone_number, phone_visible, work_style, skills_have, skills_learn, top_skills, created_at, updated_at",
          ),

      ]);
      if (tErr) throw tErr;
      if (mErr) throw mErr;
      if (pErr) throw pErr;

      const profMap = new Map((profiles ?? []).map((p) => [p.id, p] as const));
      const enriched = (teams ?? []).map((t) => {
        const roster = (members ?? [])
          .filter((m) => m.team_id === t.id)
          .map((m) => {
            const p = profMap.get(m.user_id);
            return {
              user_id: m.user_id,
              job_title: m.job_title ?? null,
              name: p?.name ?? "—",
              email: p?.email ?? null,
              student_id: p?.student_id ?? null,
              avatar_url: p?.avatar_url ?? null,
              profile: p ?? null,
            };
          })

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

  const exportXlsx = async () => {
    const XLSX = await import("xlsx");
    const rows = teams.flatMap((t) =>
      t.roster.map((m) => {
        const p = m.profile;
        return {
          Section: t.section ?? "",
          Team: t.name ?? "",
          Role: m.job_title ?? "",
          Name: m.name === "—" ? "" : m.name,
          "First name": p?.first_name ?? "",
          "Last name": p?.last_name ?? "",
          Initials: p?.initials ?? "",
          Email: p?.email ?? "",
          "Student ID": p?.student_id ?? "",
          Phone: p?.phone_number ?? "",
          "Phone visible": p ? (p.phone_visible ? "Yes" : "No") : "",
          "Profile section": p?.section ?? "",
          "Work style": p?.work_style ?? "",
          "Top skills": (p?.top_skills ?? []).join("; "),
          "Skills have": (p?.skills_have ?? []).join("; "),
          "Skills to learn": (p?.skills_learn ?? []).join("; "),
          "Profile created": p?.created_at ? new Date(p.created_at).toLocaleString() : "",
          "Profile updated": p?.updated_at ? new Date(p.updated_at).toLocaleString() : "",
        };
      }),
    );
    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet["!cols"] = Object.keys(rows[0] ?? { A: "" }).map((k) => ({
      wch: Math.min(40, Math.max(12, k.length + 4)),
    }));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Students");
    XLSX.writeFile(book, `student-roster-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };


  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="font-display text-xl flex items-center gap-2">
          <Users className="h-5 w-5 text-gold" /> Students by team ({totalStudents})
        </CardTitle>
        <Button
          size="sm"
          variant="outline"
          onClick={exportXlsx}
          disabled={teams.length === 0 || totalStudents === 0}
        >
          <Download className="h-3.5 w-3.5 mr-1" /> Export XLSX
        </Button>

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
