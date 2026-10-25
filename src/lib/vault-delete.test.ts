import { test } from "node:test";
import { strict as assert } from "node:assert";
import { deleteVaultRecord } from "./vault-delete";

test("failed deletion never removes the PDF or reports success", async () => {
  let removed = false;
  await assert.rejects(deleteVaultRecord(async () => ({ data: null, error: { message: "File is protected" } }), async () => {
    removed = true;
    return { error: null };
  }), /File is protected/);
  assert.equal(removed, false);
});

test("successful listing deletion precedes storage cleanup", async () => {
  const steps: string[] = [];
  const result = await deleteVaultRecord(async () => {
    steps.push("listing deleted");
    return { data: ["revision.pdf"], error: null };
  }, async paths => {
    assert.deepEqual(paths, ["revision.pdf"]);
    steps.push("storage removed");
    return { error: null };
  });
  assert.deepEqual(steps, ["listing deleted", "storage removed"]);
  assert.equal(result.cleanupPending, false);
});

test("an already missing PDF does not prevent deleting its listing", async () => {
  const result = await deleteVaultRecord(async () => ({ data: ["missing.pdf"], error: null }), async () => ({ error: { message: "Object missing" } }));
  assert.equal(result.cleanupPending, true);
});