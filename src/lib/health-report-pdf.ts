import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

export type PdfCheck = { label: string; status: "pass" | "flagged" | "skipped" };
export type PdfConcern = { level: "red" | "yellow"; check: string; person: string | null; role: string | null; reason: string };

const clean = (s: string) =>
  s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/…/g, "...").replace(/·/g, "-")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "");

/** Builds a one-team Team Health Review PDF. */
export async function buildHealthReportPdf(opts: {
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
  text(`Good: ${good} checks passed    Still to do: ${opts.concerns.length} concerns`, bold, 11);
  y -= 8;
  text("What was checked", bold, 13);
  for (const c of opts.checks) {
    ensure(16);
    const color = c.status === "pass" ? green : c.status === "flagged" ? red : grey;
    page.drawCircle({ x: M + 4, y: y - 6, size: 4, color });
    text(`${c.label}: ${c.status === "pass" ? "Passed" : c.status === "flagged" ? "Needs work" : "Not checked"}`, font, 10, navy, M + 14);
  }
  y -= 10;
  text(`Concerns (${opts.concerns.length})`, bold, 13);
  if (!opts.concerns.length) text("No concerns found. Nice work.", font, 10, green);
  for (const c of opts.concerns) {
    ensure(30);
    page.drawCircle({ x: M + 4, y: y - 6, size: 4, color: c.level === "red" ? red : gold });
    const who = c.person ? ` - ${c.person}${c.role ? ` (${c.role})` : ""}` : "";
    text(`${c.level === "red" ? "Action required" : "Attention"} - ${c.check}${who}`, bold, 10, navy, M + 14);
    text(c.reason, font, 10, grey, M + 14, W - 2 * M - 14);
    y -= 4;
  }
  return doc.save();
}
