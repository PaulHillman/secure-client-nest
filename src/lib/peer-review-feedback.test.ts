import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { peerPriorityFixes } from "./peer-review-feedback";

describe("peer review priority fixes", () => {
  test("below 8 shows the top three in assessment priority order", () => {
    assert.deepEqual(peerPriorityFixes(7, ["Specific examples", "Measurable behaviors", "Personal reflection", "Extra detail"]),
      ["Specific examples", "Measurable behaviors", "Personal reflection"]);
  });
  test("8/10 or above does not require fixes", () => {
    assert.deepEqual(peerPriorityFixes(8, ["Optional detail"]), []);
  });
  test("unscored files never invent improvement advice", () => {
    assert.deepEqual(peerPriorityFixes(null, ["Some advice"]), []);
  });
  test("legacy feedback keeps available evidence without inventing three items", () => {
    assert.deepEqual(peerPriorityFixes(6, [null, "", " Fix the total "]), ["Fix the total"]);
  });
});