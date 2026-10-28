# ClientVault roadmap

## Discussion decisions
- [ ] Add meeting confirmation, comments and accept/deduction decisions directly from Awaiting Review using latest submissions only.
- [ ] Record Sky and Branden's completed meetings and individual 7.6 threshold; retain original scores.
- [ ] Verify saved decisions leave the queue and test the 7.6 / -10 rule.

## Competition grading references
- [x] Add an Admin menu choice with separate Competition 1, 2 and 3 references; retain Competition 2 as historical only and leave unsupplied references empty.
- [x] Verify the Admin link and all three reference selections in the signed-in app; build OK and no browser page errors.

## Peer-review meeting workspace
- [x] Verify all four named students in Calendly and import verified meetings; retain Edwin's actual non-peer-review topic and Sky's email mismatch label.
- [x] Add student histories, exact-version documents, highlighted text comparisons and saved remaining fixes; verified Branden's typed changes and Sky's scan fallback.
- [x] Add one-use final-upload authorization and assessment eligibility against 8/10, preserving prior attempts; no real student was unlocked or given a new score.
- [x] Verify calendar sync, instructor workspace, 29 tests and live rejection of Sky's unapproved fourth upload. A real instructor-authorized final upload and resulting assessment remain unverified until a student's meeting.

## Concise revision emails
- [x] Focus revision feedback on 8/10, three fixes, remaining chance and one meeting instruction; preserve original pass policy.
- [x] Verify attempt-specific next steps and provide a first-revision email example without sending emails; 14 tests passed, both revision emails rendered with one meeting link and no redundant concerns, build OK.
- [x] Lock final revision templates: first revision omits the meeting link, second revision (meeting required) includes it; six email tests passed, app serving with no build failures recorded.

## Oak & Iron peer reviews
- [x] Verify all five document author headers, correct ownership while preserving actual uploaders, and retain Alex's misattributed assessment as invalid audit history.
- [x] Assess all five originals, including Phillip's OpenDocument file: each scored 6/10 on attempt 1 with three fixes; verified persisted vault badges after reload and all student/instructor/PM copies sent (PM's own copy uses student delivery); nine tests passed.

## Three-week health history
- [x] Group each team's latest three weekly reports, newest first, and add accessible green up/yellow sideways/red down trend assessments.
- [x] Verify grouping, trend rules, report links and narrow-screen rendering: eight tests passed; authenticated history showed 14 real teams with three reports each, report links opened correctly, and no runtime errors.

## Missing upload replacement
- [x] Make deletion atomic, preserve assessment audit, and report failures rather than false success.
- [x] Remove Kendall's missing upload and correct her replacement to attempt 2; verified through the vault, original retained and replacement 6/10 shown as Upload 2.

## Immediate peer-review scoring
- [x] Add an instructor fallback button for unscored uploads and display the top three saved fixes below 8/10.
- [x] Verify the fallback posts the exact version's score and preserves completed scores and attempts: Sky Lin revision scored 6/10 with three fixes; persisted on reload, original 0/10 preserved, all three email copies sent.
- [x] Verify the instructor button in the live File Vault; visible below uploader on unscored rows, replaced by saved score after assessment.

## Weekly Health Check Review
- [x] Add admin-editable rule settings (meeting gaps, activity window, low-engagement cycle, research counts and due date, client-communication grace and count, semester vault milestones, minutes template start and markers, repeat-warning escalation) that the review reads on every run; verified live that a saved change reaches the report text and the value was restored.
- [x] Keep the prose guide as documentation beside the settings, with a seven-day review reminder.

## File Vault identification
- [x] Correct proxy-upload ownership, verify five C-Team originals and required student selection; retain two incorrectly attributed assessments as invalid audit history for fresh assessment, preserving uploader and file versions.
- [x] Group peer reviews by member, keeping originals immediately before revisions; verified Isabella's original 6/10 alongside Upload 2 with a pending-assessment label and 8/10+ target.
- [x] Show full uploader names, original/revised peer-review upload labels across separate files, and exact-version scores; verified Isabella Tiseo's revised upload in the live vault at desktop and narrow widths, with six passing tests. History rows also identify uploaders.

## Teams page
- [x] Show each team's member first/last names and roles on the Teams page cards (verified as admin; students see only their own team's roster under existing access rules).
- [x] Remove the retired "No selection rationale recorded" display from the readiness assessment and client detail (verified live; regression test added).
- [x] Team page jump menu: "Meeting Times" wording, new "Review Past Meetings" choice opening that team's logged meetings, all choices alphabetized (verified live).

## Awaiting Review queue
- [x] Correct client review blanks using clearly labelled saved company details; verified Profit Pioneers without approving or sending anything (3 regression tests passed).
- [x] Exclude the C/D/H Consulting fixture team (teams.is_test) from every queue section and count (verified live: 14 → 11 items; regression tests added).



## Current peer-review processing
- [x] Evaluate all eligible submitted originals; retain scores, evidence and exact individual emails (59 scores and 12 complete-original reminders).
- [x] Remaining peer-review emails sent (105/106); Colt Myers PM copy rate-limited, retry after ~12:30 a.m. Eastern
- [x] Make retained first-analysis summaries available in Admin and Friday Health Review; provide final score list.

## Editable peer-review criteria
- [x] Save the instructor's collected criteria as an admin-only editable document.
- [x] Add a recurring yearly review reminder in Dashboard and Health Review, linked to the document.
- [x] Verify saved edits, yearly-review acknowledgement, and admin-only access.

## Meeting document connections
- [x] Include agenda/minutes connection reminders and exact linkage evidence in future health reviews.
- [x] Audit all non-test teams and report how many share the connection gap, without saving or emailing reports.

## Stage A — status model, kickoff, PM chasing (done)
- [x] Five-state readiness model (Not started / In progress / Submitted / Needs revision / Approved)
- [x] Unassigned member = "Needs a role"; blocks team-setup approval
- [x] Per-item owner; PM nudge action; professor gets weekly summary + override
- [x] Professor kickoff: open a stage for a section, set due dates
- [x] Team Readiness board (team rows x requirement columns, filter by section)
- [x] Role name aliases (spec names shown, our names kept)

## Stage B — six modules as submissions (done)
- [x] Team Setup, Client Selected, Research Brief, Interview Plan, Video Plan, Reflection
- [x] Answer sheet per module: save draft, send for review, approved sheets locked
- [x] Professor review queue: read answers, approve / send back with revision note
- [x] Revision note shown to the whole team; PM notified of every decision

## Stage C — twelve proofs
- [x] Eight proofs needing no assets from the professor
- [x] Meeting minutes proof — built; stays closed until the professor posts the recording + transcript
- [x] Vault organisation proof — built; stays closed until the professor posts the ZIP + answer key
- [x] Zach Guy research proof: mandatory "do not contact" acknowledgement
- [x] One-time locked submissions, non-blocking written feedback, professor completion overview

## Simplified role proof instructions
- [x] Inventory all twelve proof activities and their student/admin entry points
- [x] Replace detailed student checklists with short action prompts
- [x] Preserve scenarios, media, ZIP upload, no-contact acknowledgement, and legacy responses
- [x] Align private feedback with concise, equivalent answers and established score maxima
- [x] Verify every role's rendered proof dialog and final build

## Student dashboard readiness
- [x] Show unfinished Team Readiness prominently at the top of the student dashboard
- [x] State the student's next required action and link directly to Team Readiness
- [x] Verify the dashboard prompt and link in the preview
- [x] Show the same actionable Team Readiness prompt at the top of the student's team page
- [x] Make every Team Readiness role check use the student's assigned team role, including admin view-as

- [x] Teams view: compact readiness indicator beside the Section badge, with hover/focus reasons (shared assessment, test fixtures excluded)

## In-app document viewing (new)
- [x] Agenda list: meeting date above title + sort by date/name
- [x] Let users read minutes, agendas, and other vault documents in a viewer without downloading
- [x] Place 14 team health report PDFs in each team File Vault under "Health Reports" (done)

## Weekly review comparison — discussion only
- [x] Recommend comparing individual concerns against the last report actually shared, with evidence and explicit uncertain matches; do not run a review or implement changes yet.

## Weekly review follow-through
- [x] Persist each team's actually shared baseline independently of Save.
- [x] Compare specific prior concerns with current evidence; distinguish fixes, progress, outstanding, unverified, new and corrected reporting errors.
- [x] Include named latest-report opening accountability, evidence-based compliments and research topic coverage in screen and PDF.
- [x] Verify comparison and research rules with tests and authenticated preview; do not send emails or run this week's real review.
