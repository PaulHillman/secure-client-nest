# Semester Reset & Archive System

## Goal
Let an admin (1) snapshot the current semester, (2) wipe live data to start fresh, and (3) browse or promote any past snapshot back to live. Templates, admin accounts, audit log, and student login accounts are preserved across resets.

## What gets archived vs. preserved vs. wiped

| Data | Archive | Reset wipes | Notes |
|---|---|---|---|
| `teams`, `team_members` | yes | yes | |
| `files` (team files only), `file_versions`, `file_tags`, `file_comments` | yes | yes | bytes copied in storage too |
| Vault storage objects under each team | yes (copied to `archive/<id>/...`) | yes (live paths deleted) | byte-perfect restore |
| `company_focus`, `group_norms`, `group_norms_signatures`, `manager_submissions` | yes | yes | |
| `notifications` | no | yes | transient |
| Template files (`is_template = true`, no team) | no | **no — preserved** | always live in Admin |
| `profiles`, `auth.users` (students) | no | **no — preserved** | detached from teams only |
| `user_roles` (admin rows) | no | **no — preserved** | |
| `file_audit_log` | no | **no — preserved** | permanent paper trail |
| Past `semester_archives` | n/a | **no — preserved** | many snapshots kept |

## Three Admin actions

**Archive now** — prompts for a name (e.g. "Spring 2026"), creates a `semester_archives` row, copies all in-scope rows into archive tables, copies every team-file storage object to `archive/<archive_id>/<original_path>`.

**Reset semester** — confirmation dialog ("type RESET"). Deletes in-scope rows + live storage objects. Templates, students, admins, audit log, archives untouched.

**Restore** — from the Archives list, per row:
- **Preview (read-only)** — opens an in-admin browser of that archive's teams/files/comments/etc. Uses archive tables directly; no writes to live tables.
- **Promote to live** — confirmation dialog. Wipes current live data (same as Reset), then writes archive rows back into live tables and copies storage objects from `archive/<id>/...` back to their original paths. Fully editable again.

## Test loop this supports
1. Archive now → "Test snapshot"
2. Reset → empty teams/files; templates still there
3. (optional) create dummy teams to confirm
4. Archives → Preview "Test snapshot" to verify capture
5. Promote "Test snapshot" → back to original state, fully writable

## Technical sketch (for reference)

**New tables** (all admin-only via RLS using `has_role(auth.uid(),'admin')`):
- `semester_archives` — id, name, created_at, created_by, stats (team_count, file_count, byte_size)
- `archived_teams`, `archived_team_members`, `archived_files`, `archived_file_versions`, `archived_file_tags`, `archived_file_comments`, `archived_company_focus`, `archived_group_norms`, `archived_group_norms_signatures`, `archived_manager_submissions` — each carries `archive_id` FK + original columns

**Server functions** (`src/lib/semester.functions.ts`, all `requireSupabaseAuth` + admin role check):
- `archiveSemester({ name })` — transactional copy of rows; then storage object copy via `supabaseAdmin.storage.from('vault').copy()` per file
- `resetSemester()` — delete live rows in FK-safe order; delete live storage objects (skip `archive/` and `template/` prefixes)
- `promoteArchive({ archiveId })` — calls reset, then inserts archived rows back, then copies storage objects back
- `listArchives()`, `getArchiveContents({ archiveId })` — for the Archives tab UI

**UI** — new "Semester" tab in `/app/admin` with three buttons (Archive, Reset, plus an Archives list with Preview / Promote / Delete actions per row). Preview opens a read-only variant of the existing file-vault tree fed by archive tables.

**Storage layout** — live files stay at `<team_id>/...`; archived copies at `archive/<archive_id>/<team_id>/...`. Reset deletes objects NOT under `archive/` or `template/` prefixes.

**Audit log** — archive/reset/promote actions also write a row to `file_audit_log` (or a sibling `admin_audit_log`) so semester operations are tracked.

## Out of scope (confirm if you want any of these added)
- Exporting an archive as a downloadable zip
- Renaming/editing an archive after creation
- Selective restore (just one team from an archive)
- Scheduled/automatic archives