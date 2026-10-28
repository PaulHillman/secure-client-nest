// Server-only: instructor "re-grade after discussion" — a decimal, criterion-by-criterion
// analysis of how close a saved submission is to 8/10. Never replaces the official score.
import { finalRegradeDecision } from './peer-review-discussion';
const MODEL = "openai/gpt-6-astra";

const schema = {
  type: "object", additionalProperties: false,
  required: ["precise_score", "verdict", "criteria", "closest_strengths", "to_reach_8"],
  properties: {
    precise_score: { type: "number" },
    verdict: { type: "string" },
    criteria: { type: "array", items: { type: "object", additionalProperties: false, required: ["criterion", "rating", "evidence"], properties: { criterion: { type: "string" }, rating: { type: "string", enum: ["met", "partial", "missing"] }, evidence: { type: "string" } } } },
    closest_strengths: { type: "array", items: { type: "string" } },
    to_reach_8: { type: "array", items: { type: "string" } },
  },
};

export type DetailedRegrade = { precise_score: number; verdict: string; criteria: { criterion: string; rating: string; evidence: string }[]; closest_strengths: string[]; to_reach_8: string[]; gap_to_8: number; regraded_at: string; official_score: number | null };

export async function regradePeerAssessment(db: any, assessmentId: string, actorId: string): Promise<DetailedRegrade> {
  const { data: a, error } = await db.from("peer_review_assessments").select("id, user_id, team_id, score, attempt, final_submission, criteria_snapshot, version_id, status").eq("id", assessmentId).single();
  if (error || !a || a.status !== "assessed" || !a.version_id) throw new Error("Only a saved, scored submission can be re-graded.");
  const { data: newer, error: latestError } = await db.from('peer_review_assessments').select('id').eq('user_id', a.user_id).eq('team_id', a.team_id).neq('status', 'ownership_invalid').gt('attempt', a.attempt).limit(1);
  if (latestError) throw latestError;
  const { data: v } = await db.from("file_versions").select("storage_path, file_size").eq("id", a.version_id).single();
  if (!v) throw new Error("The submitted file is no longer available.");
  const { data: blob } = await db.storage.from("vault").download(v.storage_path);
  if (!blob) throw new Error("The submitted file could not be downloaded.");
  const { extractPeerText } = await import("./peer-review-text.server");
  const text = (v.file_size ?? 0) < 10_000_000 ? await extractPeerText(blob, v.storage_path) : null;
  let media: any = null;
  if (!text) {
    const isPdf = /\.pdf$/i.test(v.storage_path), isImage = /\.(png|jpe?g|webp|gif|heic)$/i.test(v.storage_path);
    const { data: signed } = (isPdf || isImage) ? await db.storage.from("vault").createSignedUrl(v.storage_path, 3600) : { data: null };
    if (!signed?.signedUrl) throw new Error("This file can't be read automatically, so no detailed re-grade was made.");
    media = isPdf ? { type: "input_file", file_url: signed.signedUrl } : { type: "input_image", image_url: signed.signedUrl };
  }
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI key missing");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { "Lovable-API-Key": apiKey, Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: MODEL, stream: true, store: false, reasoning: { effort: "high" },
      instructions: `The instructor discussed this student's mid-semester peer review and wants a precise, detailed re-grade using ONLY the criteria below. Give precise_score to ONE decimal place (e.g. 7.6) on the same harsh 0-10 scale; the official saved score was ${a.score}/10 and is kept regardless. Rate every criterion met/partial/missing, citing or naming the specific answers as evidence. verdict: one or two sentences on how close this is to 8/10. closest_strengths: what already meets the 8/10 bar. to_reach_8: the specific remaining gaps, highest impact first. Discuss document evidence only — no deadlines, policies or meeting instructions. Do not inflate.\n\nCRITERIA:\n${a.criteria_snapshot}`,
      input: [{ role: "user", content: [{ type: "input_text", text: media ? "The submitted document is attached; read it carefully." : `SUBMITTED DOCUMENT TEXT:\n${text?.slice(0, 40_000) ?? ''}` }, ...(media ? [media] : [])] }],
      text: { format: { type: "json_schema", name: "peer_review_regrade", strict: true, schema } },
    }),
  });
  if (!res.ok || !res.body) throw new Error(`Re-grade failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = "", out = "";
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      const p = line.slice(5).trim(); if (p === "[DONE]") continue;
      let ev: any; try { ev = JSON.parse(p); } catch { continue; }
      if (ev.type === "response.output_text.delta") out += ev.delta;
      if (ev.type === "response.failed" || ev.type === "error") throw new Error("Re-grade failed");
    }
  }
  const r = JSON.parse(out);
  const precise = Math.round(Math.max(0, Math.min(10, r.precise_score)) * 10) / 10;
  if (!Number.isFinite(precise)) throw new Error('The re-grade did not return a valid score. No decision was saved.');
  const result: DetailedRegrade = { ...r, precise_score: precise, gap_to_8: Math.max(0, Math.round((8 - precise) * 10) / 10), regraded_at: new Date().toISOString(), official_score: a.score };
  const decision = newer?.length ? {} : finalRegradeDecision(a, precise, actorId, result.regraded_at);
  const { error: upErr } = await db.from("peer_review_assessments").update({ detailed_regrade: result, ...decision }).eq("id", a.id);
  if (upErr) throw upErr;
  return result;
}
