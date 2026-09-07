import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Bell, ClipboardList } from "lucide-react";
import { DEFAULT_PM_DUTIES, dutyState, fmtDue } from "@/lib/pm-duties";
import { notifyOverdueDuties } from "@/lib/pm-duties.functions";

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PmDutiesAdminPanel() {
  const qc = useQueryClient();
  const queryKey = ["pm-duties-admin"];
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [due, setDue] = useState("");
  const notify = useServerFn(notifyOverdueDuties);

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const [{ data: duties, error: dErr }, { data: teams, error: tErr }, { data: comps, error: cErr }] =
        await Promise.all([
          supabase
            .from("pm_duties")
            .select("id, title, details, due_at, order_index, active")
            .order("due_at", { ascending: true, nullsFirst: false })
            .order("order_index", { ascending: true }),
          supabase.from("teams").select("id, name, display_name, section"),
          supabase.from("pm_duty_completions").select("duty_id, team_id, completed_at"),
        ]);
      if (dErr) throw dErr;
      if (tErr) throw tErr;
      if (cErr) throw cErr;
      return { duties: duties ?? [], teams: teams ?? [], comps: comps ?? [] };
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Give the responsibility a title");
      const { error } = await supabase.from("pm_duties").insert({
        title: title.trim(),
        details: details.trim() || null,
        due_at: due ? new Date(due).toISOString() : null,
        order_index: (data?.duties.length ?? 0) + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTitle("");
      setDetails("");
      setDue("");
      qc.invalidateQueries({ queryKey });
      toast.success("Responsibility added");
    },
    onError: (e: any) => toast.error(e.message ?? "Could not add"),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: { title?: string; due_at?: string | null; active?: boolean } }) => {
      const { error } = await supabase.from("pm_duties").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError: (e: any) => toast.error(e.message ?? "Could not save"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pm_duties").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success("Removed");
    },
    onError: (e: any) => toast.error(e.message ?? "Could not remove"),
  });

  const seed = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("pm_duties").insert(
        DEFAULT_PM_DUTIES.map((d, i) => ({
          title: d.title,
          details: d.details,
          order_index: i + 1,
        })),
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success("Standard list added — now set a date on each one");
    },
    onError: (e: any) => toast.error(e.message ?? "Could not add the standard list"),
  });

  const remind = useMutation({
    mutationFn: async () => await notify({ data: undefined as never }),
    onSuccess: (r: any) =>
      toast.success(
        r.notified
          ? `${r.notified} reminder${r.notified === 1 ? "" : "s"} sent for ${r.overdue} missed deadline${r.overdue === 1 ? "" : "s"}`
          : "No new reminders to send",
      ),
    onError: (e: any) => toast.error(e.message ?? "Could not send reminders"),
  });

  const duties = data?.duties ?? [];
  const teams = data?.teams ?? [];
  const compKey = new Map((data?.comps ?? []).map((c) => [`${c.duty_id}:${c.team_id}`, c.completed_at]));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="font-display text-xl flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-gold" />
            Project Manager responsibilities & deadlines
          </CardTitle>
          <Button variant="outline" size="sm" disabled={remind.isPending} onClick={() => remind.mutate()}>
            <Bell className="h-4 w-4 mr-1" /> Notify missed deadlines
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_220px_auto] items-end">
            <div className="space-y-1">
              <Label>Responsibility</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Meeting time submitted" />
            </div>
            <div className="space-y-1">
              <Label>Due date and time</Label>
              <Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
            </div>
            <Button onClick={() => add.mutate()} disabled={add.isPending}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
          <div className="space-y-1">
            <Label>What it involves (optional)</Label>
            <Textarea rows={2} value={details} onChange={(e) => setDetails(e.target.value)} />
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : duties.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center">
              <p className="text-sm text-muted-foreground">No responsibilities yet.</p>
              <Button className="mt-3" variant="outline" onClick={() => seed.mutate()} disabled={seed.isPending}>
                Add the standard list
              </Button>
            </div>
          ) : (
            <ul className="space-y-2">
              {duties.map((d) => {
                const doneCount = teams.filter((t) => compKey.has(`${d.id}:${t.id}`)).length;
                return (
                  <li key={d.id} className="rounded-md border border-border/60 p-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        className="h-8 flex-1 min-w-[200px]"
                        defaultValue={d.title}
                        onBlur={(e) =>
                          e.target.value !== d.title &&
                          update.mutate({ id: d.id, patch: { title: e.target.value } })
                        }
                      />
                      <Input
                        type="datetime-local"
                        className="h-8 w-[210px]"
                        defaultValue={toLocalInput(d.due_at)}
                        onChange={(e) =>
                          update.mutate({
                            id: d.id,
                            patch: { due_at: e.target.value ? new Date(e.target.value).toISOString() : null },
                          })
                        }
                      />
                      <Badge variant={doneCount === teams.length ? "secondary" : "outline"}>
                        {doneCount}/{teams.length} teams
                      </Badge>
                      <Button
                        size="sm"
                        variant={d.active ? "outline" : "secondary"}
                        onClick={() => update.mutate({ id: d.id, patch: { active: !d.active } })}
                      >
                        {d.active ? "Active" : "Hidden"}
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => remove.mutate(d.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Due {fmtDue(d.due_at)}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {duties.length > 0 && teams.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Who has hit the dates</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-4">Team</th>
                  {duties.map((d) => (
                    <th key={d.id} className="py-2 pr-4 font-normal max-w-[160px]">
                      {d.title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...teams]
                  .sort((a, b) =>
                    `${a.section ?? ""}${a.name}`.localeCompare(`${b.section ?? ""}${b.name}`),
                  )
                  .map((t) => (
                    <tr key={t.id} className="border-t border-border/50">
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {t.display_name || t.name}
                        {t.section ? (
                          <span className="text-xs text-muted-foreground"> · Section {t.section}</span>
                        ) : null}
                      </td>
                      {duties.map((d) => {
                        const at = compKey.get(`${d.id}:${t.id}`) ?? null;
                        const state = dutyState(d.due_at, at);
                        return (
                          <td key={d.id} className="py-2 pr-4 text-xs whitespace-nowrap">
                            {state === "overdue" ? (
                              <span className="text-destructive">Missed</span>
                            ) : at ? (
                              <span className={state === "late" ? "text-amber-500" : "text-gold"}>
                                {fmtDue(at)}
                                {state === "late" ? " (late)" : ""}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
