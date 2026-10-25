// Server-only: automatic assessment of a Mid-Semester peer-review upload.
import { MEETING_PEER_DUE } from "./peer-review-policy";

const SUBSECTION = "Mid-Semester Peer Reviews";
const MODEL = "openai/gpt-6-astra";
const INSTRUCTOR_EMAIL = "hillmanp@gvsu.edu";

type Verdict = { readable: boolean; score: number; strengths: string[]; concerns: string[]; changes: string[] };

const schema = {
  type: "object", additionalProperties: false,
  required: ["readable", "score", "strengths", "concerns", "changes"],
  properties: {
    readable: { type: "boolean" },
    score: { type: "integer" },
    strengths: { type: "array", items: { type: "string" } },
    concerns: { type: "array", items: { type: "string" } },
    changes: { type: "array", items: { type: "string" } },
  },
};

async function extractText(blob: Blob, name: string): Promise<string | null> {
  const bytes = await blob.arrayBuffer();
  try {
    if (/\.pdf$/i.test(name)) {
      const { extractText } = await import("unpdf");
      return (await extractText(new Uint8Array(bytes), { mergePages: true })).text?.trim() || null;
    }
    if (/\.docx$/i.test(name)) {
      const mammoth = await import("mammoth/mammoth.browser");
      return (await mammoth.extractRawText({ arrayBuffer: bytes })).value.trim() || null;
    }
    if (/\.(txt|md)$/i.test(name)) return new TextDecoder().decode(bytes).trim() || null;
  } catch { /* unreadable */ }
  return null;
}

async function scoreWithAi(input: { criteria: string; text: string; studentName: string; teamName: string; attempt: number; previous: any | null }): Promise<Verdict> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI key missing");
  const prev = input.previous
    ? `\n\nPrevious attempt ${input.previous.attempt} scored ${input.previous.score}/10. Concerns then: ${JSON.stringify(input.previous.concerns)}. Requested changes: ${JSON.stringify(input.previous.changes)}. Judge whether those were actually fixed; do not raise the score just because it is a revision.`
    : "";
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { "Lovable-API-Key": apiKey, Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: MODEL, stream: true, store: false,
      reasoning: { effort: "medium" },
      instructions: `You evaluate the QUALITY of a student's submitted mid-semester peer review (0-10 holistic) using ONLY the instructor's criteria below. Score harshly: prefer a justified 6 to a generous 7. Do not invent deduction formulas. Never flag a missing form date or reviewer role. Give 2-3 concise strengths and 2-3 concrete concerns quoting or naming the specific answers. For readable reviews below 8/10, changes MUST contain exactly three distinct, concrete, evidence-based fixes needed to reach 8/10, ordered highest impact first. Identify the relevant answer and what to replace or add; do not guarantee a score merely for editing. For scores 8+ give optional improvements. If the text is not a peer review or is unreadable, set readable=false and score 0.\n\nCRITERIA:\n${input.criteria}`,
      input: [{ role: "user", content: `Reviewer on record: ${input.studentName}. Team: ${input.teamName}. Attempt ${input.attempt} of 3.${prev}\n\nSUBMITTED DOCUMENT TEXT:\n${input.text.slice(0, 40_000)}` }],
      text: { format: { type: "json_schema", name: "peer_review_quality", strict: true, schema } },
    }),
  });
  if (!res.ok || !res.body) throw new Error(`AI review failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const ev = JSON.parse(payload);
        if (ev.type === "response.output_text.delta") out += ev.delta;
        if (ev.type === "response.failed" || ev.type === "error") throw new Error("AI review failed");
      } catch (e) { if ((e as Error).message === "AI review failed") throw e; }
    }
  }
  const v = JSON.parse(out) as Verdict;
  v.score = Math.max(0, Math.min(10, Math.round(v.score)));
  if (v.readable && v.score < 8 && (v.changes.length !== 3 || v.changes.some((change) => !change.trim()))) {
    throw new Error("Assessment did not provide three specific priority fixes; retry assessment.");
  }
  return v;
}

export function revisionEmailBody(name: string, attempt: number, score: number, v: Verdict) {
  const label = attempt === 1 ? "original" : `revision (submission ${attempt} of 3)`;
  const band = score >= 8 ? "GREEN — target met" : score >= 7 ? (attempt === 1 ? "GREEN — pass" : "below the 8+ revision target") : score >= 4 ? "YELLOW" : "RED";
  let next: string;
  if (attempt === 1 && score >= 7) next = score === 7 ? "Your review was very close to requiring revision. No further action is required." : "No further action is required.";
  else if (score >= 8) next = "Your revision meets the 8/10 target. No further action is required.";
  else if (attempt >= 3) next = "This was your third submission and it remains below 8. You must meet with me by Sunday, November 8 at 11:59 p.m. Eastern and bring this latest submission. Schedule: https://calendly.com/hillman-gvsu/15-minute-meeting-clone-1. Do not upload further revisions before that meeting.";
  else next = `Upload a revision aiming for 8/10 or higher, or book a meeting with me, by Sunday, November 1, 2026 at 11:59 p.m. Eastern. You have ${3 - attempt} submission${3 - attempt === 1 ? "" : "s"} left. Schedule: https://calendly.com/hillman-gvsu/15-minute-meeting-clone-1.`;
  return `Hi ${name},\n\nYour mid-semester peer-review ${label} quality score is ${score}/10 — ${band}. This evaluates the quality of your review, not the scores you gave teammates.\n\nWhat you did well:\n${v.strengths.map((s) => `- ${s}`).join("\n")}\n\nWhat needs attention:\n${v.concerns.map((s) => `- ${s}`).join("\n")}\n\n${score >= 8 ? "Optional further improvements" : "Specific changes needed to reach 8 or above"}:\n${v.changes.map((s) => `- ${s}`).join("\n")}\n\n${next}\n\nThis review was generated automatically right after your upload. Copies are sent separately to ${INSTRUCTOR_EMAIL} and your Project Manager.\n\nPaul W. Hillman`;
}

/** Assess one uploaded version; idempotent per version. Sends student, instructor and PM copies one at a time. */
export async function autoAssessPeerUpload(versionId: string) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data: existing } = await db.from("peer_review_assessments").select("id, score, attempt").eq("version_id", versionId).maybeSingle();
  if (existing) return { status: "already", score: existing.score, attempt: existing.attempt };
  const { data: version, error: vErr } = await db.from("file_versions").select("id, file_id, storage_path, uploaded_by, file_size").eq("id", versionId).single();
  if (vErr || !version) throw new Error("Upload not found");
  const { data: file } = await db.from("files").select("id, file_name, team_id, subsection, assigned_to").eq("id", version.file_id).single();
  if (!file || file.subsection !== SUBSECTION || !file.team_id) return { status: "skipped" };
  const { data: team } = await db.from("teams").select("is_test, name, display_name").eq("id", file.team_id).single();
  if (!team || team.is_test) return { status: "skipped" };
  const { data: established } = file.assigned_to ? { data: null } : await db.from("peer_review_assessments").select("user_id").eq("file_id", file.id).neq("status", "ownership_invalid").order("created_at").limit(1).maybeSingle();
  const ownerId = file.assigned_to ?? established?.user_id;
  if (!ownerId) return { status: "owner_required" };
  const { data: member } = await db.from("team_members").select("user_id").eq("team_id", file.team_id).eq("user_id", ownerId).maybeSingle();
  if (!member) return { status: "owner_required" };
  const { data: student } = await db.from("profiles").select("name, email").eq("id", ownerId).single();
  if (!student || /parfunkel/i.test(student.name)) return { status: "skipped" };

  const { data: prior } = await db.from("peer_review_assessments").select("attempt, score, concerns, changes, status").eq("user_id", ownerId).eq("team_id", file.team_id).not("file_id", "is", null).order("attempt", { ascending: false });
  const previous = prior?.[0] ?? null;
  const attempt = (previous?.attempt ?? 0) + 1;
  if (attempt > 3) return { status: "limit" };

  const { data: crit, error: criteriaError } = await db.from("peer_review_criteria").select("content").eq("id", "peer-review").single();
  if (criteriaError || !crit?.content.trim()) throw new Error("Peer-review criteria are unavailable. Please retry after checking the criteria document.");
  const criteria = crit.content;
  const { data: blob } = await db.storage.from("vault").download(version.storage_path);
  const text = blob && (version.file_size ?? 0) < 10_000_000 ? await extractText(blob, version.storage_path) : null;
  const { data: instructor } = await db.from("profiles").select("id").ilike("email", INSTRUCTOR_EMAIL).limit(1).single();

  const base = { user_id: ownerId, team_id: file.team_id, file_id: file.id, version_id: versionId, attempt, criteria_snapshot: criteria, assessed_by: instructor?.id ?? ownerId };
  if (!text) {
    await db.from("peer_review_assessments").insert({ ...base, score: null, status: "unreadable", summary: "File could not be read automatically — instructor review needed.", email_body: "", student_email_status: "suppressed", instructor_email_status: "suppressed", pm_email_status: "suppressed" });
    return { status: "unreadable" };
  }
  const verdict = await scoreWithAi({ criteria, text, studentName: student.name, teamName: team.display_name ?? team.name, attempt, previous });
  if (!verdict.readable) {
    await db.from("peer_review_assessments").insert({ ...base, score: null, status: "unreadable", strengths: [], concerns: verdict.concerns, changes: [], summary: "Upload did not read as a peer review — instructor review needed.", email_body: "", student_email_status: "suppressed", instructor_email_status: "suppressed", pm_email_status: "suppressed" });
    return { status: "unreadable" };
  }
  const score = verdict.score;
  const body = revisionEmailBody(student.name, attempt, score, verdict);
  const { data: row, error: insErr } = await db.from("peer_review_assessments").insert({ ...base, score, status: "assessed", strengths: verdict.strengths, concerns: verdict.concerns, changes: verdict.changes, summary: `${attempt === 1 ? "Original" : "Revision"} ${score}/10`, email_body: body, student_email_status: "pending", instructor_email_status: "pending", pm_email_status: "pending" }).select("id").single();
  if (insErr) { if (/duplicate/i.test(insErr.message)) return { status: "already" }; throw insErr; }

  const { sendTemplateEmail } = await import("./email-templates/send-email");
  const subject = `Your peer-review ${attempt === 1 ? "analysis" : "revision analysis"} — ${student.name} — ${score}/10`;
  const send = async (copy: "student" | "instructor" | "pm", to: string | null) => {
    const col = `${copy}_email_status` as const;
    if (!to) { await db.from("peer_review_assessments").update(({ [col]: "failed" } as any)).eq("id", row.id); return; }
    try {
      const r = await sendTemplateEmail("peer-review-analysis", to, { templateData: { name: student.name, body, subject: copy === "student" ? subject : `Copy: ${subject}` }, replyTo: INSTRUCTOR_EMAIL, idempotencyKey: `peer-analysis-${row.id}-${copy}-${to.toLowerCase()}` });
      await db.from("peer_review_assessments").update(({ [col]: r.sent ? "sent" : "suppressed" } as any)).eq("id", row.id);
    } catch { await db.from("peer_review_assessments").update(({ [col]: "pending" } as any)).eq("id", row.id); }
  };
  await send("student", student.email);
  await send("instructor", INSTRUCTOR_EMAIL);
  const { data: pm } = await db.from("team_members").select("user_id").eq("team_id", file.team_id).eq("job_title", "PM").maybeSingle();
  if (pm?.user_id === ownerId) await db.from("peer_review_assessments").update({ pm_email_status: "same_as_student" }).eq("id", row.id);
  else {
    const { data: pmProfile } = pm ? await db.from("profiles").select("email").eq("id", pm.user_id).single() : { data: null };
    await send("pm", pmProfile?.email ?? null);
  }
  void MEETING_PEER_DUE;
  return { status: "assessed", score, attempt };
}
