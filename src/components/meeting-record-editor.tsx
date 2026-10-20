import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { readMeetingAttendance, validateMeetingAttendance } from "@/lib/meeting-record";
import { toast } from "sonner";

type Meeting = Database["public"]["Tables"]["meeting_logs"]["Row"];
type Props = {
  meeting: Meeting;
  members: { user_id: string; job_title: string }[];
  names: Map<string, string>;
  proposal: { meeting_time: string; location: string | null; meeting_mode: string | null } | null;
  onClose: () => void;
};

export function MeetingRecordEditor({ meeting, members, names, proposal, onClose }: Props) {
  const qc = useQueryClient();
  const [date, setDate] = useState(meeting.meeting_date);
  const [time, setTime] = useState(meeting.meeting_time.slice(0, 5));
  const [location, setLocation] = useState(meeting.location);
  const [minutes, setMinutes] = useState(meeting.minutes_posted);
  const [reason, setReason] = useState(meeting.deviation_reason ?? "");
  const [attendance, setAttendance] = useState(() => {
    const existing = readMeetingAttendance(meeting.attendance);
    return [...members.map((member) => existing.find((entry) => entry.user_id === member.user_id) ?? { user_id: member.user_id, status: "present" as const, reason: null }), ...existing.filter((entry) => !members.some((member) => member.user_id === entry.user_id))];
  });
  const save = useMutation({
    mutationFn: async () => {
      if (!date || !time || !location.trim()) throw new Error("Enter the date, time and place");
      const corrected = validateMeetingAttendance(attendance);
      const detailsChanged = time !== meeting.meeting_time.slice(0, 5) || location.trim() !== meeting.location;
      const asAgreed = detailsChanged ? !!proposal && time === proposal.meeting_time.slice(0, 5) && location.trim().toLowerCase() === (proposal.location ?? "").trim().toLowerCase() && meeting.meeting_mode === proposal.meeting_mode : meeting.as_agreed;
      const { error } = await supabase.from("meeting_logs").update({
        meeting_date: date, meeting_time: time, location: location.trim(), attendance: corrected,
        minutes_posted: minutes, deviation_reason: reason.trim() || null, as_agreed: asAgreed,
      }).eq("id", meeting.id).eq("team_id", meeting.team_id).select("id").single();
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["meeting-logs", meeting.team_id] });
      await qc.invalidateQueries({ queryKey: ["meeting-gaps"] });
      toast.success("Meeting record updated");
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return <Dialog open onOpenChange={(open) => { if (!open && !save.isPending) onClose(); }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl" aria-describedby={undefined}>
      <DialogHeader><DialogTitle>Edit meeting record</DialogTitle></DialogHeader>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label htmlFor="edit-meeting-date">Date of meeting</Label><Input id="edit-meeting-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
          <div className="space-y-1"><Label htmlFor="edit-meeting-time">Start time</Label><Input id="edit-meeting-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required /></div>
        </div>
        <div className="space-y-1"><Label htmlFor="edit-meeting-location">Where it was held</Label><Input id="edit-meeting-location" value={location} onChange={(e) => setLocation(e.target.value)} required /></div>
        <fieldset className="space-y-3"><legend className="text-sm font-medium">Attendance</legend>
          {attendance.map((entry) => <div key={entry.user_id} className="space-y-2 border-b border-border pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">{names.get(entry.user_id) ?? "Former team member"}</span>
              <div className="flex gap-1" role="group" aria-label={`Attendance for ${names.get(entry.user_id) ?? entry.user_id}`}>
                {(["present", "late", "absent"] as const).map((status) => <Button key={status} type="button" size="sm" variant={entry.status === status ? "default" : "outline"} aria-pressed={entry.status === status} onClick={() => setAttendance((entries) => entries.map((item) => item.user_id === entry.user_id ? { ...item, status } : item))}>{status === "present" ? "Present" : status === "late" ? "Late" : "Missed"}</Button>)}
              </div>
            </div>
            {entry.status !== "present" && <Input aria-label={`Reason for ${names.get(entry.user_id) ?? entry.user_id}`} placeholder={entry.status === "absent" ? "Reason for missing (required)" : "How late / why?"} required={entry.status === "absent"} value={entry.reason ?? ""} onChange={(e) => setAttendance((entries) => entries.map((item) => item.user_id === entry.user_id ? { ...item, reason: e.target.value } : item))} />}
          </div>)}
        </fieldset>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={minutes} onChange={(e) => setMinutes(e.target.checked)} />Minutes are posted in the vault</label>
        <div className="space-y-1"><Label htmlFor="edit-meeting-reason">Reason for a changed place or time</Label><Textarea id="edit-meeting-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} /></div>
        <DialogFooter className="gap-2"><Button type="button" variant="outline" disabled={save.isPending} onClick={onClose}>Cancel</Button><Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save changes"}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}