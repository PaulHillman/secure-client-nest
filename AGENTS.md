# Architecture rules
- Weekly peer-review summaries use a deterministic latest-valid-assessment and verified booking helper; individual detailed feedback and immutable shared history stay separate to avoid stale resubmission instructions.
- Health Review category displays repeat matching saved concerns at the flagged status before pass notes; PDF and screen presentation never recalculate findings or change shared baselines.
- Minutes-template eligibility uses a shared supplement classifier; historical appendix template findings are reporting corrections, never student-earned progress, and shared snapshots remain immutable.
- Discussion decisions and final-point adjustments are retained separately from official peer scores; final re-grades save their deterministic decision with the analysis, and accepted badges display the saved decimal result. Awaiting Review uses only each student's latest unresolved assessment and shares meeting/comment controls with Peer Reviews, preserving audit scores while showing the actual outcome.
- Competition grading references are instructor-only, read-only reference content independent of grading engines; unsupplied competitions remain empty rather than inheriting another competition’s rubric.
- Peer-review meeting workspaces read exact assessment versions; deterministic text diffs never imply rubric fixes, and final uploads consume one durable instructor grant through a database version-insert trigger before assessment.
- Calendly reconciliation matches email first or one unique full name with an explicit mismatch label; booked topics are retained without treating unrelated meetings as required peer-review meetings.
- Calendar booking changes are retained by a database audit trigger; the daily SQL dispatcher uses a private expiring single-use nonce and adjusts its next UTC run for Detroit daylight saving time, preserving exactly one daily check.
- Peer-review email next steps are deterministic and separate from AI document feedback; the shared policy controls attempt eligibility and revisions omit redundant concern narratives.
- Peer-review OpenDocument text is extracted from ordered XML paragraphs and table cells using bundled ZIP/XML readers; unreadable content is never scored.
- Three-week saved-score history groups by team ID and Detroit calendar week, retaining the newest save per week; directional arrows describe reported concern counts, never verified student-earned fixes or grades.

- Vault deletion uses an authorized atomic database function before storage cleanup, retaining assessment source snapshots; deleted-source assessments do not consume replacement attempts.

- Manual File Vault scoring uses the same authorized, idempotent exact-version assessment as upload automation; saved priority feedback is displayed without reusing an original grade or inventing fixes.
- Peer-review badges receive the displayed assessment's attempt and use the shared pass policy, so original and revision thresholds stay consistent across File Vault and team rosters.

- Submission reviews preserve written answers and label fallback client details as current company records, never as historical submitted answers.

- Individual peer-review assessments retain the source version, rubric snapshot and exact email separately from team health reports; each authorized assessment delivery handles one derived recipient and has its own idempotency key.

- Peer-review criteria persist separately from semester team data in an admin-only document; annual review acknowledgement and optimistic edit checks prevent stale evaluation criteria and overwritten changes.

- Weekly health comparisons use immutable per-team shared snapshots, not saved-history totals; Save and vault refresh never advance the shared baseline.
- Shared baselines advance only after at least one student email is accepted, recording accepted recipients; instructor-only and suppressed sends do not qualify.
- Concern comparisons use stable rule identifiers and verified item-level observations; unknown historical matches remain unverified rather than earning automatic credit.
- Research document text is extracted server-side using edge-compatible readers and cited excerpts; unsupported, scanned or unreadable files remain unverified, not missing.
- Vault rename/refile actions update file metadata only, preserving storage paths and version history; explicit Final Compiled selections normalize the display name for compatibility with existing slot classification.
- Vault uploader labels use version uploader profiles, separately from assigned ownership; peer-review upload order spans file rows for that owner, and score badges match the exact displayed version to avoid presenting an original score as revision feedback.
- Peer-review uploads require an explicit team-member owner for assessment and attempt ordering; legacy uploads may use their retained valid assessment's student identity, but unknown ownership never falls back to the uploader, preventing proxy uploads from consuming the wrong student's attempts.
- Meeting record corrections update the existing row by ID through user-scoped access, preserving original logger, attachments and former-member attendance; edits must not create replacement meetings.
- Existing meeting attachment selection is team-scoped and additive; preserve file dates, folders, versions and legacy minutes pointers, and never implicitly move another meeting's documents.
- Health-review meeting connection evidence uses explicit file-to-meeting IDs (including the legacy minutes pointer), never folder totals or inferred dates; connection reminders alone do not introduce grading penalties.- Peer-review uploads are auto-assessed server-side right after upload, once per version (UNIQUE version_id); unreadable files are recorded for instructor review instead of scored.
- The weekly Health Check Review page holds two separate things: admin-editable rule settings (health_review_rules, row 'global') that the runner reads on every run, and a prose document beside the peer-review criteria (id 'health-review') that records the rules in words but never drives them.
- Health-review thresholds are editable settings resolved against documented defaults, so a missing or half-filled row can never loosen a check; peer-review due dates stay hard-coded in peer-review-policy so file badges and deadlines cannot disagree.
- Health-review check switches (saved in health_review_rules.disabled_checks, plus per-run skipChecks) suppress both the concern and its comparison credit by stable concern ID, and the report notes what was turned off.
