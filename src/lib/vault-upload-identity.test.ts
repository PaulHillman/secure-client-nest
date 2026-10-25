import { test } from "node:test";
import { strict as assert } from "node:assert";
import { peerUploadSequence, groupPeerUploads } from "./vault-upload-identity";

const file = (id: string, owner: string, assigned: string | null = owner) => ({
  id, section: "Team Documents", subsection: "Mid-Semester Peer Reviews",
  assigned_to: assigned, uploaded_by: owner,
});
const version = (id: string, fileId: string, day: number, number = 1) => ({
  id, file_id: fileId, uploaded_at: `2026-10-${day}T12:00:00Z`, version_number: number,
});

test("Isabella's original stays directly before her revision regardless of intervening teammates", () => {
  const groups = groupPeerUploads([
    { ...file("revision", "Isabella"), created_at: "2026-10-23" },
    { ...file("other", "Taylor"), created_at: "2026-10-20" },
    { ...file("original", "Isabella"), created_at: "2026-10-20" },
  ]);
  assert.deepEqual(groups.find((g) => g.owner === "Isabella")?.files.map((f) => f.id), ["original", "revision"]);
  assert.equal(groups.length, 2);
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

test("Nicolas uploading Simon and Blake's first reviews does not create revisions", () => {
  const files = [file("simon", "Nicolas", "Simon"), file("blake", "Nicolas", "Blake")];
  const sequence = peerUploadSequence(files, [version("s1", "simon", 24), version("b1", "blake", 24)]);
  assert.equal(sequence.get("s1"), 1);
  assert.equal(sequence.get("b1"), 1);
  assert.deepEqual(groupPeerUploads(files.map(f => ({ ...f, created_at: "2026-10-24" }))).map(g => g.owner), ["Simon", "Blake"]);
});

test("unknown owners are not counted as the uploader's attempts", () => {
  const files = [file("simon", "Nicolas", null), file("blake", "Nicolas", null)];
  assert.equal(peerUploadSequence(files, [version("s1", "simon", 24), version("b1", "blake", 24)]).size, 0);
  assert.equal(groupPeerUploads(files.map(f => ({ ...f, created_at: "2026-10-24" }))).length, 2);
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