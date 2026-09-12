// Server-only helpers for the daily auto-archive job (7 daily + 4 weekly retention).
import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "vault";

/** Snapshot all live team data into archived_* tables and storage. */
async function createArchiveSnapshot(
  supabaseAdmin: SupabaseClient,
  opts: { name: string; notes?: string | null; kind: "manual" | "daily" | "weekly"; tagDate: string; createdBy?: string | null },
) {
  const { data: archive, error: aErr } = await supabaseAdmin
    .from("semester_archives")
    .insert({
      name: opts.name,
      notes: opts.notes ?? null,
      created_by: opts.createdBy ?? null,
      kind: opts.kind,
      tag_date: opts.tagDate,
    })
    .select()
    .single();
  if (aErr || !archive) throw aErr ?? new Error("Failed to create archive");
  const archiveId = archive.id;

  const [teamsRes, tmRes, filesRes, versionsRes, tagsRes, commentsRes, cfRes, gnRes, gnsRes, msRes] =
    await Promise.all([
      supabaseAdmin.from("teams").select("*"),
      supabaseAdmin.from("team_members").select("*"),
      supabaseAdmin.from("files").select("*").eq("is_template", false).not("team_id", "is", null),
      supabaseAdmin.from("file_versions").select("*"),
      supabaseAdmin.from("file_tags").select("*"),
      supabaseAdmin.from("file_comments").select("*"),
      supabaseAdmin.from("company_focus").select("*"),
      supabaseAdmin.from("group_norms").select("*"),
      supabaseAdmin.from("group_norms_signatures").select("*"),
      supabaseAdmin.from("manager_submissions").select("*"),
    ]);
  for (const r of [teamsRes, tmRes, filesRes, versionsRes, tagsRes, commentsRes, cfRes, gnRes, gnsRes, msRes]) {
    if (r.error) throw r.error;
  }
  const teams = teamsRes.data ?? [];
  const tm = tmRes.data ?? [];
  const files = filesRes.data ?? [];
  const fileIds = new Set(files.map((f: any) => f.id));
  const versions = (versionsRes.data ?? []).filter((v: any) => fileIds.has(v.file_id));
  const tags = (tagsRes.data ?? []).filter((t: any) => fileIds.has(t.file_id));
  const comments = (commentsRes.data ?? []).filter((c: any) => fileIds.has(c.file_id));
  const cf = cfRes.data ?? [];
  const gn = gnRes.data ?? [];
  const gnIds = new Set(gn.map((g: any) => g.id));
  const gns = (gnsRes.data ?? []).filter((s: any) => gnIds.has(s.group_norms_id));
  const ms = msRes.data ?? [];

  if (teams.length) await supabaseAdmin.from("archived_teams").insert(teams.map((t: any) => ({ ...t, archive_id: archiveId })));
  if (tm.length) await supabaseAdmin.from("archived_team_members").insert(tm.map((m: any) => ({ ...m, archive_id: archiveId })));
  if (files.length) await supabaseAdmin.from("archived_files").insert(files.map((f: any) => ({ ...f, archive_id: archiveId })));

  const versionRows = versions.map((v: any) => ({
    archive_id: archiveId,
    id: v.id,
    file_id: v.file_id,
    version_number: v.version_number,
    storage_path: v.storage_path,
    archive_storage_path: `archive/${archiveId}/${v.storage_path}`,
    mime_type: v.mime_type,
    file_size: v.file_size,
    uploaded_by: v.uploaded_by,
    uploaded_at: v.uploaded_at,
  }));
  await Promise.all(
    versionRows.map((v) =>
      supabaseAdmin.storage.from(BUCKET).copy(v.storage_path, v.archive_storage_path).then((r: any) => {
        if (r.error && !/exists/i.test(r.error.message)) console.warn(`[auto-archive] copy fail: ${r.error.message}`);
      }),
    ),
  );
  if (versionRows.length) await supabaseAdmin.from("archived_file_versions").insert(versionRows);

  if (tags.length) await supabaseAdmin.from("archived_file_tags").insert(tags.map((t: any) => ({ ...t, archive_id: archiveId })));
  if (comments.length) await supabaseAdmin.from("archived_file_comments").insert(comments.map((c: any) => ({ ...c, archive_id: archiveId })));
  if (cf.length) await supabaseAdmin.from("archived_company_focus").insert(cf.map((c: any) => ({ ...c, archive_id: archiveId })));

  const gnRows = gn.map((g: any) => ({
    archive_id: archiveId,
    id: g.id,
    team_id: g.team_id,
    document_path: g.document_path,
    archive_document_path: g.document_path ? `archive/${archiveId}/${g.document_path}` : null,
    content: g.content,
    version: g.version,
    is_locked: g.is_locked,
    locked_at: g.locked_at,
    uploaded_at: g.uploaded_at,
  }));
  await Promise.all(
    gnRows
      .filter((g) => g.document_path && g.archive_document_path)
      .map((g) =>
        supabaseAdmin.storage.from(BUCKET).copy(g.document_path, g.archive_document_path).then((r: any) => {
          if (r.error && !/exists/i.test(r.error.message)) console.warn(`[auto-archive] gn copy fail: ${r.error.message}`);
        }),
      ),
  );

  if (gnRows.length) await supabaseAdmin.from("archived_group_norms").insert(gnRows);

  if (gns.length) await supabaseAdmin.from("archived_group_norms_signatures").insert(gns.map((s: any) => ({ ...s, archive_id: archiveId })));
  if (ms.length) await supabaseAdmin.from("archived_manager_submissions").insert(ms.map((m: any) => ({ ...m, archive_id: archiveId })));

  await supabaseAdmin
    .from("semester_archives")
    .update({ team_count: teams.length, file_count: files.length, member_count: tm.length })
    .eq("id", archiveId);

  return { archiveId, teams: teams.length, files: files.length, members: tm.length };
}

/** Delete an archive: storage objects under archive/<id>/ then the row (cascade). */
async function hardDeleteArchive(supabaseAdmin: SupabaseClient, archiveId: string) {
  const [{ data: avers }, { data: agns }] = await Promise.all([
    supabaseAdmin.from("archived_file_versions").select("archive_storage_path").eq("archive_id", archiveId),
    supabaseAdmin.from("archived_group_norms").select("archive_document_path").eq("archive_id", archiveId),
  ]);
  const paths: string[] = [
    ...((avers ?? []).map((v: any) => v.archive_storage_path).filter(Boolean)),
    ...((agns ?? []).map((g: any) => g.archive_document_path).filter(Boolean)),
  ];
  if (paths.length) {
    for (let i = 0; i < paths.length; i += 200) {
      const batch = paths.slice(i, i + 200);
      const { error } = await supabaseAdmin.storage.from(BUCKET).remove(batch);
      if (error) console.warn(`[auto-archive] prune remove: ${error.message}`);
    }
  }
  await supabaseAdmin.from("semester_archives").delete().eq("id", archiveId);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Main entry point. Idempotent per day. */
export async function runDailyAutoArchive(supabaseAdmin: SupabaseClient): Promise<{
  ran: boolean;
  reason?: string;
  archiveId?: string;
  pruned?: number;
}> {
  // 1. Check schedule
  const { data: sched } = await supabaseAdmin
    .from("semester_schedule")
    .select("start_date, end_date")
    .eq("id", true)
    .maybeSingle();
  const today = todayISO();
  if (!sched?.start_date || !sched?.end_date) return { ran: false, reason: "schedule not set" };
  if (today < sched.start_date) return { ran: false, reason: `before start (${sched.start_date})` };
  if (today > sched.end_date) return { ran: false, reason: `after end (${sched.end_date})` };

  // 2. Skip if today's auto archive already exists
  const { data: existing } = await supabaseAdmin
    .from("semester_archives")
    .select("id")
    .eq("tag_date", today)
    .in("kind", ["daily", "weekly"])
    .maybeSingle();
  if (existing) return { ran: false, reason: "already archived today", archiveId: existing.id };

  // 3. Sunday = 0 → keep as weekly; other days = daily
  const dow = new Date(today + "T00:00:00Z").getUTCDay();
  const kind: "daily" | "weekly" = dow === 0 ? "weekly" : "daily";
  const name = `Auto ${today}${kind === "weekly" ? " (weekly)" : ""}`;

  const snap = await createArchiveSnapshot(supabaseAdmin, {
    name,
    notes: "Created by daily auto-archive job",
    kind,
    tagDate: today,
    createdBy: null,
  });

  // 4. Prune — daily older than 7 days, weekly older than 28 days. Never touch manual.
  const dailyCutoff = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
  const weeklyCutoff = new Date(Date.now() - 28 * 86400_000).toISOString().slice(0, 10);
  const { data: oldDaily } = await supabaseAdmin
    .from("semester_archives")
    .select("id")
    .eq("kind", "daily")
    .lt("tag_date", dailyCutoff);
  const { data: oldWeekly } = await supabaseAdmin
    .from("semester_archives")
    .select("id")
    .eq("kind", "weekly")
    .lt("tag_date", weeklyCutoff);
  const toDelete = [...(oldDaily ?? []), ...(oldWeekly ?? [])].map((r: any) => r.id);
  for (const id of toDelete) await hardDeleteArchive(supabaseAdmin, id);

  await supabaseAdmin.from("admin_audit_log").insert({
    actor_id: null,
    action: "auto_archive",
    archive_id: snap.archiveId,
    archive_name: name,
    details: { kind, pruned: toDelete.length, ...snap },
  });

  return { ran: true, archiveId: snap.archiveId, pruned: toDelete.length };
}
