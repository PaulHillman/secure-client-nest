import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileVault } from "@/components/file-vault";
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
  component: VaultPage,
});

type SortKey = "az" | "za";
type SectionFilter = "all" | "03" | "04";

function VaultPage() {
  const [teamId, setTeamId] = useState<string | undefined>();
  const [sort, setSort] = useState<SortKey>("az");
  const [section, setSection] = useState<SectionFilter>("all");

  const { data: teams, isLoading } = useQuery({
    queryKey: ["vault-teams"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name, section, company_focus(company_name)")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const options = useMemo(() => {
    const rows = (teams ?? []).map((t) => {
      const label = t.name;
      const sortKey = t.name.toLowerCase();
      return { id: t.id, label, section: t.section ?? "", sortKey };
    });
    const filtered = section === "all" ? rows : rows.filter((r) => r.section === section);
    filtered.sort((a, b) =>
      sort === "az" ? a.sortKey.localeCompare(b.sortKey) : b.sortKey.localeCompare(a.sortKey),
    );
    return filtered;
  }, [teams, sort, section]);

  useEffect(() => {
    if (options.length === 0) {
      if (teamId) setTeamId(undefined);
      return;
    }
    if (!teamId || !options.some((o) => o.id === teamId)) {
      setTeamId(options[0].id);
    }
  }, [options, teamId]);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-6">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-6 w-6 text-gold" />
          <h1 className="font-display text-4xl">File Vault</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Browse files across every team and company.
        </p>
      </header>

      <div className="mb-6 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end max-w-3xl">
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
                  {o.section ? ` (§${o.section})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Section</label>
          <Select value={section} onValueChange={(v) => setSection(v as SectionFilter)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sections</SelectItem>
              <SelectItem value="03">§03 only</SelectItem>
              <SelectItem value="04">§04 only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Sort</label>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="az">A → Z</SelectItem>
              <SelectItem value="za">Z → A</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {teamId ? (
        <FileVault teamId={teamId} />
      ) : (
        !isLoading && (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center text-muted-foreground">
              No teams match these filters.
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}
