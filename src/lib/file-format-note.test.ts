import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { isApplePagesFile, unreadableFileExplanation } from "./file-format-note";

describe("unreadableFileExplanation", () => {
  test("explains that a .pages file is an Apple format and must be exported as PDF or DOCX", () => {
    const msg = unreadableFileExplanation("Seth Peer Review.pages");
    assert.match(msg, /Apple Pages/);
    assert.match(msg, /\.pages/);
    assert.match(msg, /PDF/);
    assert.match(msg, /DOCX/);
    assert.match(msg, /Seth Peer Review\.pages/);
  });

  test("matches the .pages extension case-insensitively", () => {
    assert.equal(isApplePagesFile("Review.PAGES"), true);
    assert.equal(isApplePagesFile("Review.pdf"), false);
  });

  test("gives generic re-upload guidance for other unreadable files", () => {
    const msg = unreadableFileExplanation("notes.xyz");
    assert.doesNotMatch(msg, /Apple Pages/);
    assert.match(msg, /DOCX or PDF/);
  });
});
