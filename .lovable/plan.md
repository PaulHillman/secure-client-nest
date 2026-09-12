# Update the PM agenda-planning proof

## Scope
Change only **PM Proof A — Build an Agenda** (`pm_agenda`). Leave the PM voicemail, Group Norms, all other proofs, and all existing submissions untouched.

## Implementation
- Replace the scenario with the supplied client-interview lead-in verbatim.
- Replace the multi-part agenda form with one required response prompt: “As the PM, what are the topics that should be on your agenda?”
- Remove the student-visible “A strong response covers” block for this proof, including every duration and time-allocation reference.
- Keep a separate instructor-only five-point rubric, with the client-interview-readiness purpose and the five supplied expected topics. Set the maximum to five and explicitly allow equivalent wording, combined/reordered coverage, and no separate attendance-discipline point.
- Store that answer key in the existing proof-material grading path. Ensure students receive only safe material fields while the server-side feedback process can read the answer key.
- Preserve all existing submission rows and scores; do not trigger regrading.

## Verification
- Confirm the rendered dialog shows the exact new lead-in and one exact response prompt, with no checklist, duration, or time-allocation language.
- Confirm the stored key has five numbered topics and is not returned by the student material endpoint.
- Confirm submission feedback remains AI-generated coaching with a parsed 0–5 key-point count when the AI service is available; completion remains recorded even when feedback is unavailable.
- Run focused checks and confirm the preview build succeeds. Do not publish.
