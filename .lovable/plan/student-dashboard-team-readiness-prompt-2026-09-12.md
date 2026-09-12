# Student dashboard Team Readiness prompt

## Goal
Place an outstanding Team Readiness notice directly beneath the student dashboard heading so each student immediately sees what remains before meeting with Prof Hillman.

## Implementation
- Determine the signed-in student's current team and readiness status from existing role, proof, meeting-agreement, and Group Norms records.
- Show the notice only when the student belongs to a team and has unfinished readiness work.
- Summarize progress, identify the next unfinished action, and link directly to that team's Team Readiness section.
- Keep the notice hidden when all four steps are complete and preserve the existing admin dashboard experience.
- Reuse the existing Team Readiness rules and visual system; do not change proof, meeting, or Group Norms behavior.

## Verification
- Check incomplete and complete student states, students without a team, admin and “view as student” behavior, and the team link.
- Run focused checks and confirm the preview build is clean.
