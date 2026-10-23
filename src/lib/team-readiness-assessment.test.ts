import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { assessTeam, type AssessmentInput } from "./team-readiness-assessment";

/** A team that has picked a client but never recorded a selection rationale. */
function inputWithoutRationale(): AssessmentInput {
  const pm = "11111111-1111-1111-1111-111111111111";
  return {
    team: { id: "t1", name: "Team 1", display_name: "Team 1", section: "04", is_test: false },
    members: [
      { user_id: pm, job_title: "PM" },
      { user_id: "22222222-2222-2222-2222-222222222222", job_title: "Company Liaison" },
      { user_id: "33333333-3333-3333-3333-333333333333", job_title: "Client Vault & Tech Administrator" },
      { user_id: "44444444-4444-4444-4444-444444444444", job_title: "Communication Specialist" },
      { user_id: "55555555-5555-5555-5555-555555555555", job_title: "Video Specialist" },
      { user_id: "66666666-6666-6666-6666-666666666666", job_title: "Researcher" },
    ],
    profiles: new Map([
      [pm, { name: "Alex PM" }],
      ["22222222-2222-2222-2222-222222222222", { name: "Bailey Liaison" }],
      ["33333333-3333-3333-3333-333333333333", { name: "Casey Tech" }],
      ["44444444-4444-4444-4444-444444444444", { name: "Dana Comms" }],
      ["55555555-5555-5555-5555-555555555555", { name: "Ellis Video" }],
      ["66666666-6666-6666-6666-666666666666", { name: "Frankie Research" }],
    ]),
    companyFocus: {
      company_name: "Miller Knoll",
      industry: "Furniture",
      contact_person: "Rick Skodack",
      contact_job_title: "Director",
      email: "rick@example.com",
      website: "https://example.com",
      employee_count: "200",
      hq_address: "123 Main St, Grand Rapids, MI",
      updated_at: "2026-10-01T00:00:00Z",
    },
    clientSubmission: { answers: {}, submitted_at: "2026-10-01T00:00:00Z", submitted_by: pm },
    clientStatus: { status: "approved", revision_note: null, decided_at: "2026-10-02T00:00:00Z" },
    setupStatus: { status: "approved", submitted_at: "2026-10-01T00:00:00Z" },
    proposal: { day_of_week: 3, meeting_time: "18:00", location: "Library", meeting_mode: "Hybrid" },
    agreements: [],
    norms: { version: 1, content: { communication: "Respond within 24 hours." }, uploaded_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z" },
    normsSignatures: [],
    proofSubmissions: [],
    generatedAt: "2026-10-23T10:00:00Z",
  };
}

describe("team readiness assessment", () => {
  test("a client with no recorded selection rationale raises no finding", () => {
    const a = assessTeam(inputWithoutRationale());
    const all = [...a.blockers, ...a.warnings];
    assert.equal(all.some((f) => f.key === "no_rationale"), false);
    assert.equal(
      all.some((f) => /rationale/i.test(f.reason)),
      false,
      "no finding may mention a selection rationale",
    );
    // The client itself is still reported as present, so the rest of the report is intact.
    assert.equal(a.client.present, true);
    assert.equal(a.client.companyName, "Miller Knoll");
  });
});
