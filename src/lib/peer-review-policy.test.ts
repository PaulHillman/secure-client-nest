import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { peerBadgeLabel, peerBadgeTone, peerReviewPass, MEETING_PEER_DUE } from "./peer-review-policy";

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
  test("a revised 7/10 stays yellow and does not pass", () => {
    for (const attempt of [2, 3]) {
      assert.match(peerBadgeTone(7, before, attempt), /gold/);
      assert.equal(peerReviewPass(7, attempt), false);
    }
  });

  test("revisions turn green starting at 8/10", () => {
    for (const score of [8, 9, 10]) {
      assert.match(peerBadgeTone(score, before, 2), /success/);
      assert.equal(peerReviewPass(score, 2), true);
    }
  });

  test("an original 7/10 remains a green pass", () => {
    assert.match(peerBadgeTone(7, before, 1), /success/);
    assert.equal(peerReviewPass(7, 1), true);
  });

  test("revised 7/10 turns red after the meeting deadline", () => {
    assert.match(peerBadgeTone(7, after, 2), /destructive/);
  });

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

import { test as t2 } from 'node:test';
import { strict as a2 } from 'node:assert';
import { peerBadgeTone as tone2, peerBadgeLabel as label2 } from './peer-review-policy';
t2('a 7/10 revision accepted after discussion shows green and says accepted, even after 11/8', () => {
  a2.match(tone2(7, new Date('2026-11-20'), 3, '2026-10-26T18:00:00Z'), /success/);
  a2.equal(label2({ score: 7, status: 'assessed', attempt: 3, accepted_at: '2026-10-26T18:00:00Z' }), 'Accepted after discussion 7/10');
  a2.doesNotMatch(tone2(7, new Date('2026-10-27'), 3), /success/);
});
