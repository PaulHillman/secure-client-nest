# Profile completion nudges

## What students will see

**On the dashboard, above everything else:** a "Finish setting up your profile" panel that only appears while something is missing. It lists exactly what's left:

- Pick 8 skills you already have (shows "3 of 8 chosen")
- Pick 5 skills you want to learn (shows "1 of 5 chosen")
- Block out the times you absolutely cannot meet

Each line links straight to the right place, and the panel disappears once all three are done.

**In the skills section:** the two headings gain a clear target — "Choose 8 skills you have" and "Choose 5 skills you want to learn" — with a live count and a green check when the target is met.

**On the weekly availability grid:** new guidance text —

> Only block time you absolutely cannot meet: class periods, regularly scheduled work shifts, and athletic practices. Leave as much time open as possible so your team can actually find a meeting slot. Blocking time you'd merely prefer to keep free makes it much harder for everyone.

Plus a reminder to save the grid even if a student has no conflicts at all, so we know they've done it.

## Daily reminders

A once-a-day job finds every student who is missing any of the three items and reminds them. The reminder also copies their Project Manager, per the standing rule.

- **In-app notification:** works immediately, no setup needed.
- **Email every 24 hours:** needs a sending address on a domain you own. None is set up yet, so I'll build the daily job and in-app reminders now and wire the email onto the same job once the domain is ready.

Reminders stop automatically the moment a student completes all three. Nobody gets more than one reminder a day.

You'll also get an admin view of who is still outstanding.

## Technical notes

- New `profile_reminders` table (user_id, last_sent_at, kind) so reminders are sent at most once per 24 hours per student.
- Completion is computed from `profiles.skills_have` (>= 8), `profiles.skills_learn` (>= 5) and the existence of a `student_availability` row saved by the student.
- New `src/lib/profile-completion.ts` with the shared rule, used by the dashboard panel and the daily job.
- `src/lib/profile-reminders.server.ts` + a public cron hook at `/api/public/hooks/profile-reminders`, scheduled daily with pg_cron, mirroring the existing weekly digest job.
- Availability "saved" is tracked by row existence, so a student with zero conflicts still counts as done once they hit Save.
