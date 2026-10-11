import { beforeAll, describe, expect, it } from "vitest";
import { signFileTicket, verifyFileTicket } from "./file-ticket.server";

beforeAll(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-secret";
});

describe("file download tickets", () => {
  it("accepts a fresh ticket for the same file", async () => {
    const t = await signFileTicket("ver-1");
    expect(await verifyFileTicket(t)).toBe("ver-1");
  });
  it("rejects a ticket older than 5 minutes", async () => {
    const t = await signFileTicket("ver-1", Date.now() - 6 * 60 * 1000);
    expect(await verifyFileTicket(t)).toBeNull();
  });
  it("rejects a ticket pointed at a different file", async () => {
    const [, sig] = (await signFileTicket("ver-1")).split(".");
    const other = (await signFileTicket("ver-2")).split(".")[0];
    expect(await verifyFileTicket(`${other}.${sig}`)).toBeNull();
  });
});
