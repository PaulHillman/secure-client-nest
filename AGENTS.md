# Architecture rules

- Peer-review criteria persist separately from semester team data in an admin-only document; annual review acknowledgement and optimistic edit checks prevent stale evaluation criteria and overwritten changes.

- Weekly health comparisons use immutable per-team shared snapshots, not saved-history totals; Save and vault refresh never advance the shared baseline.
- Shared baselines advance only after at least one student email is accepted, recording accepted recipients; instructor-only and suppressed sends do not qualify.
- Concern comparisons use stable rule identifiers and verified item-level observations; unknown historical matches remain unverified rather than earning automatic credit.
- Research document text is extracted server-side using edge-compatible readers and cited excerpts; unsupported, scanned or unreadable files remain unverified, not missing.
- Vault rename/refile actions update file metadata only, preserving storage paths and version history; explicit Final Compiled selections normalize the display name for compatibility with existing slot classification.
- Meeting record corrections update the existing row by ID through user-scoped access, preserving original logger, attachments and former-member attendance; edits must not create replacement meetings.
- Health-review meeting connection evidence uses explicit file-to-meeting IDs (including the legacy minutes pointer), never folder totals or inferred dates; connection reminders alone do not introduce grading penalties.