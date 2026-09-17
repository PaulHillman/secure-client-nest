# Closed modules: read-only for teams, tidy for the instructor

## What "closed" means here

The app's assignments are the project modules (Team Setup, Client Selected, Research Brief, …). A module is opened for a section with a due date. There is no separate close date, so:

**A module is closed when its due date has passed.** Opened + due date in the future = active. Opened + due date past = closed. No due date = stays active. (The existing "Close" button, which removes a module from a section entirely, keeps working as-is.)

If this reading is wrong — for example if you want a grace period after the due date, or a separate close date field — say so and I will adjust before building.

## Student / team side

On a team's "Where your team stands" card:
- Active modules stay exactly as they are.
- Closed modules move into a separate **Closed modules** section below the active list, collapsed-looking and clearly marked.
- Opening a closed module shows a banner: *"Submissions are closed. Feedback is available below."*
- Everything that changes work is switched off for a closed module: the form fields, Save, the status dropdown, the owner dropdown, and the Start/Open buttons become view-only.
- If the team submitted, they see their answers, the instructor's decision (Approved / Sent back) and the instructor's note.
- If nothing was submitted, they see: *"No submission was recorded for this module."*
- Closed modules are still reachable from that Closed section, so feedback is never hidden.

The server enforces the same rule, not just the screen: saving a module answer sheet or changing a module's status after the due date is refused for students. Instructors are never blocked.

## Instructor side (Admin → Readiness)

- The board gets a view switch: **Active** (default), **Needs action**, **Closed**.
  - *Active* — only modules still open and not past due. Closed columns drop out of the table so the current workflow is clean.
  - *Needs action* — any module, open or closed, that is submitted and awaiting your decision. Closed work that still needs grading never disappears.
  - *Closed* — the archive: every past-due module, with its final state, readable and reviewable.
- Review, approve, send back and nudge keep working in every view, including on closed modules.

## Technical notes

- `src/lib/readiness.functions.ts` — add a shared `isClosed(dueAt)` helper; `getTeamReadiness` items and `getReadinessBoard` cells gain a `closed` flag; `setRequirementStatus` and (in `module-submissions.functions.ts`) `saveModuleSubmission` reject non-admin writes on closed modules.
- `src/components/team-readiness-card.tsx` — split active vs closed lists; pass `readOnly` to the dialog; disable status/owner selects and nudge on closed rows; "No submission was recorded" empty state.
- `src/components/module-submission-dialog.tsx` — accept `readOnly`; render the closed banner, disable all fields and the Save button, show the decision + instructor note.
- `src/components/readiness-board-card.tsx` — view switch (Active / Needs action / Closed) filtering columns and cells.

Permissions are untouched: team members see only their own team, admins keep full access.
