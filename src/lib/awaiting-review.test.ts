import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { assembleAwaitingReview } from "./awaiting-review";

const TEST_TEAM = {
  id: "4699c631-3ff9-4f1b-b0c4-3a718fdca370",
  name: "Team 8",
  display_name: "C/D/H Consulting",
  section: "05",
  is_test: true,
};
const REAL_TEAM = {
  id: "9dad5393-0d64-491b-931e-d2becf3ce2ad",
  name: "Team 1",
  display_name: "Theory Y",
  section: "04",
  is_test: false,
};

function build() {
  return assembleAwaitingReview({
    reqStatuses: [
      {
        id: "r-test",
        team_id: TEST_TEAM.id,
        requirement_key: "client_selected",
        submitted_at: "2026-09-13T15:00:00Z",
      },
      {
        id: "r-real",
        team_id: REAL_TEAM.id,
        requirement_key: "team_setup",
        submitted_at: "2026-10-20T15:00:00Z",
      },
    ],
    managerSubmissions: [
      {
        id: "m-test",
        team_id: TEST_TEAM.id,
        manager_first_name: "Test",
        manager_last_name: "Manager",
        company_name: "C/D/H Consulting",
        created_at: "2026-09-13T15:00:00Z",
      },
      {
        id: "m-real",
        team_id: REAL_TEAM.id,
        manager_first_name: "Chad",
        manager_last_name: "Groggel",
        company_name: "The CPA Group",
        created_at: "2026-10-20T15:00:00Z",
      },
    ],
    peerAssessments: [
      {
        id: "p-test",
        team_id: TEST_TEAM.id,
        user_id: "u-test",
        attempt: 3,
        score: 5,
        created_at: "2026-10-20T15:00:00Z",
      },
      {
        id: "p-real",
        team_id: REAL_TEAM.id,
        user_id: "u-real",
        attempt: 3,
        score: 6,
        created_at: "2026-10-21T15:00:00Z",
      },
    ],
    teams: [TEST_TEAM, REAL_TEAM],
    requirementDefs: [
      { key: "client_selected", title: "Client Selected" },
      { key: "team_setup", title: "Team Setup" },
    ],
    profiles: [
      { id: "u-test", name: "Test Student", first_name: "Test", last_name: "Student" },
      { id: "u-real", name: "Real Student", first_name: "Real", last_name: "Student" },
    ],
  });
}

describe("awaiting review queue", () => {
  test("drops requirement submissions from a test team", () => {
    const q = build();
    assert.deepEqual(
      q.requirements.map((r) => r.id),
      ["r-real"],
    );
    assert.ok(!q.requirements.some((r) => r.teamName.includes("C/D/H")));
  });

  test("drops manager approvals from a test team", () => {
    const q = build();
    assert.deepEqual(
      q.managers.map((m) => m.id),
      ["m-real"],
    );
  });

  test("drops peer-review meeting decisions from a test team", () => {
    const q = build();
    assert.deepEqual(
      q.peerDecisions.map((p) => p.id),
      ["p-real"],
    );
  });

  test("total counts only the items that remain", () => {
    assert.equal(build().total, 3);
  });

  test("an all-test queue is empty", () => {
    const q = assembleAwaitingReview({
      reqStatuses: [
        {
          id: "r-test",
          team_id: TEST_TEAM.id,
          requirement_key: "client_selected",
          submitted_at: "2026-09-13T15:00:00Z",
        },
      ],
      managerSubmissions: [],
      peerAssessments: [],
      teams: [TEST_TEAM],
      requirementDefs: [{ key: "client_selected", title: "Client Selected" }],
      profiles: [],
    });
    assert.equal(q.total, 0);
    assert.equal(q.requirements.length, 0);
  });
});
