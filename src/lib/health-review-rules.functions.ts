import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  HEALTH_REVIEW_RULE_DEFAULTS,
  RULES_ROW_ID,
  resolveHealthReviewRules,
  type HealthReviewRules,
} from "./health-review-rules";
import { cleanCheckKeys } from "./health-check-switches";

async function requireAdmin(context: { supabase: any; userId: string }) {
  const { data: ok } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!ok) throw new Error("Admin access required");
}

const valueSchema = z.union([z.number(), z.string()]);

/** Admin-only: the thresholds the weekly Team Health Review will use next run. */
export const getHealthReviewRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { data, error } = await context.supabase
      .from("health_review_rules")
      .select("*")
      .eq("id", RULES_ROW_ID)
      .maybeSingle();
    if (error) throw error;
    return {
      rules: resolveHealthReviewRules(data),
      defaults: HEALTH_REVIEW_RULE_DEFAULTS,
      updated_at: (data?.updated_at as string | null) ?? null,
      saved: !!data,
      disabled_checks: cleanCheckKeys((data as { disabled_checks?: unknown } | null)?.disabled_checks),
    };
  });

/**
 * Admin-only. Values are clamped and validated server-side by
 * `resolveHealthReviewRules`, and the save is rejected if the row changed in
 * another tab since it was loaded.
 */
export const saveHealthReviewRules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    values: z.record(valueSchema),
    expected_updated_at: z.string().nullable(),
  }))
  .handler(async ({ context, data }): Promise<{ rules: HealthReviewRules; updated_at: string | null }> => {
    await requireAdmin(context);
    const { data: current, error: readError } = await context.supabase
      .from("health_review_rules")
      .select("updated_at")
      .eq("id", RULES_ROW_ID)
      .maybeSingle();
    if (readError) throw readError;
    if (!current) throw new Error("The rule settings row is missing. Reload the page and try again.");
    if (data.expected_updated_at !== null && current.updated_at !== data.expected_updated_at) {
      throw new Error("These settings changed elsewhere since you opened them. Reload before saving so those edits are not lost.");
    }
    const patch = resolveHealthReviewRules({ ...resolveHealthReviewRules(current), ...data.values });
    const { data: saved, error } = await context.supabase
      .from("health_review_rules")
      .update({ ...patch, updated_by: context.userId })
      .eq("id", RULES_ROW_ID)
      .eq("updated_at", current.updated_at)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!saved) throw new Error("These settings changed elsewhere while you were saving. Reload and try again.");
    return { rules: resolveHealthReviewRules(saved), updated_at: (saved.updated_at as string | null) ?? null };
  });

/** Admin-only: which checks are switched off on every run. */
export const saveDisabledChecks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ keys: z.array(z.string()) }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context);
    const keys = cleanCheckKeys(data.keys);
    const { error } = await context.supabase.from("health_review_rules").update({ disabled_checks: keys, updated_by: context.userId }).eq("id", RULES_ROW_ID);
    if (error) throw error;
    return { disabled_checks: keys };
  });
