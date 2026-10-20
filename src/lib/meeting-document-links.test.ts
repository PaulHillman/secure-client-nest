import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { meetingDocumentLinks } from "./meeting-document-links";

describe("meeting document connections", () => {
  const meeting = { id: "meeting-1", meeting_date: "2026-09-23", minutes_file_id: "legacy-minutes" };
  it("requires an explicit agenda connection, not just a matching date in its name", () => {
    assert.equal(meetingDocumentLinks([meeting], [{ id: "agenda", file_name: "Agenda 9-23.pdf", subsection: "Agendas" }])[0].agendas.length, 0);
  });
  it("accepts explicitly attached agendas and legacy minutes connections", () => {
    const result = meetingDocumentLinks([meeting], [
      { id: "agenda", file_name: "Agenda.pdf", subsection: "Agendas", meeting_log_id: "meeting-1" },
      { id: "legacy-minutes", file_name: "Minutes.pdf", subsection: "Minutes" },
    ])[0];
    assert.equal(result.agendas.length, 1);
    assert.equal(result.minutes.length, 1);
  });
  it("does not credit a shared template or minutes misfiled as an agenda", () => {
    const result = meetingDocumentLinks([meeting], [
      { id: "template", file_name: "Template.docx", subsection: "Minutes", meeting_log_id: "meeting-1", is_template: true },
      { id: "misfile", file_name: "Meeting_Minutes.docx", subsection: "Agendas", meeting_log_id: "meeting-1" },
    ])[0];
    assert.equal(result.agendas.length, 0);
    assert.equal(result.minutes.length, 0);
  });
});