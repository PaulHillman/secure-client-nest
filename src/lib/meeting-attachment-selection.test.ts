import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { meetingAttachmentState } from "./meeting-attachment-selection";

describe("existing meeting attachment selection", () => {
  const meeting = { id: "sep16", team_id: "oak", minutes_file_id: "legacy" };
  const file = { id: "agenda", team_id: "oak", section: "Team Documents", subsection: "Agendas", is_template: false, meeting_log_id: null };
  it("allows an already uploaded agenda or minutes file from the same team", () => {
    assert.equal(meetingAttachmentState(file, meeting, []), "available");
    assert.equal(meetingAttachmentState({ ...file, subsection: "Minutes" }, meeting, []), "available");
  });
  it("preserves existing attachments and legacy minutes", () => {
    assert.equal(meetingAttachmentState({ ...file, meeting_log_id: "sep16" }, meeting, []), "attached");
    assert.equal(meetingAttachmentState({ ...file, id: "legacy", subsection: "Minutes" }, meeting, []), "attached");
  });
  it("does not steal documents from another meeting", () => {
    assert.equal(meetingAttachmentState({ ...file, meeting_log_id: "sep21" }, meeting, []), "unavailable");
    assert.equal(meetingAttachmentState(file, meeting, [{ id: "sep21", minutes_file_id: "agenda" }]), "unavailable");
  });
  it("excludes other teams, templates and unrelated folders", () => {
    assert.equal(meetingAttachmentState({ ...file, team_id: "other" }, meeting, []), "unavailable");
    assert.equal(meetingAttachmentState({ ...file, is_template: true }, meeting, []), "unavailable");
    assert.equal(meetingAttachmentState({ ...file, subsection: "Research" }, meeting, []), "unavailable");
  });
  it("allows a peer-review appendix stored under Minutes without changing its category", () => {
    assert.equal(meetingAttachmentState({ ...file, id: "appendix", subsection: "Minutes" }, meeting, []), "available");
  });
});