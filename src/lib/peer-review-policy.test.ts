import { describe, expect, it } from "vitest";
import { peerBadgeLabel, peerBadgeTone, MEETING_PEER_DUE } from "./peer-review-policy";

const before = new Date("2026-11-01T12:00:00Z");
const after = new Date("2026-11-10T12:00:00Z");

describe("peerBadgeLabel", () => {
  it("labels attempt 1 as Original Peer Review with the score", () => {
    expect(peerBadgeLabel({ score: 6, status: "scored", attempt: 1 })).toBe(
      "Original Peer Review 6/10",
    );
  });

  it("labels later attempts as Updated Peer Review with the score", () => {
    expect(peerBadgeLabel({ score: 8, status: "scored", attempt: 2 })).toBe(
      "Updated Peer Review 8/10",
    );
  });

  it("shows Not submitted when there is no score and status is missing", () => {
    expect(peerBadgeLabel({ score: null, status: "missing", attempt: 1 })).toBe("Not submitted");
  });
});

describe("peerBadgeTone", () => {
  it("uses 0-3 red, 4-6 yellow, 7-10 green before the deadline", () => {
    expect(peerBadgeTone(3, before)).toContain("destructive");
    expect(peerBadgeTone(4, before)).toContain("gold");
    expect(peerBadgeTone(6, before)).toContain("gold");
    expect(peerBadgeTone(7, before)).toContain("success");
    expect(peerBadgeTone(10, before)).toContain("success");
  });

  it("turns any score below 8 red after the 11/8 deadline", () => {
    expect(after > new Date(MEETING_PEER_DUE)).toBe(true);
    expect(peerBadgeTone(7, after)).toContain("destructive");
    expect(peerBadgeTone(5, after)).toContain("destructive");
    expect(peerBadgeTone(8, after)).toContain("success");
    expect(peerBadgeTone(9, after)).toContain("success");
  });

  it("keeps unscored badges muted", () => {
    expect(peerBadgeTone(null, after)).toContain("muted");
  });
});
