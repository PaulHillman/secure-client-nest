/**
 * One-off admin utility: score submissions for activities that never had an
 * answer key, by re-running the coach against the activity's essential ideas.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { proofByKey } from "@/lib/proofs";

function asAnswers(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

export const backfillProofScores = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { limit?: number } | undefined) => ({ limit: input?.limit ?? 25 }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: admin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (admin !== true) throw new Error("Admins only.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { generateProofFeedback } = await import("@/lib/proofs.server");

    const { data: rows, error } = await supabaseAdmin
      .from("proof_submissions")
      .select("id, proof_key, response")
      .is("score", null)
      .limit(data.limit);
    if (error) throw new Error(error.message);

    let scored = 0;
    let skipped = 0;
    for (const row of rows ?? []) {
      const proof = proofByKey(row.proof_key);
      if (!proof || proof.requiresFile) {
        skipped++;
        continue;
      }
      const result = await generateProofFeedback({
        proofKey: row.proof_key,
        answers: asAnswers(row.response),
      });
      if (result.score == null) {
        skipped++;
        continue;
      }
      await supabaseAdmin
        .from("proof_submissions")
        .update({
          score: result.score,
          feedback: result.text,
          feedback_status: result.status,
          feedback_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      scored++;
    }
    return { examined: rows?.length ?? 0, scored, skipped };
  });
