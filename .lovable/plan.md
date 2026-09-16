# Rename Client Proposal in Team Readiness

## What will change
- Rename the Team Readiness item shown as **Client Proposal** to **Client Selected**.
- Update both its primary title and alternate label so the team page, Admin Readiness board, review dialog, nudges, and decision emails all use the new wording.
- Keep the internal key `client_proposal` unchanged so existing answers, status history, deadlines, and notifications remain connected.

## Other current uses
- The user-visible wording comes from the shared Team Readiness requirement record.
- The internal `client_proposal` key is also used to load the existing company details into that module's form; this behavior will stay unchanged.
- The old label also appears only in historical setup documentation/migrations and the project roadmap; historical migrations will not be rewritten.

## Technical details
- Add a forward-only data migration updating `project_requirements.title` and `project_requirements.alias` for `client_proposal`.
- Update the roadmap wording for current project documentation.
- Verify the updated label in the team readiness screen and confirm the app remains healthy.
