import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { teamPrimaryName } from "@/lib/team-label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, Search, ArrowUpDown } from "lucide-react";

export const Route = createFileRoute("/app/teams")({
  head: () => ({ meta: [{ title: "Teams — ClientVault" }] }),
  component: Teams,
});

type SortMode = "section-team" | "name-asc" | "team-number";

function extractTeamNumber(name: string | null): number {
  if (!name) return Infinity;
  const match = name.match(/\d+/);
  return match ? parseInt(match[0], 10) : Infinity;
}

function normalizeSection(section: string | null): string {
  return section ?? "";
}

function Teams() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { user, isAdmin } = useAuth();

  const [sortBy, setSortBy] = useState<SortMode>(isAdmin ? "section-team" : "section-team");
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [searchText, setSearchText] = useState("");

  const { data: teams } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name, display_name, description, section, company_focus(company_name, industry, contact_person, contact_job_title)");
      if (error) throw error;
      return data;
    },
  });

  const { data: memberships } = useQuery({
    queryKey: ["my-team-memberships", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return new Set((data ?? []).map((m) => m.team_id));
    },
  });

  const myTeamIds = memberships ?? new Set<string>();

  const sections = useMemo(() => {
    const set = new Set<string>();
    (teams ?? []).forEach((t) => {
      if (t.section) set.add(t.section);
    });
    return Array.from(set).sort((a, b) => {
      const na = parseInt(a, 10);
      const nb = parseInt(b, 10);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });
  }, [teams]);

  const filteredTeams = useMemo(() => {
    let list = (teams ?? []).slice();

    const query = searchText.trim().toLowerCase();
    if (query) {
      list = list.filter((t) => {
        const primary = teamPrimaryName(t).toLowerCase();
        const name = (t.name ?? "").toLowerCase();
        const section = (t.section ?? "").toLowerCase();
        const teamNum = String(extractTeamNumber(t.name));
        return (
          primary.includes(query) ||
          name.includes(query) ||
          section.includes(query) ||
          teamNum.includes(query)
        );
      });
    }

    if (sectionFilter !== "all") {
      list = list.filter((t) => t.section === sectionFilter);
    }

    list.sort((a, b) => {
      const sa = normalizeSection(a.section);
      const sb = normalizeSection(b.section);
      const na = parseInt(sa, 10);
      const nb = parseInt(sb, 10);

      if (sortBy === "section-team") {
        if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
        if (sa !== sb) return sa.localeCompare(sb);
        return extractTeamNumber(a.name) - extractTeamNumber(b.name);
      }

      if (sortBy === "team-number") {
        return extractTeamNumber(a.name) - extractTeamNumber(b.name);
      }

      // name-asc
      const pa = teamPrimaryName(a).toLowerCase();
      const pb = teamPrimaryName(b).toLowerCase();
      return pa.localeCompare(pb);
    });

    return list;
  }, [teams, searchText, sectionFilter, sortBy]);

  if (pathname !== "/app/teams") {
    return <Outlet />;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="font-display text-4xl">Teams</h1>
        <p className="text-sm text-muted-foreground mt-1">All MGT 331 consulting teams.</p>
      </header>

      {isAdmin && (
        <div className="mb-6 flex flex-col sm:flex-row gap-3">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filter by team name, number, or section…"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="w-full sm:w-44">
            <Select value={sectionFilter} onValueChange={setSectionFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All sections" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sections</SelectItem>
                {sections.map((s) => (
                  <SelectItem key={s} value={s}>
                    Section {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-full sm:w-52">
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortMode)}>
              <SelectTrigger>
                <ArrowUpDown className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="section-team">Section, then Team #</SelectItem>
                <SelectItem value="name-asc">Team name A–Z</SelectItem>
                <SelectItem value="team-number">Team number</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {teams && teams.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            No teams yet. An admin can create teams from the Admin panel.
          </CardContent>
        </Card>
      )}

      {filteredTeams.length === 0 && teams && teams.length > 0 && (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            No teams match your filters.
          </CardContent>
        </Card>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTeams.map((t) => {
          const cf = Array.isArray(t.company_focus) ? t.company_focus[0] : t.company_focus;
          const isMine = myTeamIds.has(t.id);
          const canEnter = isAdmin || isMine;
          const primary = teamPrimaryName(t);

          const card = (
            <Card
              className={`h-full transition ${
                canEnter
                  ? "cursor-pointer border-border/60 hover:border-gold/50 hover:shadow-md"
                  : "opacity-80 bg-muted/30 border-border/40"
              } ${isMine ? "border-gold/60 bg-gold/5" : ""}`}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="font-display text-xl">{primary}</CardTitle>
                    {primary !== t.name && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t.name}
                        {t.section ? ` · Section ${t.section}` : ""}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isMine && (
                      <span className="text-[10px] uppercase tracking-wider font-semibold rounded-full bg-gold/20 text-gold px-2 py-0.5">
                        Your team
                      </span>
                    )}
                    {t.section && (
                      <span className="text-xs rounded-full bg-secondary px-2 py-0.5">Section {t.section}</span>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="text-sm text-muted-foreground">
                {cf ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-gold" />
                      <span className="text-foreground">{cf.company_name}</span>
                      {cf.industry && <span className="text-xs">· {cf.industry}</span>}
                    </div>
                    {cf.contact_person && (
                      <div className="text-xs pl-6">
                        Manager: {cf.contact_person}
                        {cf.contact_job_title && <span className="text-muted-foreground">, {cf.contact_job_title}</span>}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="italic">No company selected</span>
                )}
                {t.description && <p className="mt-2 line-clamp-2">{t.description}</p>}
                {!canEnter && (
                  <p className="mt-3 text-xs text-muted-foreground italic">
                    You can only enter your own team space.
                  </p>
                )}
              </CardContent>
            </Card>
          );

          return canEnter ? (
            <Link key={t.id} to="/app/teams/$teamId" params={{ teamId: t.id }} aria-label={`View ${primary} members`}>
              {card}
            </Link>
          ) : (
            <div key={t.id} className="pointer-events-none select-none">
              {card}
            </div>
          );
        })}
      </div>
    </div>
  );
}
