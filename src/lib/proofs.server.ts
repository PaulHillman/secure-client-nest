/**
 * Server-only helpers for the Stage C proofs: reading the file list out of an
 * uploaded ZIP, and generating coaching feedback through the AI gateway.
 * Feedback is advisory — a failure here never affects completion.
 */

import { proofByKey } from "@/lib/proofs";

const PRIVATE_RUBRICS: Record<string, string[]> = {
  pm_norms: [
    "Uses the team's actual norms where they exist, without inventing team policy",
    "Addresses the teammate directly and respectfully",
    "Explains the impact and follows the agreed accountability process",
  ],
  comms_record: [
    "Distinguishes a reference transcript from official minutes",
    "Keeps useful records in the appropriate ClientVault location",
    "Avoids duplicating client correspondence and updates the existing project record",
  ],
  liaison_interview: [
    "Selects professional, open-ended questions that invite examples",
    "Removes duplicates and weak yes-or-no questions",
    "Uses a sensible interview order",
  ],
  liaison_loop: [
    "Confirms the call details through the official client channel",
    "Informs teammates and preserves the communication in ClientVault",
    "Records and follows through on resulting team actions",
  ],
  video_disaster: [
    "Addresses presentation, missing script, B-roll, participation, and consistency problems",
    "Corrects important problems before recording and protects the final product",
  ],
  tech_zip: [
    "Matches the required folder structure and naming",
    "Keeps file extensions and required files intact",
    "Uploads the completed ZIP",
  ],
  tech_presentation: [
    "Checks the physical connection, input, and display settings",
    "Tries sensible recovery steps and gives a practical backup plan",
  ],
  research_company: [
    "Covers the company, industry, background, and role using credible public sources",
    "Links sources to claims and separates verified facts from general role expectations",
  ],
};

/**
 * Lists the entry names in a ZIP by walking the central directory.
 * No decompression, so it is cheap and works on a large archive.
 */
export function listZipEntries(buf: ArrayBuffer): string[] {
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  // End of central directory: scan backwards for the 0x06054b50 signature.
  let eocd = -1;
  const min = Math.max(0, bytes.length - 66_000);
  for (let i = bytes.length - 22; i >= min; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return [];
  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const names: string[] = [];
  const decoder = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (offset + 46 > bytes.length) break;
    if (view.getUint32(offset, true) !== 0x02014b50) break;
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    names.push(decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLen)));
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return names.filter((n) => !n.startsWith("__MACOSX/"));
}

type FeedbackInput = {
  proofKey: string;
  answers: Record<string, string>;
  zipEntries?: string[];
  answerKey?: string | null;
  transcript?: string | null;
};

export type FeedbackResult = {
  status: "available" | "unavailable";
  text: string | null;
  /** Key points found (voicemail proof), parsed from the SCORE line. */
  score?: number | null;
};

/** Coaching feedback. Never a grade, never a pass/fail. */
export async function generateProofFeedback(input: FeedbackInput): Promise<FeedbackResult> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  const proof = proofByKey(input.proofKey);
  if (!apiKey || !proof) return { status: "unavailable", text: null };

  const parts: string[] = [
    `Activity: ${proof.title} (${proof.alias}) for the ${proof.role} role.`,
    `What the activity asked for:\n${proof.howTo}`,
  ];
  const rubric = PRIVATE_RUBRICS[proof.key];
  if (rubric?.length) {
    parts.push(`Private essential ideas for coaching:\n- ${rubric.join("\n- ")}`);
  }
  if (proof.scenario) parts.push(`Scenario given to the student:\n${proof.scenario}`);
  if (input.transcript) parts.push(`Reference transcript of the recording:\n${input.transcript.slice(0, 12_000)}`);
  if (input.answerKey) parts.push(`Expected structure (answer key):\n${input.answerKey.slice(0, 8_000)}`);
  if (input.zipEntries?.length)
    parts.push(`Files and folders in the student's uploaded ZIP:\n${input.zipEntries.slice(0, 400).join("\n")}`);
  parts.push(
    `Student's submission:\n${Object.entries(input.answers)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n\n")
      .slice(0, 12_000)}`,
  );

  // With an answer key (the voicemail proof), also record how many of the
  // expected key points the student found. The SCORE line is stripped from
  // the student-facing feedback and kept as the professor's record.
  const maxScore = proof.maxScore ?? 5;
  const scoringRule = input.answerKey
    ? ` Before the closing line, add a section labelled 'What you missed' that lists, as short bullets, every key point from the answer key the student did not capture, each stated plainly so they know exactly what it was; if they captured them all, write 'Nothing — you caught every key point.' After the closing line, add one final line in exactly this format: 'SCORE: N' where N is how many of the answer key's key points (out of ${maxScore}) the student's submission correctly identifies (0 if none). Judge by meaning, not exact wording. Accept concise answers and combined or reordered points when coverage is clear.`
    : "";

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are a supportive university course coach for a client-project class. Judge basic understanding and essential task coverage, not essay length, formatting, exhaustive detail, or wording. Accept concise answers and reasonable equivalent language. Never require a removed response format, time allocation, or extra detail that the student was not asked to provide. The student has already completed this participation activity; completion is not in question and you must never imply it can be revoked, graded, scored or redone. Reply in under 180 words as: 'What you did well' (1-2 specific points), 'What to strengthen next time' (up to 2 concrete points), and one short closing line. Plain, warm, direct. No markdown headings beyond those bold labels, no letter grade." +
              scoringRule,
          },
          { role: "user", content: parts.join("\n\n---\n\n") },
        ],
      }),
    });
    if (!res.ok) return { status: "unavailable", text: null };
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    let text = json.choices?.[0]?.message?.content?.trim();
    if (!text) return { status: "unavailable", text: null };

    let score: number | null = null;
    const scoreMatch = text.match(/SCORE:\s*(\d+)\s*$/im);
    if (scoreMatch) {
      score = Math.max(0, Math.min(maxScore, parseInt(scoreMatch[1]!, 10)));
      text = text.replace(/\n?SCORE:\s*\d+\s*$/im, "").trim();
    }
    return { status: "available", text, score };
  } catch {
    return { status: "unavailable", text: null };
  }
}
