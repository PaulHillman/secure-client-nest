import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { peerBadgeLabel, peerBadgeTone, MEETING_PEER_DUE } from "./peer-review-policy";

const before = new Date("2026-11-01T12:00:00Z");
const after = new Date("2026-11-10T12:00:00Z");

describe("peerBadgeLabel", () => {
  test("labels attempt 1 as Original Peer Review with the score", () => {
    assert.equal(
      peerBadgeLabel({ score: 6, status: "scored", attempt: 1 }),
      "Original Peer Review 6/10",
    );
  });

  test("labels later attempts as Updated Peer Review with the score", () => {
    assert.equal(
      peerBadgeLabel({ score: 8, status: "scored", attempt: 2 }),
      "Updated Peer Review 8/10",
    );
  });

  test("shows Not submitted when there is no score and status is missing", () => {
    assert.equal(peerBadgeLabel({ score: null, status: "missing", attempt: 1 }), "Not submitted");
  });
});

describe("peerBadgeTone", () => {
  test("uses 0-3 red, 4-6 yellow, 7-10 green before the deadline", () => {
    assert.match(peerBadgeTone(3, before), /destructive/);
    assert.match(peerBadgeTone(4, before), /gold/);
    assert.match(peerBadgeTone(6, before), /gold/);
    assert.match(peerBadgeTone(7, before), /success/);
    assert.match(peerBadgeTone(10, before), /success/);
  });

  test("turns any score below 8 red after the 11/8 deadline", () => {
    assert.ok(after > new Date(MEETING_PEER_DUE));
    assert.match(peerBadgeTone(7, after), /destructive/);
    assert.match(peerBadgeTone(5, after), /destructive/);
    assert.match(peerBadgeTone(8, after), /success/);
    assert.match(peerBadgeTone(9, after), /success/);
  });

  test("keeps unscored badges muted", () => {
    assert.match(peerBadgeTone(null, after), /muted/);
  });
});
