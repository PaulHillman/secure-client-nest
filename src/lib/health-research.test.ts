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

test('cited research confirmation covers only its exact version and actual excerpt', async () => {
  const text = 'Corporate lending, acquisition financing, cash flow management, and maintaining relationships with business clients.';
  const db = {
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { storage_path: 'role.txt', file_size: text.length }, error: null }) }) }) }),
    storage: { from: () => ({ download: async () => ({ data: new Blob([text]), error: null }) }) },
  };
  const files = [{ file_name: 'What does Diane do?', current_version_id: 'v3' }];
  const record = (versionId: string, excerpt: string) => [{ file_name: files[0].file_name, note: 'health_research_evidence:' + JSON.stringify({ versionId, topics: [{ topic: 'Client job description', excerpt }] }) }];
  const evidence = async (version: string, excerpt: string) => (await inspectResearch(db, files, undefined, record(version, excerpt))).topics.find(t => t.topic === 'Client job description')?.evidence.length;
  assert.equal(await evidence('v3', text), 1);
  assert.equal(await evidence('v2', text), 0);
  assert.equal(await evidence('v3', 'This invented description is not present in the actual uploaded research document.'), 0);
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