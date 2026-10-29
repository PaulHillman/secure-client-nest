import { test } from "node:test";
import { strict as assert } from "node:assert";
import { MINUTES_TEMPLATE_MIN_MARKERS, countMinutesTemplateMarkers, minutesFollowTemplate, normalizeMinutesText, isPeerReviewMinutesSupplement, isStandaloneMinutesSubmission } from "./minutes-template";

// Real submitted minutes, extracted text (calibration samples).
test("template eligibility requires actual standalone minutes, not supplementary uploads or other folders", () => {
  const file = { section: "Team Documents", subsection: "Minutes", file_name: "Meeting 6 Minutes.docx", category: "Minutes" };
  assert.equal(isStandaloneMinutesSubmission(file), true);
  assert.equal(isStandaloneMinutesSubmission({ ...file, subsection: "Client Communications" }), false);
  assert.equal(isStandaloneMinutesSubmission({ ...file, subsection: "Mid-Semester Peer Reviews" }), false);
  assert.equal(isStandaloneMinutesSubmission({ ...file, section: "Semester Long Project" }), false);
  assert.equal(isStandaloneMinutesSubmission({ ...file, category: "Other" }), false);
  assert.equal(isStandaloneMinutesSubmission({ ...file, file_name: "Peer Review Appendix.docx" }), false);
  assert.equal(isStandaloneMinutesSubmission({ ...file, is_template: true }), false);
});
test("peer review appendix/index remains a minutes supplement, while normal minutes still require the template", () => {
  assert.equal(isPeerReviewMinutesSupplement("Peer Review Appendix.docx"), true);
  assert.equal(isPeerReviewMinutesSupplement("Core Consulting Peer Review Appendix.pdf"), true);
  assert.equal(isPeerReviewMinutesSupplement("Peer-Review Index.pdf"), true);
  assert.equal(isPeerReviewMinutesSupplement("Oak and Iron Meeting 6 Minutes.docx"), false);
  assert.equal(isPeerReviewMinutesSupplement("Peer Review.docx"), false);
  assert.equal(isPeerReviewMinutesSupplement("Research Appendix.docx"), false);
});
const templateDocx = "Theory Y | Minutes | October 14, 2026 | 1:00 Pm | SCB 2001 | project manager | Eli Grogeel | Notetaker | Addy Warmbein | attendees | Sam, Danny, Eli, Rebeca, Addy | missing attendees | None | attendees arriving late | Danny | Agenda topics | LAST WEEKS MEETING MINUTES | Discussion | Reviewed the team health report | Conclusions | Resolved key issues.";
const templatePdf = "[Core Consulting] | MINUTES OCTOBER 14, 2026 2:45PM UPSTAIRS TEAM ROOM #2 | PROJECT MANAGER Anthony | NOTETAKER Nora | ATTENDEES Nora, Ellen, Charlie, Anthony, Lea | MISSING ATTENDEES | ATTENDEES ARRIVING | LATE | Agenda topics | TEAM HEALTH REVIEW | DISCUSSION Review our team's health score. | CONCLUSIONS 2 missing client rearch.";
const unfilledTemplateDocx = "[ENTER YOUR FIRM NAME] | Minutes | [Click to Select Date] | 1:00 PM – 1:30 PM | [Meeting Location] | project manager | [Name] | Notetaker | [Name] | attendees | All group members | missing attendees | None | attendees arriving late | None – everyone arrived on time or early | Agenda topics | Discussion | Conclusions";
const freeFormPdf = "MEETING Wednesday, 10/14 | Time: 12:26-1:12pm | Location: Seidman College of Business Study RM 2036 | Present: Julian, Claire, Jaydan, Jackson, Karli | AGENDA | Review last week minutes | Interview time? | Reach out to Rick | INTERVIEW TIMES | Contact Rick Skodak TODAY about the two possible days we can interview him";

test("minutes built from the template pass, including filled and unfilled DOCX and a PDF rendition", () => {
  assert.equal(minutesFollowTemplate(templateDocx), true);
  assert.equal(minutesFollowTemplate(templatePdf), true);
  assert.equal(minutesFollowTemplate(unfilledTemplateDocx), true);
});

test("free-form minutes without the template's labels fail", () => {
  assert.equal(minutesFollowTemplate(freeFormPdf), false);
  assert.ok(countMinutesTemplateMarkers(freeFormPdf) < MINUTES_TEMPLATE_MIN_MARKERS);
});

test("marker matching is case-insensitive and ignores punctuation and line breaks", () => {
  const norm = normalizeMinutesText("MISSING ATTENDEES: none.\nAttendees-Arriving\nLate...AGENDA TOPICS");
  assert.ok(norm.includes("missing attendees"));
  assert.ok(norm.includes("arriving late"));
  assert.ok(norm.includes("agenda topics"));
});

test("a minutes file missing only one template label still counts as following it", () => {
  const missingNotetaker = templateDocx.replace(/Notetaker \| Addy Warmbein \|/i, "").replace(/Notetaker/i, "Recorder");
  assert.equal(minutesFollowTemplate(missingNotetaker), true);
});

test("a minutes file missing several template labels does not", () => {
  const partial = "Minutes | October 14, 2026 | Discussion about the competition | Conclusions reached.";
  assert.equal(minutesFollowTemplate(partial), false);
});

test("template exemption follows the meeting date, not the upload date", async () => {
  const { minutesExemptFromTemplate: ex } = await import("./minutes-template");
  assert.equal(ex({ id: "a", file_name: "09-16-2026_MEETING_MINUTES", created_at: "2026-10-20T12:00:00Z" }, []), true);
  assert.equal(ex({ id: "b", file_name: "09-30-2026_MEETING_MINUTES", created_at: "2026-10-12T12:00:00Z" }, []), false);
  assert.equal(ex({ id: "c", file_name: "10_21 meeting minutes.pdf", created_at: "2026-10-22T12:00:00Z" }, []), false);
  assert.equal(ex({ id: "d", file_name: "notes.docx", created_at: "2026-10-20T12:00:00Z", meeting_log_id: "m" }, [{ id: "m", meeting_date: "2026-09-23" }]), true);
});
