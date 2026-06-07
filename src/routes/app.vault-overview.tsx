import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExternalLink, MessageSquare, LayoutDashboard } from "lucide-react";
import {
  VAULT_STRUCTURE,
  STATUS_TONE,
  type VaultStatus,
} from "@/lib/vault-structure";

export const Route = createFileRoute("/app/vault-overview")({
  head: () => ({ meta: [{ title: "Vault Overview — ClientVault" }] }),
  component: VaultOverview,
});

type Team = { id: string; name: string; section: string | null };
type Member = { user_id: string; name: string | null; email: string | null; team_id: string };
type FileRow = {
  id: string;
  team_id: string;
  file_name: string;
  section: string;
  subsection: string;
  assigned_to: string | null;
  status: VaultStatus;
  uploaded_by: string;
  updated_at: string;
};
type CommentAgg = { file_id: string; open: number };

const OPEN_STATUSES: VaultStatus[] = ["Submitted", "Awaiting Review", "Needs Revision"];

function VaultOverview() {
  const { isAdmin, loading } = useAuth();
  const [filter, setFilter] = useState<"all" | "03" | "04">("all");

  const { data, isLoading } = useQuery({
    enabled: isAdmin,
    queryKey: ["vault-overview"],
    queryFn: async () => {
      const [teamsRes, filesRes, membersRes, commentsRes] = await Promise.all([
        supabase.from("teams").select("id, name, section").order("name"),
        supabase
          .from("files")
          .select("id, team_id, file_name, section, subsection, assigned_to, status, uploaded_by, updated_at")
          .eq("is_template", false),
        supabase.from("team_members").select("user_id, team_id, profiles(name, email)"),
        supabase
          .from("file_comments" as any)
          .select("file_id, related_status"),
      ]);
      if (teamsRes.error) throw teamsRes.error;
      if (filesRes.error) throw filesRes.error;
      if (membersRes.error) throw membersRes.error;

      const members: Member[] = ((membersRes.data ?? []) as any[]).map((r) => ({
        user_id: r.user_id,
        team_id: r.team_id,
        name: r.profiles?.name ?? null,
        email: r.profiles?.email ?? null,
      }));

      // open-comments count per file (comments tied to a "needs revision" status,
      // or any comment on a file whose status is still in OPEN_STATUSES).
      const commentCount = new Map<string, number>();
      ((commentsRes.data as any[]) ?? []).forEach((c) => {
        commentCount.set(c.file_id, (commentCount.get(c.file_id) ?? 0) + 1);
      });

      return {
        teams: (teamsRes.data ?? []) as Team[],
        files: (filesRes.data ?? []) as FileRow[],
        members,
        commentCount,
      };
    },
  });

  const visibleTeams = useMemo(() => {
    const all = data?.teams ?? [];
    return filter === "all" ? all : all.filter((t) => (t.section ?? "") === filter);
  }, [data, filter]);

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/app/dashboard" />;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-6 w-6 text-gold" />
            <h1 className="font-display text-4xl">Vault Overview</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Every team × every required slot. Spot missing, stalled, or unreviewed work at a glance.
          </p>
        </div>
        <div className="flex items-center gap-1">
          {(["all", "03", "04"] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={filter === s ? "default" : "outline"}
              onClick={() => setFilter(s)}
            >
              {s === "all" ? "All sections" : `§${s}`}
            </Button>
          ))}
        </div>
      </header>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading overview…</p>
      ) : visibleTeams.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            No teams to show.
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" defaultValue={visibleTeams.map((t) => t.id)} className="space-y-2">
          {visibleTeams.map((team) => (
            <TeamOverviewCard
              key={team.id}
              team={team}
              files={(data?.files ?? []).filter((f) => f.team_id === team.id)}
              members={(data?.members ?? []).filter((m) => m.team_id === team.id)}
              commentCount={data?.commentCount ?? new Map()}
            />
          ))}
        </Accordion>
      )}
    </div>
  );
}

function TeamOverviewCard({
  team,
  files,
  members,
  commentCount,
}: {
  team: Team;
  files: FileRow[];
  members: Member[];
  commentCount: Map<string, number>;
}) {
  // Stats roll-up
  const totalSlots = useMemo(() => {
    let n = 0;
    for (const s of VAULT_STRUCTURE) {
      for (const sub of s.subsections) {
        if (sub.perMember) {
          n += members.length + (sub.expectsCompiled ? 1 : 0);
        } else {
          n += 1;
        }
      }
    }
    return n;
  }, [members]);

  const submitted = files.length;
  const needsRevision = files.filter((f) => f.status === "Needs Revision").length;
  const reviewed = files.filter((f) => f.status === "Reviewed" || f.status === "Resolved").length;
  const openComments = files.reduce(
    (acc, f) => acc + (OPEN_STATUSES.includes(f.status) ? commentCount.get(f.id) ?? 0 : 0),
    0,
  );

  return (
    <AccordionItem value={team.id} className="border rounded-md px-3">
      <AccordionTrigger className="hover:no-underline">
        <div className="flex items-center gap-2 flex-wrap text-left">
          <span className="font-display text-lg">{team.name}</span>
          {team.section && (
            <Badge variant="outline" className="text-[10px]">§{team.section}</Badge>
          )}
          <Badge variant="secondary" className="text-[10px]">
            {submitted}/{totalSlots} uploaded
          </Badge>
          {reviewed > 0 && (
            <Badge variant="outline" className="text-[10px] bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
              {reviewed} reviewed
            </Badge>
          )}
          {needsRevision > 0 && (
            <Badge variant="outline" className="text-[10px] bg-rose-500/15 text-rose-400 border-rose-500/30">
              {needsRevision} need revision
            </Badge>
          )}
          {openComments > 0 && (
            <Badge variant="outline" className="text-[10px]">
              <MessageSquare className="h-3 w-3 mr-1" />
              {openComments} open
            </Badge>
          )}
        </div>
      </AccordionTrigger>
      <AccordionContent className="pb-4">
        <div className="flex justify-end mb-2">
          <Button asChild size="sm" variant="outline">
            <Link to="/app/vault" search={{ team: team.id } as never}>
              <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open vault
            </Link>
          </Button>
        </div>
        <div className="border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[35%]">Slot</TableHead>
                <TableHead className="w-[20%]">Assigned to</TableHead>
                <TableHead className="w-[20%]">Status</TableHead>
                <TableHead className="w-[15%]">Updated</TableHead>
                <TableHead className="w-[10%] text-right">Comments</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {VAULT_STRUCTURE.flatMap((section) =>
                section.subsections.flatMap((sub) => {
                  const slots: { label: string; assignee?: Member; file?: FileRow }[] = [];
                  const subFiles = files.filter(
                    (f) => f.section === section.name && f.subsection === sub.name,
                  );

                  if (sub.perMember && members.length > 0) {
                    for (const m of members) {
                      slots.push({
                        label: `${section.name} › ${sub.name}`,
                        assignee: m,
                        file: subFiles.find((f) => f.assigned_to === m.user_id),
                      });
                    }
                    if (sub.expectsCompiled) {
                      slots.push({
                        label: `${section.name} › ${sub.name} (Final Compiled)`,
                        file: subFiles.find(
                          (f) => !f.assigned_to && /compiled|final/i.test(f.file_name),
                        ),
                      });
                    }
                  } else {
                    slots.push({
                      label: `${section.name} › ${sub.name}`,
                      file: subFiles[0],
                    });
                  }

                  return slots.map((s, idx) => {
                    const f = s.file;
                    const status: VaultStatus = f?.status ?? "Missing";
                    const open = f ? commentCount.get(f.id) ?? 0 : 0;
                    return (
                      <TableRow key={`${section.name}-${sub.name}-${idx}`}>
                        <TableCell className="text-xs">{s.label}</TableCell>
                        <TableCell className="text-xs">
                          {s.assignee ? s.assignee.name || s.assignee.email || "—" : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] ${STATUS_TONE[status]}`}>
                            {status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {f ? new Date(f.updated_at).toLocaleDateString() : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {open > 0 ? (
                            <Link
                              to="/app/vault"
                              search={{ team: team.id, file: f?.id } as never}
                              className="inline-flex items-center gap-1 text-xs underline-offset-2 hover:underline"
                            >
                              <MessageSquare className="h-3 w-3" /> {open}
                            </Link>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  });
                }),
              )}
            </TableBody>
          </Table>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
