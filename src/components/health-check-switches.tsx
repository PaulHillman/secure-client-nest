import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getHealthReviewRules, saveDisabledChecks } from "@/lib/health-review-rules.functions";
import { CHECK_SWITCHES } from "@/lib/health-check-switches";
import { HEALTH_RULES_KEY } from "@/components/health-review-rules-editor";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function SwitchList({ off, locked, onToggle }: { off: Set<string>; locked?: Set<string>; onToggle: (key: string) => void }) {
  return (
    <ul className="space-y-2">
      {CHECK_SWITCHES.map((s) => {
        const isLocked = locked?.has(s.key) ?? false;
        const on = !off.has(s.key) && !isLocked;
        return (
          <li key={s.key}>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-primary" checked={on} disabled={isLocked} onChange={() => onToggle(s.key)} />
              <span>
                <span className={on ? "font-medium" : "font-medium text-muted-foreground line-through"}>{s.label}</span>
                {isLocked && <span className="ml-2 text-xs text-muted-foreground">(off in settings)</span>}
                <span className="block text-xs text-muted-foreground">{s.hint}</span>
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

/** Settings page: checks switched off on every run until switched back on. */
export function HealthCheckSwitchesEditor() {
  const get = useServerFn(getHealthReviewRules);
  const save = useServerFn(saveDisabledChecks);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: HEALTH_RULES_KEY, queryFn: () => get({}) });
  const [draft, setDraft] = useState<Set<string> | null>(null);
  const saved = new Set(data?.disabled_checks ?? []);
  const off = draft ?? saved;
  const m = useMutation({
    mutationFn: () => { if (!data?.updated_at) throw new Error('Reload settings before saving.'); return save({ data: { keys: [...off], expectedUpdatedAt: data.updated_at } }); },
    onSuccess: () => { setDraft(null); qc.invalidateQueries({ queryKey: HEALTH_RULES_KEY }); qc.invalidateQueries({ queryKey: ['review-rulebook'] }); toast.success("Saved — every future run uses these switches."); },
  });
  if (!data) return null;
  const changed = [...off].sort().join() !== [...saved].sort().join();
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="font-display text-xl">Group Norms checks</CardTitle>
        <CardDescription>Untick a check to stop it running. Saved here, it stays off for every run. To skip one just once, use "Turn checks off for this run" on the Team Health Review page instead.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SwitchList off={off} onToggle={(k) => setDraft(() => { const n = new Set(off); n.has(k) ? n.delete(k) : n.add(k); return n; })} />
        <Button disabled={!changed || m.isPending} onClick={() => m.mutate()}>{m.isPending ? "Saving…" : "Save switches"}</Button>
        {m.error && <p role="alert" className="text-sm text-destructive">{(m.error as Error).message}</p>}
      </CardContent>
    </Card>
  );
}

/** Runner page: extra checks to skip for this run only (nothing saved). */
export function RunCheckSwitches({ off, onChange }: { off: Set<string>; onChange: (next: Set<string>) => void }) {
  const get = useServerFn(getHealthReviewRules);
  const { data } = useQuery({ queryKey: HEALTH_RULES_KEY, queryFn: () => get({}) });
  const locked = new Set(data?.disabled_checks ?? []);
  const count = off.size + locked.size;
  return (
    <details className="w-full rounded-md border border-border/60 p-3">
      <summary className="cursor-pointer text-sm font-medium">Turn checks off for this run{count ? ` (${count} off)` : ""}</summary>
      <p className="my-2 text-xs text-muted-foreground">Only this run — nothing is saved. A switched-off check raises no concern and earns no "fixed" credit; the report notes it was turned off.</p>
      <SwitchList off={off} locked={locked} onToggle={(k) => { const n = new Set(off); n.has(k) ? n.delete(k) : n.add(k); onChange(n); }} />
    </details>
  );
}
