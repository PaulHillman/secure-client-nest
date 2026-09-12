import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { NotebookPen, AlertTriangle, MapPin, Check } from "lucide-react";
import { toast } from "sonner";
import { FACE_TO_FACE, DAYS, fmtTime } from "@/lib/meeting-agreement";
import { notifyMeetingMoved } from "@/lib/meeting.functions";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function MeetingLogCard({ teamId }: { teamId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["meeting-logs", teamId],
    queryFn: async () => {
      const [{ data: proposal }, { data: logs, error }, { data: members }, { data: profiles }] =
        await Promise.all([
          supabase.from("team_meeting_proposals").select("*").eq("team_id", teamId).maybeSingle(),
          supabase
            .from("meeting_logs")
            .select("*")
            .eq("team_id", teamId)
            .order("meeting_date", { ascending: false }),
          supabase.from("team_members").select("user_id, job_title").eq("team_id", teamId),
          supabase.from("profiles").select("id, name"),
        ]);
      if (error) throw error;
      return { proposal, logs: logs ?? [], members: members ?? [], profiles: profiles ?? [] };
    },
  });

  const proposal = data?.proposal as any;
  const logs = data?.logs ?? [];
  const nameById = new Map((data?.profiles ?? []).map((p: any) => [p.id, p.name]));
  const myJob = (data?.members ?? []).find((m: any) => m.user_id === user?.id)?.job_title;
  const canLog = !!myJob;
  const owner = (data?.members ?? []).find((m: any) => m.job_title === "Communication Specialist");

  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  // Meetings are always face to face; no mode choice is offered.
  const mode = FACE_TO_FACE;
  const [minutes, setMinutes] = useState(false);
  const [reasonFor, setReasonFor] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const agreedLocation = (proposal?.location ?? "").trim().toLowerCase();
  const agreedTime = (proposal?.meeting_time ?? "").slice(0, 5);
  const agreedMode = proposal?.meeting_mode ?? "";
  const matches =
    !!proposal &&
    location.trim().toLowerCase() === agreedLocation &&
    time === agreedTime &&
    (mode || "") === (agreedMode || "");

  const save = useMutation({
    mutationFn: async () => {
      if (!date || !time || !location.trim()) throw new Error("Enter the date, time and place");
      const { data: row, error } = await supabase
        .from("meeting_logs")
        .upsert(
          {
            team_id: teamId,
            meeting_date: date,
            meeting_time: time,
            location: location.trim(),
            meeting_mode: mode || null,
            as_agreed: matches,
            minutes_posted: minutes,
            logged_by: user!.id,
          },
          { onConflict: "team_id,meeting_date" },
        )
        .select()
        .single();
      if (error) throw error;
      return row;
    },
    onSuccess: (row: any) => {
      toast.success(
        row.as_agreed
          ? "Meeting confirmed in the agreed place and time"
          : "Meeting logged — please give a reason it was moved",
      );
      if (!row.as_agreed) setReasonFor(row.id);
      setTime("");
      setLocation("");
      setMinutes(false);
      qc.invalidateQueries({ queryKey: ["meeting-logs", teamId] });
      qc.invalidateQueries({ queryKey: ["meeting-gaps"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendReason = useMutation({
    mutationFn: async (log: any) => {
      const text = reason.trim();
      if (text.length < 5) throw new Error("Please explain why the meeting moved");
      const { error } = await supabase
        .from("meeting_logs")
        .update({ deviation_reason: text })
        .eq("id", log.id);
      if (error) throw error;
      await notifyMeetingMoved({
        data: {
          teamId,
          message: `Meeting on ${fmtDate(log.meeting_date)} was held at ${fmtTime(
            log.meeting_time,
          )} in "${log.location}" instead of the agreed ${
            proposal
              ? `${DAYS[proposal.day_of_week]} ${fmtTime(proposal.meeting_time)}${
                  proposal.location ? ` in "${proposal.location}"` : ""
                }`
              : "arrangement"
          }. Reason: ${text}`,
        },
      });
    },
    onSuccess: () => {
      toast.success("Reason sent to your Project Manager and Professor Hillman");
      setReason("");
      setReasonFor(null);
      qc.invalidateQueries({ queryKey: ["meeting-logs", teamId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMinutes = useMutation({
    mutationFn: async (log: any) => {
      const { error } = await supabase
        .from("meeting_logs")
        .update({ minutes_posted: !log.minutes_posted })
        .eq("id", log.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meeting-logs", teamId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const lastLog = logs[0] as any | undefined;
  const weeksSince = lastLog
    ? Math.floor((Date.now() - new Date(lastLog.meeting_date).getTime()) / (7 * 24 * 3600 * 1000))
    : null;

  return (
    <Card className="mt-6 border-border/60">
      <CardHeader>
        <CardTitle className="font-display text-2xl flex items-center gap-2">
          <NotebookPen className="h-5 w-5 text-gold" />
          Meeting log &amp; minutes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          After every meeting, {owner ? nameById.get(owner.user_id) ?? "the Communication Specialist" : "the Communication Specialist"} confirms when and where the team actually met and whether the minutes were posted.
          {proposal ? (
            <>
              {" "}Agreed: {DAYS[proposal.day_of_week]} at {fmtTime(proposal.meeting_time)}
              {proposal.location ? ` · ${proposal.location}` : ""}
              {proposal.meeting_mode ? ` · ${proposal.meeting_mode}` : ""}.
            </>
          ) : (
            " The team has not agreed a weekly time yet."
          )}
        </p>

        {(weeksSince === null || weeksSince >= 2) && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm flex gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <span>
              {logs.length === 0
                ? "No meetings have been logged for this team yet."
                : `No meeting logged for ${weeksSince} weeks — the team, the Project Manager and the Communication Specialist are all accountable for this.`}
            </span>
          </div>
        )}

        {canLog && (
          <div className="rounded-md border p-3 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Date of meeting</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Start time</Label>
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Where it was actually held</Label>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder={proposal?.location ?? "Room, building or link"}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Meetings are held in person, face to face — Zoom or virtual meetings do not count for
              this course.
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={minutes}
                onChange={(e) => setMinutes(e.target.checked)}
                className="h-4 w-4"
              />
              Minutes have been posted in the vault
            </label>
            {proposal && time && location.trim() && !matches && (
              <p className="text-xs text-amber-500">
                This does not match the agreed place/time — you will be asked for a reason.
              </p>
            )}
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              Confirm this meeting
            </Button>
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : logs.length === 0 ? null : (
          <ul className="space-y-2">
            {logs.map((l: any) => (
              <li key={l.id} className="rounded-md border p-3 text-sm">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-medium">
                      {fmtDate(l.meeting_date)} at {fmtTime(l.meeting_time)}
                    </div>
                    <div className="text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3" />
                      {l.location}
                      {l.meeting_mode ? ` · ${l.meeting_mode}` : ""}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Confirmed by {nameById.get(l.logged_by) ?? "a team member"}
                    </div>
                    {l.deviation_reason && (
                      <div className="text-xs mt-1">Reason given: {l.deviation_reason}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {l.as_agreed ? (
                      <Badge className="bg-emerald-600 hover:bg-emerald-600">
                        <Check className="h-3 w-3 mr-1" />
                        As agreed
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-amber-500 text-amber-500">
                        Moved
                      </Badge>
                    )}
                    <Badge variant={l.minutes_posted ? "secondary" : "outline"}>
                      {l.minutes_posted ? "Minutes posted" : "No minutes"}
                    </Badge>
                    {canLog && (
                      <Button size="sm" variant="ghost" onClick={() => toggleMinutes.mutate(l)}>
                        {l.minutes_posted ? "Mark missing" : "Mark posted"}
                      </Button>
                    )}
                  </div>
                </div>

                {!l.as_agreed && canLog && (
                  <div className="mt-2">
                    {reasonFor === l.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="Why was this meeting moved?"
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => sendReason.mutate(l)} disabled={sendReason.isPending}>
                            Send reason to PM &amp; professor
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setReasonFor(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setReason(l.deviation_reason ?? "");
                          setReasonFor(l.id);
                        }}
                      >
                        <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                        {l.deviation_reason ? "Update reason" : "Give a reason"}
                      </Button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
