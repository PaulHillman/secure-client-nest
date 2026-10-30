import { RESEARCH_NOTE, type Comparison } from "./health-review-comparison";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

export type PdfCheck = { label: string; status: "pass" | "flagged" | "skipped" };
export type PdfConcern = { level: "red" | "yellow"; check: string; person: string | null; role: string | null; reason: string };

export function pdfCheckRating(check: PdfCheck, concerns: PdfConcern[]): "Good" | "Fair" | "Bad" | "Not checked" {
  if (check.status === "skipped") return "Not checked";
  if (check.status === "pass") return "Good";
  return concerns.some((c) => c.check === check.label && c.level === "red") ? "Bad" : "Fair";
}

const clean = (s: string) =>
  s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/…/g, "...").replace(/·/g, "-")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "");

/** Builds a one-team Team Health Review PDF. */
export async function buildHealthReportPdf(opts: {
  comparison?: Comparison;
  passNotes?: Record<string, string[]>;
  research?: { topics: { topic: string; evidence: { fileName: string; excerpt: string }[] }[]; unreadable: string[]; inspected: string[] };
  teamLabel: string; runAt: string; week: number; checks: PdfCheck[]; concerns: PdfConcern[];
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 612, H = 792, M = 54;
  let page = doc.addPage([W, H]);
  let y = H - M;
  const navy = rgb(0.07, 0.15, 0.25), grey = rgb(0.35, 0.4, 0.45);
  const red = rgb(0.75, 0.15, 0.15), gold = rgb(0.75, 0.57, 0.1), green = rgb(0.15, 0.55, 0.3);

  const wrap = (t: string, f: PDFFont, size: number, width: number) => {
    const words = clean(t).split(/\s+/); const lines: string[] = []; let cur = "";
    for (const w of words) {
      const next = cur ? cur + " " + w : w;
      if (f.widthOfTextAtSize(next, size) > width && cur) { lines.push(cur); cur = w; } else cur = next;
    }
    if (cur) lines.push(cur);
    return lines;
  };
  const ensure = (h: number) => { if (y - h < M) { page = doc.addPage([W, H]); y = H - M; } };
  const text = (t: string, f = font, size = 10, color = navy, x = M, width = W - 2 * M) => {
    for (const line of wrap(t, f, size, width)) {
      ensure(size + 4); page.drawText(line, { x, y: y - size, size, font: f, color }); y -= size + 4;
    }
  };

  text("Team Health Review", bold, 20);
  y -= 4;
  text(opts.teamLabel, bold, 13);
  text(`Run ${opts.runAt} - semester week ${opts.week}`, font, 10, grey);
  y -= 10;

  const good = opts.checks.filter((c) => c.status === "pass").length;
  const fair = opts.concerns.filter((c) => c.level === "yellow").length;
  const bad = opts.concerns.filter((c) => c.level === "red").length;
  text(`Good: ${good}  |  Fair: ${fair}  |  Bad: ${bad}`, bold, 11);
  y -= 8;
  if (opts.comparison) {
    text("Since your last shared report", bold, 13);
    text(opts.comparison.sharedAt ? `Baseline shared: ${opts.comparison.sharedAt} (${opts.comparison.source})` : "No verified prior shared report; no improvement claims can be made.", font, 10, grey);
    // Reporting corrections are instructor-only context; students' PDFs omit them.
    for (const change of opts.comparison.changes.filter(c => c.status !== "Reporting correction")) {
      y -= 5;
      text(`${change.status}${change.person ? " - " + change.person : ""}`, bold, 10, change.status === "Resolved" ? green : change.status === "Partially improved" ? gold : navy);
      if (change.previous) text(`Previously: ${change.previous}`, font, 10, grey);
      text(`Now: ${change.current}`);
    }
    y -= 10;
  }
  text("Research expectations", bold, 13);
  text(RESEARCH_NOTE, font, 10, grey);
  if (opts.research) {
    for (const topic of opts.research.topics) {
      text(`${topic.topic}: ${topic.evidence.length ? "text evidence found" : opts.research.unreadable.length ? "unverified" : "no text evidence found"}`, bold, 10);
      for (const e of topic.evidence) text(`${e.fileName}: ${e.excerpt}`, font, 9, grey);
    }
    if (opts.research.unreadable.length) text(`Unable to read: ${opts.research.unreadable.join(", ")}. Instructor review required.`, font, 10, grey);
  }
  y -= 10;
  text("What was checked", bold, 13);
  for (const c of opts.checks) {
    ensure(16);
    const rating = pdfCheckRating(c, opts.concerns);
    const color = rating === "Good" ? green : rating === "Fair" ? gold : rating === "Bad" ? red : grey;
    page.drawCircle({ x: M + 4, y: y - 6, size: 4, color });
    text(`${c.label}: ${rating}`, font, 10, navy, M + 14);
    if (c.status === "flagged") {
      const concerns = opts.concerns.filter((concern) => concern.check === c.label)
        .sort((a, b) => Number(b.level === "red") - Number(a.level === "red"));
      for (const concern of concerns) {
        const who = concern.person ? ` - ${concern.person}${concern.role ? ` (${concern.role})` : ""}` : "";
        text(`${concern.level === "red" ? "Bad" : "Fair"}${who}: ${concern.reason}`, font, 9, concern.level === "red" ? red : gold, M + 14, W - 2 * M - 14);
      }
    }
    const labels: Record<string, string> = { gaps: "Dashboard Gaps", readiness: "Team Readiness", meetings: "Weekly Meetings", activity: "Login / upload activity", vault: "File Vault requirements", reports: "Health Report follow-up" };
    for (const [key, notes] of Object.entries(opts.passNotes ?? {})) if (labels[key] === c.label) for (const note of notes) text(note, font, 9, grey, M + 14, W - 2 * M - 14);
  }
  y -= 10;
  text(`Concerns (${opts.concerns.length})`, bold, 13);
  if (!opts.concerns.length) text("No concerns found. Nice work.", font, 10, green);
  for (const c of opts.concerns) {
    ensure(30);
    page.drawCircle({ x: M + 4, y: y - 6, size: 4, color: c.level === "red" ? red : gold });
    const who = c.person ? ` - ${c.person}${c.role ? ` (${c.role})` : ""}` : "";
    text(`${c.level === "red" ? "Bad" : "Fair"} - ${c.check}${who}`, bold, 10, navy, M + 14);
    text(c.reason, font, 10, grey, M + 14, W - 2 * M - 14);
    y -= 4;
  }
  return doc.save();
}
