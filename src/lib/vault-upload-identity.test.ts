import { test } from "node:test";
import { strict as assert } from "node:assert";
import { peerUploadSequence } from "./vault-upload-identity";

const file = (id: string, owner: string, assigned: string | null = null) => ({
  id, section: "Team Documents", subsection: "Mid-Semester Peer Reviews",
  assigned_to: assigned, uploaded_by: owner,
});
const version = (id: string, fileId: string, day: number, number = 1) => ({
  id, file_id: fileId, uploaded_at: `2026-10-${day}T12:00:00Z`, version_number: number,
});

test("a second peer-review file uploaded by the same member is revised even at v1", () => {
  const sequence = peerUploadSequence([file("original", "Isabella"), file("revision", "Isabella")],
    [version("updated", "revision", 23), version("first", "original", 20)]);
  assert.equal(sequence.get("first"), 1);
  assert.equal(sequence.get("updated"), 2);
});

test("each member has an independent original and assigned ownership is distinct from uploader", () => {
  const sequence = peerUploadSequence([file("a", "PM", "Isabella"), file("b", "PM", "Taylor")],
    [version("a1", "a", 20), version("b1", "b", 23)]);
  assert.equal(sequence.get("a1"), 1);
  assert.equal(sequence.get("b1"), 1);
});

test("new versions and separate uploads share chronological order; unrelated files do not count", () => {
  const sequence = peerUploadSequence([file("a", "member"), file("b", "member"),
    { ...file("research", "member"), subsection: "Client research" }],
    [version("a2", "a", 24, 2), version("b1", "b", 23), version("a1", "a", 20), version("r1", "research", 19)]);
  assert.equal(sequence.get("a1"), 1);
  assert.equal(sequence.get("b1"), 2);
  assert.equal(sequence.get("a2"), 3);
  assert.equal(sequence.has("r1"), false);
});