import { test } from "node:test";
import { strict as assert } from "node:assert";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { inspectResearch } from "./health-research.server";
import { buildHealthReportPdf } from "./health-report-pdf";
import { extractText } from "unpdf";
import JSZip from "jszip";

test("research DOCX remains readable when its vault display name has no extension", async () => {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Company founded in 2000. Industry: banking. Competitors: Acme. Client job description: manager duties.</w:t></w:r></w:p></w:body></w:document>');
  const bytes = await zip.generateAsync({ type: 'uint8array' });
  const db = {
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { storage_path: 'teams/test/v3-research.docx', file_size: bytes.length }, error: null }) }) }) }),
    storage: { from: () => ({ download: async () => ({ data: new Blob([Uint8Array.from(bytes)]), error: null }) }) },
  };
  const result = await inspectResearch(db, [{ file_name: 'Company History and Industry Analysis', current_version_id: 'v3' }]);
  assert.equal(result.unreadable.length, 0);
  assert.equal(result.inspected.length, 1);
  assert.equal(result.topics.filter(t => t.evidence.length === 1).length, 4);
});

test("research inspection reads actual PDF bytes and accepts all four topics in one file", async () => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  doc.addPage().drawText("Company founded in 2000. Industry: retail. Competitors: Acme. Client job description: manager duties.", { font, size: 9 });
  const bytes = await doc.save();
  const db = {
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { storage_path: "test.pdf", file_size: bytes.length }, error: null }) }) }) }),
    storage: { from: () => ({ download: async () => ({ data: new Blob([Uint8Array.from(bytes)]), error: null }) }) },
  };
  const result = await inspectResearch(db, [{ file_name: "Combined research.pdf", current_version_id: "test-version" }]);
  assert.equal(result.inspected.length, 1);
  assert.equal(result.unreadable.length, 0);
  assert.equal(result.topics.filter(t => t.evidence.length === 1).length, 4);
});

test("generated PDF carries the same specific before and after evidence", async () => {
  const bytes = await buildHealthReportPdf({
    teamLabel: "Test team", runAt: "October 17, 2026", week: 7, checks: [], concerns: [],
    comparison: { sharedAt: "2026-10-09T03:37:40Z", source: "verified_send", changes: [{ status: "Resolved", previous: "No selection rationale recorded", current: "A client selection rationale is now recorded. Thank you for addressing this deficiency.", person: null }] },
  });
  const { text } = await extractText(bytes, { mergePages: true });
  assert.match(text, /Since your last shared report/);
  assert.match(text, /Previously: No selection rationale recorded/);
  assert.match(text, /Now: A client selection rationale is now recorded/);
  assert.match(text, /company history\/information, industry information, competitors/);
});