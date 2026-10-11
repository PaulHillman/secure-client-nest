import { before, describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { signFileTicket, verifyFileTicket } from "./file-ticket.server";

before(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-secret";
});

describe("file download tickets", () => {
  test("accepts a fresh ticket for the same file", async () => {
    const t = await signFileTicket("ver-1");
    assert.equal(await verifyFileTicket(t), "ver-1");
  });
  test("rejects a ticket older than 5 minutes", async () => {
    const t = await signFileTicket("ver-1", Date.now() - 6 * 60 * 1000);
    assert.equal(await verifyFileTicket(t), null);
  });
  test("rejects a ticket pointed at a different file", async () => {
    const [, sig] = (await signFileTicket("ver-1")).split(".");
    const other = (await signFileTicket("ver-2")).split(".")[0];
    assert.equal(await verifyFileTicket(`${other}.${sig}`), null);
  });
});
