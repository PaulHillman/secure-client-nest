import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { teamLineLabel, compareTeamsBySectionThenNumber } from "@/lib/team-label";
import { FileVault } from "@/components/file-vault";
import { NON_COMPETITION_SECTIONS, VAULT_STRUCTURE } from "@/lib/vault-structure";
import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FolderOpen } from "lucide-react";

export const Route = createFileRoute("/app/vault")({
  head: () => ({ meta: [{ title: "File Vault — ClientVault" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    team: typeof search.team === "string" ? search.team : undefined,
    file: typeof search.file === "string" ? search.file : undefined,
  }),
  component: VaultPage,
});

type SectionFilter = "all" | "03" | "04";

function VaultPage() {
  const { user, isAdmin } = useAuth();
  const { team: teamFromUrl } = Route.useSearch();
  const [teamId, setTeamId] = useState<string | undefined>(teamFromUrl);
  const [section, setSection] = useState<SectionFilter>("all");

  // Students only ever see their own team's vault.
  const { data: myTeam, isLoading: myTeamLoading } = useQuery({
    queryKey: ["my-vault-team", user?.id],
    enabled: !!user && !isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("team_id, teams(name, is_test)")
        .eq("user_id", user!.id);
      if (error) throw error;
      const mine = (data ?? []).find(
        (t) => t.teams && !(t.teams as { is_test?: boolean }).is_test,
      );
      return mine ?? null;
    },
  });

  const { data: teams, isLoading: teamsLoading } = useQuery({
    queryKey: ["vault-teams"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name, display_name, section");
      if (error) throw error;
      return data ?? [];
    },
  });

  const options = useMemo(() => {
    const rows = section === "all"
      ? (teams ?? []).slice()
      : (teams ?? []).filter((t) => t.section === section);
    // Always: Section first (04, then 05), then team number 01, 02, 03…
    return rows
      .sort(compareTeamsBySectionThenNumber)
      .map((t) => ({ id: t.id, label: teamLineLabel(t), section: t.section ?? "" }));
  }, [teams, section]);

  useEffect(() => {
    if (isAdmin && teamFromUrl) setTeamId(teamFromUrl);
  }, [isAdmin, teamFromUrl]);

  // Admin: keep the picked team valid against the filtered list.
  useEffect(() => {
    if (!isAdmin) return;
    if (options.length === 0) {
      if (teamId) setTeamId(undefined);
      return;
    }
    if (!teamId || !options.some((o) => o.id === teamId)) {
      setTeamId(options[0].id);
    }
  }, [isAdmin, options, teamId]);

  const isLoading = isAdmin ? teamsLoading : myTeamLoading;
  const effectiveTeamId = isAdmin ? teamId : myTeam?.team_id;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-6">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-6 w-6 text-gold" />
          <h1 className="font-display text-4xl">File Vault</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {isAdmin ? "Browse files across every team." : "Your team's shared files."}
        </p>
      </header>

      {isAdmin && (
        <div className="mb-6 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end max-w-3xl">
          <div>
            <label className="text-sm font-medium mb-2 block">Select team</label>
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger>
                <SelectValue placeholder={isLoading ? "Loading…" : "Pick a team"} />
              </SelectTrigger>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Section</label>
            <Select value={section} onValueChange={(v) => setSection(v as SectionFilter)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sections</SelectItem>
                <SelectItem value="03">Section 03 only</SelectItem>
                <SelectItem value="04">Section 04 only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {effectiveTeamId ? (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            Competition submissions have moved to{" "}
            <Link to="/app/competitions" className="text-gold underline underline-offset-2">Competitions</Link>.
          </p>
          <FileVault teamId={effectiveTeamId} sections={NON_COMPETITION_SECTIONS} uploadSections={VAULT_STRUCTURE} />
        </>
      ) : (
        !isLoading && (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center text-muted-foreground">
              {isAdmin ? "No teams match these filters." : "You are not assigned to a team yet."}
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}
