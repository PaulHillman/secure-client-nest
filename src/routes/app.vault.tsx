import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
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

function VaultPage() {
  const [teamId, setTeamId] = useState<string | undefined>();

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

  useEffect(() => {
    if (!teamId && teams && teams.length > 0) setTeamId(teams[0].id);
  }, [teams, teamId]);

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

      <div className="mb-6 max-w-md">
        <label className="text-sm font-medium mb-2 block">Select company / team</label>
        <Select value={teamId} onValueChange={setTeamId}>
          <SelectTrigger>
            <SelectValue placeholder={isLoading ? "Loading…" : "Pick a team"} />
          </SelectTrigger>
          <SelectContent>
            {teams?.map((t) => {
              const cf = Array.isArray(t.company_focus) ? t.company_focus[0] : t.company_focus;
              const label = cf?.company_name
                ? `${cf.company_name} — ${t.name}`
                : t.name;
              return (
                <SelectItem key={t.id} value={t.id}>
                  {label}
                  {t.section ? ` (§${t.section})` : ""}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {teamId ? (
        <FileVault teamId={teamId} />
      ) : (
        !isLoading && (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center text-muted-foreground">
              No teams available.
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}
