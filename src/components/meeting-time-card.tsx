import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, Check, X, CircleDashed } from "lucide-react";
import { toast } from "sonner";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function fmtTime(t: string) {
  // t is "HH:MM[:SS]"
  const [h, m] = t.split(":").map(Number);
  const hr12 = ((h + 11) % 12) + 1;
  const ampm = h < 12 ? "AM" : "PM";
  return `${hr12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function MeetingTimeCard({ teamId }: { teamId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["meeting-time", teamId],
    queryFn: async () => {
      const [{ data: members, error: mErr }, { data: proposal, error: pErr }] = await Promise.all([
        supabase.from("team_members").select("user_id, job_title").eq("team_id", teamId),
        supabase
          .from("team_meeting_proposals")
          .select("*")
          .eq("team_id", teamId)
          .maybeSingle(),
      ]);
      if (mErr) throw mErr;
      if (pErr) throw pErr;

      const userIds = (members ?? []).map((m) => m.user_id);
      let profiles: any[] = [];
      if (userIds.length) {
        const { data: pData } = await supabase
          .from("profiles")
          .select("id, name, initials")
          .in("id", userIds);
        profiles = pData ?? [];
      }
      const pmap = new Map(profiles.map((p) => [p.id, p]));

      let agreements: any[] = [];
      if (proposal) {
        const { data: agData, error: aErr } = await supabase
          .from("team_meeting_agreements")
          .select("*")
          .eq("proposal_id", proposal.id);
        if (aErr) throw aErr;
        agreements = agData ?? [];
      }
      const amap = new Map(agreements.map((a) => [a.user_id, a]));

      const roster = (members ?? []).map((m) => ({
        user_id: m.user_id,
        job_title: m.job_title,
        name: pmap.get(m.user_id)?.name ?? "Unknown",
        savedInitials: pmap.get(m.user_id)?.initials ?? "",
        agreement: amap.get(m.user_id) ?? null,
      }));

      return { proposal, roster };
    },
  });

  const proposal = data?.proposal;
  const roster = data?.roster ?? [];
  const me = roster.find((r) => r.user_id === user?.id);
  const isPM = me?.job_title === "PM";
  const allAgreed =
    !!proposal && roster.length > 0 && roster.every((r) => r.agreement?.status === "agreed");

  // PM form state
  const [day, setDay] = useState<string>("");
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    if (proposal) {
      setDay(String(proposal.day_of_week));
      setTime(proposal.meeting_time.slice(0, 5));
    }
  }, [proposal?.id, proposal?.day_of_week, proposal?.meeting_time]);

  const saveProposal = useMutation({
    mutationFn: async () => {
      if (day === "" || !time) throw new Error("Pick a day and time");
      const payload = {
        team_id: teamId,
        day_of_week: Number(day),
        meeting_time: time,
        proposed_by: user!.id,
      };
      if (proposal) {
        const { error } = await supabase
          .from("team_meeting_proposals")
          .update({ day_of_week: payload.day_of_week, meeting_time: payload.meeting_time, proposed_by: user!.id })
          .eq("id", proposal.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("team_meeting_proposals").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Proposal saved — teammates can now agree");
      qc.invalidateQueries({ queryKey: ["meeting-time", teamId] });
      qc.invalidateQueries({ queryKey: ["admin-consensus"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Member response
  const [initials, setInitials] = useState("");
  useEffect(() => {
    if (me?.agreement?.initials) setInitials(me.agreement.initials);
    else if (me?.savedInitials) setInitials(me.savedInitials);
  }, [me?.agreement?.initials, me?.savedInitials]);

  const respond = useMutation({
    mutationFn: async (status: "agreed" | "declined") => {
      if (!proposal) throw new Error("No proposal yet");
      const cleaned = initials.trim().toUpperCase();
      if (!/^[A-Z]{2,4}$/.test(cleaned)) throw new Error("Enter 2–4 letter initials");
      // upsert
      const { error } = await supabase
        .from("team_meeting_agreements")
        .upsert(
          {
            proposal_id: proposal.id,
            team_id: teamId,
            user_id: user!.id,
            initials: cleaned,
            status,
            responded_at: new Date().toISOString(),
          },
          { onConflict: "proposal_id,user_id" },
        );
      if (error) throw error;
      // cache initials on profile
      await supabase.from("profiles").update({ initials: cleaned }).eq("id", user!.id);
    },
    onSuccess: (_d, status) => {
      toast.success(status === "agreed" ? "Agreement recorded" : "Marked as declined");
      qc.invalidateQueries({ queryKey: ["meeting-time", teamId] });
      qc.invalidateQueries({ queryKey: ["admin-consensus"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="mt-6 border-border/60">
      <CardHeader>
        <CardTitle className="font-display text-2xl flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-gold" />
          Weekly Meeting Time
          {allAgreed && (
            <Badge className="ml-2 bg-emerald-600 hover:bg-emerald-600">Consensus reached</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            {proposal ? (
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="text-xs text-muted-foreground">Current proposal</div>
                <div className="font-medium text-lg">
                  {DAYS[proposal.day_of_week]} at {fmtTime(proposal.meeting_time)}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                No meeting time proposed yet. {isPM ? "As PM, propose one below." : "Waiting on the PM to propose a time."}
              </p>
            )}

            {/* PM form */}
            {isPM && (
              <div className="space-y-2 rounded-md border border-dashed p-3">
                <div className="text-xs font-medium uppercase tracking-wide text-gold">
                  PM: {proposal ? "Update" : "Propose"} meeting time
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_auto] gap-2 items-end">
                  <div>
                    <Label className="text-xs">Day</Label>
                    <Select value={day} onValueChange={setDay}>
                      <SelectTrigger><SelectValue placeholder="Pick a day" /></SelectTrigger>
                      <SelectContent>
                        {DAYS.map((d, i) => (
                          <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Time</Label>
                    <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                  </div>
                  <Button onClick={() => saveProposal.mutate()} disabled={saveProposal.isPending}>
                    {proposal ? "Update" : "Submit"}
                  </Button>
                </div>
                {proposal && (
                  <p className="text-xs text-muted-foreground">
                    Changing day/time will reset everyone's agreement.
                  </p>
                )}
              </div>
            )}

            {/* Roster + statuses */}
            <div>
              <div className="text-sm font-medium mb-2">
                Team agreement ({roster.filter((r) => r.agreement?.status === "agreed").length}/{roster.length})
              </div>
              <ul className="divide-y rounded-md border">
                {roster.map((r) => {
                  const isMe = r.user_id === user?.id;
                  const status = r.agreement?.status;
                  return (
                    <li key={r.user_id} className="p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {r.name} {isMe && <span className="text-xs text-muted-foreground">(you)</span>}
                        </div>
                        <div className="text-xs text-gold">{r.job_title}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {status === "agreed" && (
                          <Badge className="bg-emerald-600 hover:bg-emerald-600">
                            <Check className="h-3 w-3 mr-1" />
                            Agreed · {r.agreement!.initials}
                          </Badge>
                        )}
                        {status === "declined" && (
                          <Badge variant="destructive">
                            <X className="h-3 w-3 mr-1" />
                            Declined · {r.agreement!.initials}
                          </Badge>
                        )}
                        {!status && (
                          <Badge variant="outline" className="text-muted-foreground">
                            <CircleDashed className="h-3 w-3 mr-1" />
                            Pending
                          </Badge>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* My response — every member including PM signs off with initials */}
            {me && proposal && (
              <div className="rounded-md border p-3 space-y-2">
                <div className="text-xs font-medium uppercase tracking-wide">
                  {isPM ? "Confirm your own proposal" : "Your response"}
                </div>
                <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                  <div className="flex-1">
                    <Label className="text-xs">Your initials (2–4 letters)</Label>
                    <Input
                      value={initials}
                      onChange={(e) => setInitials(e.target.value.toUpperCase())}
                      maxLength={4}
                      placeholder="e.g. JLD"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => respond.mutate("agreed")} disabled={respond.isPending}>
                      <Check className="h-4 w-4 mr-1" /> Agree
                    </Button>
                    {!isPM && (
                      <Button
                        variant="outline"
                        onClick={() => respond.mutate("declined")}
                        disabled={respond.isPending}
                      >
                        <X className="h-4 w-4 mr-1" /> Decline
                      </Button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Your initials act as your e-signature on this meeting time.
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
