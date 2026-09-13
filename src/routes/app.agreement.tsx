import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, CalendarClock, CheckCircle2, MapPin, Video } from "lucide-react";
import { toast } from "sonner";
import {
  AGREEMENT_CLAUSES,
  AGREEMENT_VERSION,
  meetingDetailsLine,
} from "@/lib/meeting-agreement";
import { respondMeetingAgreement } from "@/lib/meeting.functions";

export const Route = createFileRoute("/app/agreement")({
  head: () => ({
    meta: [
      { title: "Meeting Time Agreement — ClientVault" },
      {
        name: "description",
        content:
          "Read and sign your team's weekly meeting time agreement: day, time, place, mode, and who owns a schedule change.",
      },
      { property: "og:title", content: "Meeting Time Agreement — ClientVault" },
      {
        property: "og:description",
        content: "Sign your team's weekly meeting time agreement in ClientVault.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AgreementPage,
});

function AgreementPage() {
  const { user, viewAs } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["my-meeting-agreement", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: memberships, error: mErr } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", user!.id);
      if (mErr) throw mErr;
      const teamId = memberships?.[0]?.team_id ?? null;
      if (!teamId) return { teamId: null, team: null, proposal: null, mine: null, roster: [] };

      const [{ data: team }, { data: proposal }, { data: members }] = await Promise.all([
        supabase.from("teams").select("id, name, display_name, section").eq("id", teamId).maybeSingle(),
        supabase.from("team_meeting_proposals").select("*").eq("team_id", teamId).maybeSingle(),
        supabase.from("team_members").select("user_id").eq("team_id", teamId),
      ]);

      let agreements: any[] = [];
      if (proposal) {
        const { data: ag } = await supabase
          .from("team_meeting_agreements")
          .select("*")
          .eq("proposal_id", proposal.id);
        agreements = ag ?? [];
      }
      return {
        teamId,
        team,
        proposal,
        mine: agreements.find((a) => a.user_id === user!.id) ?? null,
        agreedCount: agreements.filter((a) => a.status === "agreed").length,
        total: (members ?? []).length,
        roster: members ?? [],
      };
    },
  });

  const proposal = data?.proposal;
  const mine = data?.mine;
  const team = data?.team;

  const [fullName, setFullName] = useState("");
  const [initials, setInitials] = useState("");
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (mine) {
      setFullName(mine.full_name ?? "");
      setInitials(mine.initials ?? "");
      setChecked(mine.status === "agreed");
    }
  }, [mine?.id]);

  const details = proposal ? meetingDetailsLine(proposal) : "";

  const sign = useMutation({
    mutationFn: async () => {
      if (!proposal) throw new Error("Your Project Manager has not set a meeting time yet");
      if (!checked) throw new Error("Tick the box to confirm you agree");
      const name = fullName.trim();
      const cleaned = initials.trim().toUpperCase();
      if (name.length < 3) throw new Error("Type your full name");
      if (!/^[A-Z]{2,4}$/.test(cleaned)) throw new Error("Enter 2–4 letter initials");
      await respondMeetingAgreement({
        data: {
          teamId: data!.teamId!,
          status: "agreed",
          initials: cleaned,
          fullName: name,
          studentId: viewAs?.id,
        },
      });
    },
    onSuccess: () => {
      toast.success("Agreement signed and recorded");
      qc.invalidateQueries({ queryKey: ["my-meeting-agreement", user?.id] });
      qc.invalidateQueries({ queryKey: ["meeting-time", data?.teamId] });
      qc.invalidateQueries({ queryKey: ["admin-consensus"] });
      qc.invalidateQueries({ queryKey: ["meeting-commitment"] });
      qc.invalidateQueries({ queryKey: ["dashboard-team-readiness"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const signed = mine?.status === "agreed";

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="font-display text-4xl">Team Meeting Agreement</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Every member of the team must read and sign this agreement.
      </p>

      {isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
      ) : !data?.teamId ? (
        <Card className="mt-6 border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            You are not assigned to a team yet.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="mt-6 border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-2xl flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-gold" />
                {team?.display_name?.trim() || team?.name}
                {signed && (
                  <Badge className="bg-emerald-600 hover:bg-emerald-600 ml-2">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Signed
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {proposal ? (
                <>
                  <div className="text-lg font-medium">
                    {meetingDetailsLine({ ...proposal, location: null, meeting_mode: null })}
                  </div>
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {proposal.location || <span className="italic">No place set yet</span>}
                  </div>
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Video className="h-4 w-4" />
                    {proposal.meeting_mode || <span className="italic">No meeting mode set yet</span>}
                  </div>
                  <div className="text-xs text-muted-foreground pt-1">
                    {data.agreedCount} of {data.total} team members have signed.
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Your Project Manager has not proposed a meeting time yet. Once they do, come back
                  here to sign.{" "}
                  <Link
                    to="/app/teams/$teamId"
                    params={{ teamId: data.teamId }}
                    className="underline underline-offset-4 text-foreground"
                  >
                    Go to your team page
                  </Link>
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="mt-6 border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-2xl">The agreement</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal pl-5 space-y-3 text-sm leading-relaxed">
                {AGREEMENT_CLAUSES.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ol>
              <p className="text-xs text-muted-foreground mt-4">Version {AGREEMENT_VERSION}</p>
            </CardContent>
          </Card>

          {proposal && (
            <Card className="mt-6 border-gold/40">
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-2xl">
                  {signed ? "Your signature" : "Sign the agreement"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                  <div>
                    <Label className="text-xs">Your full name</Label>
                    <Input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Jane L. Doe"
                      maxLength={80}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Initials (2–4 letters)</Label>
                    <Input
                      value={initials}
                      onChange={(e) => setInitials(e.target.value.toUpperCase())}
                      maxLength={4}
                      placeholder="JLD"
                    />
                  </div>
                </div>
                <label className="flex items-start gap-3 text-sm">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => setChecked(v === true)}
                    className="mt-0.5"
                  />
                  <span>
                    I have read the agreement above and I agree to the meeting day, time, place and
                    mode listed for my team.
                  </span>
                </label>
                <Button onClick={() => sign.mutate()} disabled={sign.isPending}>
                  {signed ? "Update my signature" : "Sign agreement"}
                </Button>
                {signed && mine?.responded_at && (
                  <p className="text-xs text-muted-foreground">
                    Signed {new Date(mine.responded_at).toLocaleString()} as {mine.full_name ?? mine.initials}.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
