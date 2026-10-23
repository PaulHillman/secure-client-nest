import test from "node:test";
import assert from "node:assert/strict";
import { resolveReviewAnswers } from "./submission-review-answers";

const company = {
  company_name: "Fifth Wheel Freight", contact_person: "Dylan Buresh",
  contact_job_title: "Director of Development", industry: "Freight",
  employee_count: "170", hq_address: null,
};

test("review reads saved client details when no answer sheet exists", () => {
  const result = resolveReviewAnswers({}, company);
  assert.equal(result.answers.company_name, "Fifth Wheel Freight");
  assert.equal(result.answers.manager_name, "Dylan Buresh");
  assert.equal(result.answers.company_size, "170");
  assert.ok(result.currentRecordFields.includes("company_name"));
  assert.equal(result.answers.why_company, undefined);
});

test("written submission is preserved rather than replaced by current company details", () => {
  const result = resolveReviewAnswers({ company_name: "Original client" }, company);
  assert.equal(result.answers.company_name, "Original client");
  assert.ok(!result.currentRecordFields.includes("company_name"));
});

test("missing company and placeholders are not invented answers", () => {
  assert.deepEqual(resolveReviewAnswers({}, null).answers, {});
  assert.equal(resolveReviewAnswers({}, { ...company, contact_person: "Not supplied" }).answers.manager_name, undefined);
});