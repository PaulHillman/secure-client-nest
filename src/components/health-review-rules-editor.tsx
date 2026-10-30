import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { getHealthReviewRules, saveHealthReviewRules } from "@/lib/health-review-rules.functions";
import {
  HEALTH_REVIEW_RULE_DEFAULTS,
  RULE_FIELDS,
  ruleValueLabel,
  type HealthReviewRuleKey,
  type HealthReviewRules,
  type RuleField,
} from "@/lib/health-review-rules";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export const HEALTH_RULES_KEY = ["health-review-rules"];

type Draft = Record<HealthReviewRuleKey, string>;
type Loaded = Awaited<ReturnType<typeof getHealthReviewRules>>;

function toDraft(rules: HealthReviewRules): Draft {
  const draft = {} as Draft;
  for (const field of RULE_FIELDS) draft[field.key] = String(rules[field.key]);
  return draft;
}

/** The numbers the weekly Team Health Review actually applies. Saving changes the next run. */
export function HealthReviewRulesEditor() {
  const get = useServerFn(getHealthReviewRules);
  const { data, error } = useQuery({ queryKey: HEALTH_RULES_KEY, queryFn: () => get({}) });
  if (error) return <p role="alert" className="text-destructive text-sm">{error.message}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Loading rule settings…</p>;
  return <RulesForm key={data.updated_at ?? "fresh"} loaded={data} />;
}

function RulesForm({ loaded }: { loaded: Loaded }) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(loaded.rules));
  const [reviewing, setReviewing] = useState(false);
  const save = useServerFn(saveHealthReviewRules);
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => save({ data: { values: { ...draft }, expected_updated_at: loaded.updated_at } }),
    onSuccess: (saved) => {
      qc.setQueryData(HEALTH_RULES_KEY, { ...loaded, rules: saved.rules, updated_at: saved.updated_at, saved: true });
      void qc.invalidateQueries({ queryKey: ['review-rulebook'] });
      toast.success("Rule settings saved — the next report you run uses them.");
    },
  });

  const changed = RULE_FIELDS.filter((f) => String(loaded.rules[f.key]) !== draft[f.key]);
  const groups = [...new Set(RULE_FIELDS.map((f) => f.group))];

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="font-display text-xl">What the weekly report checks</CardTitle>
        <CardDescription>
          These are the thresholds the review applies. Change one here, save it, and the next report you run uses it —
          no code change needed. <Link to="/app/health-review" search={{ report: undefined }} className="text-primary underline">Run the review</Link>{" "}
          to see the effect.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {groups.map((group) => (
          <fieldset key={group} className="space-y-3">
            <legend className="text-sm font-semibold text-foreground/80">{group}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {RULE_FIELDS.filter((f) => f.group === group).map((field) => (
                <RuleInput key={field.key} field={field} value={draft[field.key]} onChange={(v) => setDraft((d) => ({ ...d, [field.key]: v }))} />
              ))}
            </div>
          </fieldset>
        ))}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button disabled={mutation.isPending || !changed.length} onClick={() => setReviewing(true)}>
            <Save className="mr-2 h-4 w-4" />
            Review threshold changes
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={mutation.isPending}
            onClick={() => setDraft(toDraft(HEALTH_REVIEW_RULE_DEFAULTS))}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Fill in the original values
          </Button>
          <p className="text-sm text-muted-foreground">
            {changed.length === 0
              ? loaded.updated_at
                ? `Saved ${new Date(loaded.updated_at).toLocaleString()}. Nothing to save.`
                : "Nothing to save."
              : `${changed.length} change${changed.length === 1 ? "" : "s"}: ${changed.map((f) => `${f.label} → ${ruleValueLabel(f, draft[f.key])}`).join("; ")}`}
          </p>
        </div>
        {reviewing && <div className="border-l-4 border-primary pl-4 space-y-3 text-sm"><h3 className="font-semibold">Effect of threshold changes</h3><ul className="list-disc pl-5">{changed.map(f => <li key={f.key}>{f.label}: {String(loaded.rules[f.key])} → {draft[f.key]}</li>)}</ul><p>Future reports may raise or clear concerns under these new limits. A changed rule is not proof that a student fixed something. Saved reports and prior scores remain unchanged.</p><Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>Apply threshold changes</Button></div>}
        {mutation.error && <p role="alert" className="text-destructive text-sm">{mutation.error.message}</p>}
      </CardContent>
    </Card>
  );
}

function RuleInput({ field, value, onChange }: { field: RuleField; value: string; onChange: (v: string) => void }) {
  const id = `rule-${field.key}`;
  const invalid =
    field.kind === "date"
      ? !/^\d{4}-\d{2}-\d{2}$/.test(value)
      : value.trim() === "" || !Number.isFinite(Number(value));
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{field.label}</Label>
      <Input
        id={id}
        type={field.kind === "date" ? "date" : "number"}
        inputMode={field.kind === "date" ? undefined : "numeric"}
        min={field.kind === "date" ? undefined : field.min}
        max={field.kind === "date" ? undefined : field.max}
        step={1}
        value={value}
        aria-invalid={invalid}
        aria-describedby={`${id}-hint`}
        onChange={(e) => onChange(e.target.value)}
      />
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">{field.hint}</p>
    </div>
  );
}
