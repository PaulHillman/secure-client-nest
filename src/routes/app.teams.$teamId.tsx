import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Phone, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { FileVault } from "@/components/file-vault";
import { ManagerSubmissions } from "@/components/manager-submissions";
import { CompanyFocusCard } from "@/components/company-focus-card";
import { ProjectArchCard } from "@/components/project-arch-card";
import { MeetingTimeCard } from "@/components/meeting-time-card";

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
          .select("id, name, email, avatar_url, section, phone_number")
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
        <TeamNameHeader
          team={team as any}
          isLoading={isLoading}
          canEdit={isMember}
          onSaved={() => refetch()}
        />
      </header>


      <CompanyFocusCard teamId={teamId} cf={cf as any} queryKey={["team", teamId]} />

      <div className="mt-6">
        <ProjectArchCard variant="wide" />
      </div>

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
            {members.map((m) => (
              <MemberCard key={m.id} member={m} teamId={teamId} />
            ))}
          </div>
        )}
      </section>

      <MeetingTimeCard teamId={teamId} />

      <ManagerSubmissions teamId={teamId} />

      <FileVault teamId={teamId} />

    </div>
  );
}

function MemberCard({
  member,
  teamId,
}: {
  member: any;
  teamId: string;
}) {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const p = member.profiles;
  const displayName = p?.name ?? "Unlinked team member";
  const canEdit = !!p && (p.id === user?.id || isAdmin);

  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState(p?.phone_number ?? "");

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ phone_number: phone.trim() || null })
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Phone updated");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["team", teamId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function initials(name: string) {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? "")
      .join("");
  }

  return (
    <Card className="border-border/60">
      <CardContent className="p-4 flex items-start gap-3">
        <Avatar className="h-14 w-14">
          <AvatarImage src={p?.avatar_url ?? undefined} alt={displayName} />
          <AvatarFallback>{initials(displayName)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="font-medium truncate">{displayName}</div>
          <div className="text-xs text-gold">{member.job_title}</div>
          {p?.email && (
            <a
              href={`mailto:${p.email}`}
              className="text-xs text-muted-foreground truncate block hover:text-foreground"
            >
              {p.email}
            </a>
          )}
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Phone className="h-3 w-3" />
            {editing ? (
              <div className="flex items-center gap-1 flex-1">
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="555-555-5555"
                  className="h-7 text-xs"
                  maxLength={30}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => save.mutate()}
                  aria-label="Save"
                >
                  <Check className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => {
                    setPhone(p?.phone_number ?? "");
                    setEditing(false);
                  }}
                  aria-label="Cancel"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <>
                {p?.phone_number ? (
                  <a href={`tel:${p.phone_number}`} className="hover:text-foreground">
                    {p.phone_number}
                  </a>
                ) : (
                  <span className="italic">No phone</span>
                )}
                {canEdit && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-5 w-5 ml-1"
                    onClick={() => setEditing(true)}
                    aria-label="Edit phone"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
