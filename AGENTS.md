# Architecture rules

- Weekly health comparisons use immutable per-team shared snapshots, not saved-history totals; Save and vault refresh never advance the shared baseline.
- Shared baselines advance only after at least one student email is accepted, recording accepted recipients; instructor-only and suppressed sends do not qualify.
- Concern comparisons use stable rule identifiers and verified item-level observations; unknown historical matches remain unverified rather than earning automatic credit.
- Research document text is extracted server-side using edge-compatible readers and cited excerpts; unsupported, scanned or unreadable files remain unverified, not missing.