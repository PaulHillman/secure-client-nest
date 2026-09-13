import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ClipboardList, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { dutyState, fmtDue } from "@/lib/pm-duties";
import { checkDutyRequirements, completeDuty } from "@/lib/pm-duties.functions";


export function PmDutiesCard({ teamId }: { teamId: string }) {
  const qc = useQueryClient();
  const queryKey = ["pm-duties", teamId];
  const [blocker, setBlocker] = useState<{
    dutyId: string;
    title: string;
    missing: string[];
  } | null>(null);


  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const [{ data: duties, error: dErr }, { data: comps, error: cErr }] = await Promise.all([
        supabase
          .from("pm_duties")
          .select("id, title, details, due_at, order_index")
          .eq("active", true)
          .order("due_at", { ascending: true, nullsFirst: false })
          .order("order_index", { ascending: true }),
        supabase
          .from("pm_duty_completions")
          .select("id, duty_id, completed_at, completed_by, notes")
          .eq("team_id", teamId),
      ]);
      if (dErr) throw dErr;
      if (cErr) throw cErr;
      const byDuty = new Map((comps ?? []).map((c) => [c.duty_id, c]));
      return (duties ?? []).map((d) => ({ ...d, completion: byDuty.get(d.id) ?? null }));
    },
  });

  const runCheck = useServerFn(checkDutyRequirements);
  const runComplete = useServerFn(completeDuty);

  const undo = useMutation({
    mutationFn: async (dutyId: string) => {
      const { error } = await supabase
        .from("pm_duty_completions")
        .delete()
        .eq("duty_id", dutyId)
        .eq("team_id", teamId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success("Marked as not done");
    },
    onError: (e: any) => toast.error(e.message ?? "Could not update"),
  });

  const complete = useMutation({
    mutationFn: async ({ dutyId, override }: { dutyId: string; override: boolean }) =>
      runComplete({ data: { teamId, dutyId, override } }),
    onSuccess: (_r, v) => {
      setBlocker(null);
      qc.invalidateQueries({ queryKey });
      toast.success(
        v.override
          ? "Marked complete as an override — Prof Hillman will see the missing items."
          : "Marked complete",
      );
    },
    onError: (e: any) => toast.error(e.message ?? "Could not update"),
  });

  const attempt = useMutation({
    mutationFn: async (dutyId: string) => ({
      dutyId,
      result: await runCheck({ data: { teamId, dutyId } }),
    }),
    onSuccess: ({ dutyId, result }) => {
      if (result.ok) complete.mutate({ dutyId, override: false });
      else setBlocker({ dutyId, title: result.title, missing: result.missing });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not check this item"),
  });

  const busy = undo.isPending || complete.isPending || attempt.isPending;
  const duties = data ?? [];


  return (
    <Card className="border-border/60 mt-6">
      <CardHeader>
        <CardTitle className="font-display text-xl flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-gold" />
          Project Manager responsibilities
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : duties.length === 0 ? (
          <p className="text-sm text-muted-foreground">No responsibilities have been published yet.</p>
        ) : (
          <ul className="space-y-3">
            {duties.map((d) => {
              const state = dutyState(d.due_at, d.completion?.completed_at);
              const done = !!d.completion;
              return (
                <li
                  key={d.id}
                  className="flex flex-wrap items-start gap-3 rounded-md border border-border/60 p-3"
                >
                  <div className="mt-0.5">
                    {state === "overdue" ? (
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    ) : done ? (
                      <CheckCircle2 className="h-4 w-4 text-gold" />
                    ) : (
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{d.title}</p>
                    {d.details ? (
                      <p className="text-xs text-muted-foreground mt-0.5">{d.details}</p>
                    ) : null}
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-muted-foreground">Due {fmtDue(d.due_at)}</span>
                      {state === "overdue" ? (
                        <Badge variant="destructive">Missed</Badge>
                      ) : state === "late" ? (
                        <Badge variant="secondary">
                          Completed late {fmtDue(d.completion?.completed_at)}
                        </Badge>
                      ) : state === "done" ? (
                        <Badge variant="secondary">
                          Completed {fmtDue(d.completion?.completed_at)}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={done ? "outline" : "default"}
                    disabled={toggle.isPending}
                    onClick={() => toggle.mutate({ dutyId: d.id, done })}
                  >
                    {done ? "Undo" : "Mark complete"}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
