import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StudentAvatar } from "@/components/student-avatar";
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
import { CalendarClock, MapPin, Video } from "lucide-react";
import { toast } from "sonner";
import { FACE_TO_FACE } from "@/lib/meeting-agreement";
import { notifyMeetingChange } from "@/lib/meeting.functions";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];


function fmtTime(t: string) {
  // t is "HH:MM[:SS]"
  const [h, m] = t.split(":").map(Number);
  const hr12 = ((h + 11) % 12) + 1;
  const ampm = h < 12 ? "AM" : "PM";
  return `${hr12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function MeetingTimeCard({ teamId }: { teamId: string }) {
  const { user, viewAs } = useAuth();
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
          .select("id, name, initials, email, avatar_url")
          .in("id", userIds);
        profiles = pData ?? [];
      }
      const pmap = new Map(profiles.map((p) => [p.id, p]));

      const roster = (members ?? []).map((m) => ({
        user_id: m.user_id,
        job_title: m.job_title,
        name: pmap.get(m.user_id)?.name ?? "Unknown",
        email: pmap.get(m.user_id)?.email ?? null,
        avatarUrl: pmap.get(m.user_id)?.avatar_url ?? null,
      }));

      return { proposal, roster };
    },
  });

  const proposal = data?.proposal;
  const roster = data?.roster ?? [];
  const me = roster.find((r) => r.user_id === user?.id);
  const isPM = me?.job_title === "PM";

  // PM form state
  const [day, setDay] = useState<string>("");
  const [time, setTime] = useState<string>("");
  const [location, setLocation] = useState<string>("");

  useEffect(() => {
    if (proposal) {
      setDay(String(proposal.day_of_week));
      setTime(proposal.meeting_time.slice(0, 5));
      setLocation((proposal as any).location ?? "");
    }
  }, [proposal?.id, proposal?.day_of_week, proposal?.meeting_time]);

  const saveProposal = useMutation({
    mutationFn: async () => {
      if (day === "" || !time) throw new Error("Pick a day and time");
      const fields = {
        day_of_week: Number(day),
        meeting_time: time,
        location: location.trim() || null,
        meeting_mode: FACE_TO_FACE,
        mode_choice_1: null,
        mode_choice_2: null,
        mode_choice_3: null,
      };
      let changed = false;
      if (proposal) {
        changed =
          proposal.day_of_week !== fields.day_of_week ||
          proposal.meeting_time.slice(0, 5) !== fields.meeting_time ||
          ((proposal as any).location ?? null) !== fields.location ||
          ((proposal as any).meeting_mode ?? null) !== fields.meeting_mode;
        const { error } = await supabase
          .from("team_meeting_proposals")
          .update({ ...fields, proposed_by: user!.id })
          .eq("id", proposal.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("team_meeting_proposals")
          .insert({ ...fields, team_id: teamId, proposed_by: user!.id });
        if (error) throw error;
      }
      if (changed) {
        try {
          await notifyMeetingChange({
            data: {
              teamId,
              message: `Meeting time changed to ${DAYS[fields.day_of_week]} ${fmtTime(fields.meeting_time)}${
                fields.location ? ` · ${fields.location}` : ""
              }${fields.meeting_mode ? ` · ${fields.meeting_mode}` : ""}.`,
            },
          });
        } catch {
          /* notification is best-effort */
        }
      }
      return changed;
    },
    onSuccess: (changed) => {
      toast.success(
        changed
          ? "Meeting details updated — Professor Hillman was notified"
          : "Meeting time saved",
      );
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
                <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {(proposal as any).location || <span className="italic">No place set</span>}
                </div>
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <Video className="h-3.5 w-3.5" />
                  {(proposal as any).meeting_mode || <span className="italic">No mode set</span>}
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
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-2 items-end">
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
                </div>
                <div>
                  <Label className="text-xs">Where will you meet?</Label>
                  <Input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Pew Library, 4th floor"
                    maxLength={200}
                  />
                </div>
                <p className="text-xs rounded-md border border-gold/40 bg-gold/10 px-3 py-2 text-foreground">
                  Meetings must be held <span className="font-medium">in person, face to face</span>.
                  Meeting over Zoom or virtually is not an option for this course.
                </p>
                <div>
                  <Button onClick={() => saveProposal.mutate()} disabled={saveProposal.isPending}>
                    {proposal ? "Update" : "Submit"}
                  </Button>
                </div>
                {proposal && (
                  <p className="text-xs text-muted-foreground">
                    Changing the day, time, or place notifies Professor Hillman.
                  </p>
                )}

              </div>
            )}

            {/* Roster */}
            <div>
              <div className="text-sm font-medium mb-2">Team members</div>
              <ul className="divide-y rounded-md border">
                {roster.map((r) => {
                  const isMe = r.user_id === user?.id;
                  return (
                    <li key={r.user_id} className="p-3 flex items-center gap-3">
                      <StudentAvatar name={r.name} email={r.email} avatarUrl={r.avatarUrl} size={32} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {r.name} {isMe && <span className="text-xs text-muted-foreground">(you)</span>}
                        </div>
                        <div className="text-xs text-gold">{r.job_title}</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

          </>
        )}
      </CardContent>
    </Card>
  );
}
