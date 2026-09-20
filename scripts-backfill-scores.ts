/** One-off: score past submissions for activities without an answer key. */
import { readFileSync, writeFileSync } from "node:fs";
import { generateProofFeedback } from "./src/lib/proofs.server";
import { proofByKey } from "./src/lib/proofs";

type Row = { id: string; k: string; r: unknown };
const rows: Row[] = JSON.parse(readFileSync("/tmp/subs.json", "utf8"));
const out: string[] = [];

function answers(v: unknown): Record<string, string> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const o: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>))
    if (typeof val === "string") o[k] = val;
  return o;
}

for (const row of rows) {
  const proof = proofByKey(row.k);
  if (!proof || proof.requiresFile) {
    console.log("skip", row.k);
    continue;
  }
  const res = await generateProofFeedback({ proofKey: row.k, answers: answers(row.r) });
  if (res.score == null) {
    console.log("no score", row.k, res.status);
    continue;
  }
  console.log(row.k, res.score, "/", proof.maxScore);
  out.push(`update proof_submissions set score = ${res.score} where id = '${row.id}';`);
}
writeFileSync("/tmp/scores.sql", out.join("\n"));
console.log("wrote", out.length);
