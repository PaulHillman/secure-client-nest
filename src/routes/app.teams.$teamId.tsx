import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Building2, Mail, Globe, MapPin, Users } from "lucide-react";
import { FileVault } from "@/components/file-vault";

export const Route = createFileRoute("/app/teams/$teamId")({
  head: () => ({ meta: [{ title: "Team — ClientVault" }] }),
  component: TeamDetail,
});

const ROLE_ORDER = [
  "PM",
  "Company Liaison",
  "Communication Specialist",
  "Video Specialist",
  "Researcher",
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function TeamDetail() {
  const { teamId } = Route.useParams();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["team", teamId],
    queryFn: async () => {
      const [{ data: team, error: tErr }, { data: cf, error: cfErr }, { data: tm, error: mErr }] =
        await Promise.all([
          supabase.from("teams").select("*").eq("id", teamId).single(),
          supabase.from("company_focus").select("*").eq("team_id", teamId).maybeSingle(),
          supabase
            .from("team_members")
            .select("id, job_title, user_id")
            .eq("team_id", teamId),
        ]);
      if (tErr) throw tErr;
      if (cfErr) throw cfErr;
      if (mErr) throw mErr;

      const userIds = (tm ?? []).map((m) => m.user_id);
      let profiles: any[] = [];
      if (userIds.length) {
        const { data: pData, error: pErr } = await supabase
          .from("profiles")
          .select("id, name, email, avatar_url, section")
          .in("id", userIds);
        if (pErr) throw pErr;
        profiles = pData ?? [];
      }
      const profileMap = new Map(profiles.map((p) => [p.id, p]));
      const members = (tm ?? []).map((m) => ({ ...m, profiles: profileMap.get(m.user_id) }));
      return { team, companyFocus: cf, members };
    },
  });

  const team = data?.team;
  const cf = data?.companyFocus;
  const members = (data?.members ?? []).slice().sort((a, b) => {
    const ai = ROLE_ORDER.indexOf(a.job_title);
    const bi = ROLE_ORDER.indexOf(b.job_title);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link to="/app/teams" className="text-sm text-muted-foreground hover:text-foreground">
        ← All teams
      </Link>

      <header className="mt-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl">{team?.name ?? (isLoading ? "Loading…" : "Team")}</h1>
          {team?.section && (
            <p className="text-sm text-muted-foreground mt-1">Section §{team.section}</p>
          )}
        </div>
      </header>

      {cf && (
        <Card className="mt-6 border-border/60">
          <CardHeader>
            <CardTitle className="font-display text-xl flex items-center gap-2">
              <Building2 className="h-5 w-5 text-gold" />
              {cf.company_name}
            </CardTitle>
            <p className="text-sm text-muted-foreground">{cf.industry}</p>
          </CardHeader>
          <CardContent className="text-sm grid sm:grid-cols-2 gap-3">
            {cf.contact_person && (
              <div>
                <div className="text-foreground">{cf.contact_person}</div>
                <div className="text-muted-foreground">{cf.contact_job_title}</div>
              </div>
            )}
            {cf.email && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" /> <a href={`mailto:${cf.email}`} className="hover:text-foreground">{cf.email}</a>
              </div>
            )}
            {cf.website && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Globe className="h-4 w-4" />
                <a href={cf.website} target="_blank" rel="noreferrer" className="hover:text-foreground">{cf.website}</a>
              </div>
            )}
            {cf.hq_address && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" /> {cf.hq_address}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <section className="mt-8">
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-5 w-5 text-gold" />
          <h2 className="font-display text-2xl">Team members</h2>
          <span className="text-sm text-muted-foreground">({members.length})</span>
        </div>

        {error ? (
          <Card className="border-destructive/30">
            <CardContent className="py-8 text-center text-muted-foreground text-sm">
              Could not load this team roster. <button className="text-foreground underline underline-offset-4" onClick={() => refetch()}>Try again</button>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <p className="text-sm text-muted-foreground">Loading members…</p>
        ) : members.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center text-muted-foreground text-sm">
              No members assigned to this team yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {members.map((m) => {
              const p = (m as any).profiles;
              const displayName = p?.name ?? "Unlinked team member";
              return (
                <Card key={m.id} className="border-border/60">
                  <CardContent className="p-4 flex items-center gap-3">
                    <Avatar className="h-14 w-14">
                      <AvatarImage src={p?.avatar_url ?? undefined} alt={displayName} />
                      <AvatarFallback>{initials(displayName)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{displayName}</div>
                      <div className="text-xs text-gold">{m.job_title}</div>
                      {p?.email && (
                        <a href={`mailto:${p.email}`} className="text-xs text-muted-foreground truncate block hover:text-foreground">
                          {p.email}
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

    </div>
  );
}
