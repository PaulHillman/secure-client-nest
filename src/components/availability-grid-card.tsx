import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarClock, Eraser } from "lucide-react";
import { toast } from "sonner";
import { DAY_LABELS, SLOT_MINUTES, fmtSlot, slotKey, slotRangeLabel } from "@/lib/availability";

export function AvailabilityGridCard() {
  const { user, viewAs } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);
  const dragging = useRef<null | boolean>(null);

  const { data } = useQuery({
    queryKey: ["my-availability", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_availability")
        .select("busy_slots")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (data && !dirty) setBusy(new Set(data.busy_slots ?? []));
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const stop = () => (dragging.current = null);
    window.addEventListener("pointerup", stop);
    return () => window.removeEventListener("pointerup", stop);
  }, []);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("student_availability")
        .upsert(
          { user_id: user!.id, busy_slots: Array.from(busy) },
          { onConflict: "user_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      setDirty(false);
      toast.success("Availability saved");
      qc.invalidateQueries({ queryKey: ["my-availability"] });
      qc.invalidateQueries({ queryKey: ["team-availability"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function apply(key: string, makeBusy: boolean) {
    setBusy((prev) => {
      const next = new Set(prev);
      if (makeBusy) next.add(key);
      else next.delete(key);
      return next;
    });
    setDirty(true);
  }

  if (!user) return null;

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 font-display text-xl">
            <CalendarClock className="h-5 w-5 text-gold" /> My weekly availability
          </CardTitle>
          <CardDescription>
            Click or drag any half hour you are busy. Leave it blank when you are free.
          </CardDescription>
        </div>
        {!viewAs && (
          <div className="flex shrink-0 gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setBusy(new Set());
                setDirty(true);
              }}
            >
              <Eraser className="mr-1 h-3.5 w-3.5" /> Clear
            </Button>
            <Button size="sm" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-[560px] select-none">
            <div className="grid grid-cols-[64px_repeat(7,1fr)] gap-px text-[10px] font-semibold uppercase text-muted-foreground">
              <div />
              {DAY_LABELS.map((d) => (
                <div key={d} className="pb-1 text-center">
                  {d}
                </div>
              ))}
            </div>
            {SLOT_MINUTES.map((m) => (
              <div key={m} className="grid grid-cols-[64px_repeat(7,1fr)] gap-px">
                <div className="pr-2 text-right text-[10px] leading-5 text-muted-foreground">
                  {m % 60 === 0 ? fmtSlot(m) : ""}
                </div>
                {DAY_LABELS.map((_, day) => {
                  const key = slotKey(day, m);
                  const isBusy = busy.has(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      title={slotRangeLabel(day, m)}
                      aria-label={`${slotRangeLabel(day, m)} — ${isBusy ? "busy" : "free"}`}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        dragging.current = !isBusy;
                        apply(key, !isBusy);
                      }}
                      onPointerEnter={() => {
                        if (dragging.current !== null) apply(key, dragging.current);
                      }}
                      className={`h-5 rounded-[2px] border transition-colors ${
                        isBusy
                          ? "border-gold/60 bg-gold/70"
                          : m % 60 === 0
                            ? "border-border/60 bg-muted/40 hover:bg-muted"
                            : "border-border/30 bg-muted/20 hover:bg-muted"
                      }`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Shaded = busy · Blank = free. {busy.size} half-hour blocks marked busy.
        </p>
      </CardContent>
    </Card>
  );
}
