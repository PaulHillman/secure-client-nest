import { describe, expect, it } from "vitest";
import { isApplePagesFile, unreadableFileExplanation } from "./file-format-note";

describe("unreadableFileExplanation", () => {
  it("explains that a .pages file is an Apple format and must be exported as PDF or DOCX", () => {
    const msg = unreadableFileExplanation("Seth Peer Review.pages");
    expect(msg).toContain("Apple Pages");
    expect(msg).toContain(".pages");
    expect(msg).toContain("PDF");
    expect(msg).toContain("DOCX");
    expect(msg).toContain("Seth Peer Review.pages");
  });

  it("matches the .pages extension case-insensitively", () => {
    expect(isApplePagesFile("Review.PAGES")).toBe(true);
    expect(isApplePagesFile("Review.pdf")).toBe(false);
  });

  it("gives generic re-upload guidance for other unreadable files", () => {
    const msg = unreadableFileExplanation("notes.xyz");
    expect(msg).not.toContain("Apple Pages");
    expect(msg).toContain("DOCX or PDF");
  });
});
