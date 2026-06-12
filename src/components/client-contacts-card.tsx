import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Mail,
  MapPin,
  Users,
  Network,
  FileQuestion,
  ArrowRight,
} from "lucide-react";

export function ClientContactsCard() {
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-client-contacts"],
    queryFn: async () => {
      const [{ data: teams, error: tErr }, { data: cf, error: cErr }, { data: orgFiles, error: fErr }] =
        await Promise.all([
          supabase.from("teams").select("id, name").order("name"),
          supabase.from("company_focus").select("*"),
          supabase
            .from("files")
            .select("id, team_id, file_name, subsection, created_at")
            .eq("subsection", "Organizational Chart"),
        ]);
      if (tErr) throw tErr;
      if (cErr) throw cErr;
      if (fErr) throw fErr;

      const cfMap = new Map((cf ?? []).map((c) => [c.team_id, c]));
      const orgMap = new Map<string, any>();
      (orgFiles ?? []).forEach((f) => {
        // keep most recent per team
        const existing = orgMap.get(f.team_id);
        if (!existing || new Date(f.created_at) > new Date(existing.created_at)) {
          orgMap.set(f.team_id, f);
        }
      });

      return (teams ?? [])
        .map((t) => ({
          id: t.id,
          name: t.name,
          cf: cfMap.get(t.id) ?? null,
          orgChart: orgMap.get(t.id) ?? null,
        }))
        .sort((a, b) => {
          // teams missing company info first
          const aMissing = !a.cf?.company_name ? 0 : 1;
          const bMissing = !b.cf?.company_name ? 0 : 1;
          if (aMissing !== bMissing) return aMissing - bMissing;
          return a.name.localeCompare(b.name);
        });
    },
  });

  const rows = data ?? [];

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="font-display text-2xl flex items-center gap-2">
          <Building2 className="h-5 w-5 text-gold" />
          Client contacts & companies
        </CardTitle>
        <Badge variant="outline">{rows.length} teams</Badge>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No teams yet.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {rows.map((t) => {
              const open = openId === t.id;
              const cf = t.cf;
              const missing = !cf?.company_name;
              return (
                <li key={t.id}>
                  <button
                    onClick={() => setOpenId(open ? null : t.id)}
                    className="w-full p-3 flex items-center gap-3 text-left hover:bg-muted/40 transition-colors"
                  >
                    {open ? (
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{t.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {missing ? (
                          <span className="italic">No company set yet</span>
                        ) : (
                          <>
                            {cf!.company_name}
                            {cf!.contact_person && (
                              <span> · Interviewing {cf!.contact_person}</span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {t.orgChart ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-600 text-[10px]">
                          <Network className="h-3 w-3 mr-1" />
                          Org chart
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          <FileQuestion className="h-3 w-3 mr-1" />
                          No org chart
                        </Badge>
                      )}
                    </div>
                  </button>

                  {open && (
                    <div className="px-3 pb-4 pt-1 bg-muted/20 border-t">
                      {missing ? (
                        <div className="text-sm text-muted-foreground italic py-2">
                          This team has not filled in their client company yet.
                        </div>
                      ) : (
                        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                          <Field label="Company" value={cf!.company_name} icon={Building2} />
                          <Field label="Industry" value={cf!.industry} />
                          <Field
                            label="Employees"
                            value={cf!.employee_count}
                            icon={Users}
                          />
                          <Field
                            label="Website"
                            value={
                              cf!.website ? (
                                <a
                                  href={normalizeUrl(cf!.website)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-foreground hover:underline inline-flex items-center gap-1"
                                >
                                  {cf!.website}
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : null
                            }
                          />
                          <Field
                            label="HQ Address"
                            value={cf!.hq_address}
                            icon={MapPin}
                            wide
                          />
                          <div className="sm:col-span-2 border-t pt-3 mt-1">
                            <div className="text-xs font-semibold uppercase tracking-wide text-gold mb-2">
                              Interviewee
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                              <Field label="Name" value={cf!.contact_person} />
                              <Field label="Title" value={cf!.contact_job_title} />
                              <Field
                                label="Email"
                                value={
                                  cf!.email ? (
                                    <a
                                      href={`mailto:${cf!.email}`}
                                      className="text-foreground hover:underline inline-flex items-center gap-1"
                                    >
                                      {cf!.email}
                                      <Mail className="h-3 w-3" />
                                    </a>
                                  ) : null
                                }
                              />
                            </div>
                          </div>
                        </dl>
                      )}

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link to="/app/teams/$teamId" params={{ teamId: t.id }}>
                            Open team page <ArrowRight className="h-3 w-3 ml-1" />
                          </Link>
                        </Button>
                        {t.orgChart && (
                          <Button asChild size="sm" variant="outline">
                            <Link
                              to="/app/teams/$teamId"
                              params={{ teamId: t.id }}
                              hash="vault"
                            >
                              <Network className="h-3 w-3 mr-1" />
                              View org chart ({t.orgChart.file_name})
                            </Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  icon: Icon,
  wide,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  wide?: boolean;
}) {
  const display = value || <span className="italic text-muted-foreground">—</span>;
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="text-xs text-muted-foreground flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </dt>
      <dd className="font-medium">{display}</dd>
    </div>
  );
}

function normalizeUrl(url: string) {
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}
