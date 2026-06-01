import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2 } from "lucide-react";

export const Route = createFileRoute("/app/teams")({
  head: () => ({ meta: [{ title: "Teams — ClientVault" }] }),
  component: Teams,
});

function Teams() {
  const { data: teams } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name, description, section, company_focus(company_name, industry)")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="font-display text-4xl">Teams</h1>
        <p className="text-sm text-muted-foreground mt-1">All MGT 331 consulting teams.</p>
      </header>

      {teams && teams.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            No teams yet. An admin can create teams from the Admin panel.
          </CardContent>
        </Card>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams?.map((t) => {
          const cf = Array.isArray(t.company_focus) ? t.company_focus[0] : t.company_focus;
          return (
            <Link key={t.id} to="/app/teams/$teamId" params={{ teamId: t.id }}>
              <Card className="h-full border-border/60 hover:border-gold/50 hover:shadow-md transition">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="font-display text-xl">{t.name}</CardTitle>
                    {t.section && <span className="text-xs rounded-full bg-secondary px-2 py-0.5">§{t.section}</span>}
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {cf ? (
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-gold" />
                      <span className="text-foreground">{cf.company_name}</span>
                      <span className="text-xs">· {cf.industry}</span>
                    </div>
                  ) : (
                    <span className="italic">No company focus yet</span>
                  )}
                  {t.description && <p className="mt-2 line-clamp-2">{t.description}</p>}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
