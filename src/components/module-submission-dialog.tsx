import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getModuleSubmission,
  saveModuleSubmission,
} from "@/lib/module-submissions.functions";
import { moduleForm } from "@/lib/modules";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export function ModuleSubmissionDialog({
  teamId,
  moduleKey,
  title,
  open,
  onOpenChange,
}: {
  teamId: string;
  moduleKey: string;
  title: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const fetchOne = useServerFn(getModuleSubmission);
  const save = useServerFn(saveModuleSubmission);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  // Which team/module the current field values belong to, so switching teams or
  // modules never shows stale values, and typing is never overwritten on reload.
  const hydratedFor = useRef<string | null>(null);
  const touched = useRef<Set<string>>(new Set());

  const form = moduleForm(moduleKey);

  const { data } = useQuery({
    queryKey: ["module-submission", teamId, moduleKey],
    queryFn: () => fetchOne({ data: { teamId, key: moduleKey } }),
    enabled: open,
  });

  const scope = `${teamId}|${moduleKey}`;

  // Clear out previous team/module values as soon as the dialog opens elsewhere.
  useEffect(() => {
    if (!open) return;
    if (hydratedFor.current !== null && hydratedFor.current !== scope) {
      hydratedFor.current = null;
      touched.current = new Set();
      setAnswers({});
    }
  }, [open, scope]);

  useEffect(() => {
    if (!open || !data) return;
    const defaults = (data as { defaults?: Record<string, string> }).defaults ?? {};
    const saved = data.answers ?? {};
    if (hydratedFor.current !== scope) {
      hydratedFor.current = scope;
      setAnswers({ ...defaults, ...saved });
      return;
    }
    // Later refetches: fill only fields the user has not touched and that are blank.
    setAnswers((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const [k, v] of Object.entries({ ...defaults, ...saved })) {
        if (touched.current.has(k)) continue;
        if ((next[k] ?? "").trim()) continue;
        if (!v) continue;
        next[k] = v;
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [open, data, scope]);

  const setField = (name: string, value: string) => {
    touched.current.add(name);
    setAnswers((a) => ({ ...a, [name]: value }));
  };

  const mutation = useMutation({
    mutationFn: (submit: boolean) => save({ data: { teamId, key: moduleKey, answers, submit } }),
    onSuccess: () => {
      toast.success("Saved.");
      void qc.invalidateQueries({ queryKey: ["module-submission", teamId, moduleKey] });
      void qc.invalidateQueries({ queryKey: ["team-readiness", teamId] });
      void qc.invalidateQueries({ queryKey: ["readiness-board"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!form) return null;
  const locked = moduleKey !== "team_setup" && data?.status === "approved" && !data?.isAdmin;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{title}</DialogTitle>
          <DialogDescription>{form.intro}</DialogDescription>
        </DialogHeader>

        {data?.revisionNote && (
          <p className="rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-400">
            Sent back: {data.revisionNote}
          </p>
        )}
        {locked && (
          <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-400">
            Approved — this is now read only.
          </p>
        )}

        <div className="space-y-4">
          {form.fields.map((f) => (
            <div key={f.name} className="space-y-1.5">
              <Label htmlFor={f.name}>
                {f.label}
                {f.required && <span className="text-muted-foreground"> *</span>}
              </Label>
              {f.kind === "textarea" ? (
                <Textarea
                  id={f.name}
                  rows={3}
                  disabled={locked}
                  placeholder={f.placeholder}
                  value={answers[f.name] ?? ""}
                  onChange={(e) => setField(f.name, e.target.value)}
                />
              ) : (
                <Input
                  id={f.name}
                  disabled={locked}
                  placeholder={f.placeholder}
                  value={answers[f.name] ?? ""}
                  onChange={(e) => setField(f.name, e.target.value)}
                />
              )}
              {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
            </div>
          ))}
        </div>


        <DialogFooter className="gap-2">
          <Button disabled={locked || mutation.isPending} onClick={() => mutation.mutate(false)}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
