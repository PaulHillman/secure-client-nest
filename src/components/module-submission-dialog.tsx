import { useEffect, useState } from "react";
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

  const form = moduleForm(moduleKey);

  const { data } = useQuery({
    queryKey: ["module-submission", teamId, moduleKey],
    queryFn: () => fetchOne({ data: { teamId, key: moduleKey } }),
    enabled: open,
  });

  useEffect(() => {
    if (data) setAnswers(data.answers);
  }, [data]);

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
                  onChange={(e) => setAnswers((a) => ({ ...a, [f.name]: e.target.value }))}
                />
              ) : (
                <Input
                  id={f.name}
                  disabled={locked}
                  placeholder={f.placeholder}
                  value={answers[f.name] ?? ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [f.name]: e.target.value }))}
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
