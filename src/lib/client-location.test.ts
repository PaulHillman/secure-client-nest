import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyLocation } from "./team-readiness-assessment";

test("a full Grand Rapids street address counts as inside West Michigan", () => {
  assert.equal(classifyLocation("2350 3 Mile Rd NW Grand Rapids, MI 49544 United States").verdict, "inside");
});
