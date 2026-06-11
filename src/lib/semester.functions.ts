import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BUCKET = "vault";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden: admin role required");
}

/* ---------------- LIST ---------------- */

export const listArchives = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("semester_archives")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { archives: data ?? [] };
  });

/* ---------------- ARCHIVE ---------------- */

export const archiveSemester = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string; notes?: string }) => {
    if (!input?.name || input.name.trim().length === 0) throw new Error("Name required");
    if (input.name.length > 200) throw new Error("Name too long");
    return { name: input.name.trim(), notes: input.notes?.slice(0, 2000) ?? null };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Create archive row
    const { data: archive, error: aErr } = await supabaseAdmin
      .from("semester_archives")
      .insert({
        name: data.name,
        notes: data.notes,
        created_by: context.userId,
      })
      .select()
      .single();
    if (aErr || !archive) throw aErr ?? new Error("Failed to create archive");
    const archiveId = archive.id;

    // Pull live data (team files only — exclude templates)
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
    const fileIds = new Set(files.map((f) => f.id));
    const versions = (versionsRes.data ?? []).filter((v) => fileIds.has(v.file_id));
    const tags = (tagsRes.data ?? []).filter((t) => fileIds.has(t.file_id));
    const comments = (commentsRes.data ?? []).filter((c) => fileIds.has(c.file_id));
    const cf = cfRes.data ?? [];
    const gn = gnRes.data ?? [];
    const gnIds = new Set(gn.map((g) => g.id));
    const gns = (gnsRes.data ?? []).filter((s) => gnIds.has(s.group_norms_id));
    const ms = msRes.data ?? [];

    // Insert shadow rows
    if (teams.length)
      await supabaseAdmin.from("archived_teams").insert(teams.map((t) => ({ ...t, archive_id: archiveId })));
    if (tm.length)
      await supabaseAdmin.from("archived_team_members").insert(tm.map((m) => ({ ...m, archive_id: archiveId })));
    if (files.length)
      await supabaseAdmin.from("archived_files").insert(files.map((f) => ({ ...f, archive_id: archiveId })));

    // Versions: copy storage objects to archive/<archiveId>/<original_path>
    const versionRowsToInsert: any[] = [];
    for (const v of versions) {
      const archivePath = `archive/${archiveId}/${v.storage_path}`;
      const { error: copyErr } = await supabaseAdmin.storage.from(BUCKET).copy(v.storage_path, archivePath);
      if (copyErr && !/exists/i.test(copyErr.message)) {
        console.warn(`[archive] copy fail ${v.storage_path}: ${copyErr.message}`);
      }
      versionRowsToInsert.push({
        archive_id: archiveId,
        id: v.id,
        file_id: v.file_id,
        version_number: v.version_number,
        storage_path: v.storage_path,
        archive_storage_path: archivePath,
        mime_type: v.mime_type,
        file_size: v.file_size,
        uploaded_by: v.uploaded_by,
        uploaded_at: v.uploaded_at,
      });
    }
    if (versionRowsToInsert.length)
      await supabaseAdmin.from("archived_file_versions").insert(versionRowsToInsert);

    if (tags.length)
      await supabaseAdmin.from("archived_file_tags").insert(tags.map((t) => ({ ...t, archive_id: archiveId })));
    if (comments.length)
      await supabaseAdmin.from("archived_file_comments").insert(comments.map((c) => ({ ...c, archive_id: archiveId })));
    if (cf.length)
      await supabaseAdmin.from("archived_company_focus").insert(cf.map((c) => ({ ...c, archive_id: archiveId })));

    // Group norms: copy storage objects too
    const gnRows: any[] = [];
    for (const g of gn) {
      const archivePath = `archive/${archiveId}/${g.document_path}`;
      const { error: copyErr } = await supabaseAdmin.storage.from(BUCKET).copy(g.document_path, archivePath);
      if (copyErr && !/exists/i.test(copyErr.message)) {
        console.warn(`[archive] gn copy fail ${g.document_path}: ${copyErr.message}`);
      }
      gnRows.push({
        archive_id: archiveId,
        id: g.id,
        team_id: g.team_id,
        document_path: g.document_path,
        archive_document_path: archivePath,
        is_locked: g.is_locked,
        locked_at: g.locked_at,
        uploaded_at: g.uploaded_at,
      });
    }
    if (gnRows.length) await supabaseAdmin.from("archived_group_norms").insert(gnRows);
    if (gns.length)
      await supabaseAdmin.from("archived_group_norms_signatures").insert(gns.map((s) => ({ ...s, archive_id: archiveId })));
    if (ms.length)
      await supabaseAdmin.from("archived_manager_submissions").insert(ms.map((m) => ({ ...m, archive_id: archiveId })));

    // Update stats
    await supabaseAdmin
      .from("semester_archives")
      .update({
        team_count: teams.length,
        file_count: files.length,
        member_count: tm.length,
      })
      .eq("id", archiveId);

    await supabaseAdmin.from("admin_audit_log").insert({
      actor_id: context.userId,
      action: "archive",
      archive_id: archiveId,
      archive_name: data.name,
      details: { teams: teams.length, files: files.length, members: tm.length },
    });

    return { ok: true, archiveId };
  });

/* ---------------- RESET ---------------- */

async function deleteLiveStorageRecursive(supabaseAdmin: any, prefix: string) {
  // Recursively list and delete under `prefix` (e.g. "teams")
  const queue: string[] = [prefix];
  const toDelete: string[] = [];
  while (queue.length) {
    const dir = queue.shift()!;
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).list(dir, { limit: 1000 });
    if (error) {
      console.warn(`[reset] list ${dir} failed: ${error.message}`);
      continue;
    }
    for (const item of data ?? []) {
      const path = `${dir}/${item.name}`;
      if (item.id === null || item.metadata === null) {
        // Folder
        queue.push(path);
      } else {
        toDelete.push(path);
      }
    }
  }
  // Delete in batches
  for (let i = 0; i < toDelete.length; i += 100) {
    const batch = toDelete.slice(i, i + 100);
    const { error } = await supabaseAdmin.storage.from(BUCKET).remove(batch);
    if (error) console.warn(`[reset] remove batch failed: ${error.message}`);
  }
  return toDelete.length;
}

export const resetSemester = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { confirm: string }) => {
    if (input?.confirm !== "RESET") throw new Error("Type RESET to confirm");
    return input;
  })
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Delete live rows (FK-safe order). Keep templates (is_template = true, team_id null).
    await supabaseAdmin.from("file_comments").delete().not("team_id", "is", null);
    await supabaseAdmin.from("notifications").delete().not("team_id", "is", null);
    await supabaseAdmin
      .from("file_tags")
      .delete()
      .in(
        "file_id",
        (
          await supabaseAdmin.from("files").select("id").eq("is_template", false).not("team_id", "is", null)
        ).data?.map((r) => r.id) ?? [],
      );

    // Null current_version_id on team files so we can delete file_versions
    await supabaseAdmin
      .from("files")
      .update({ current_version_id: null })
      .eq("is_template", false)
      .not("team_id", "is", null);
    await supabaseAdmin
      .from("file_versions")
      .delete()
      .in(
        "file_id",
        (
          await supabaseAdmin.from("files").select("id").eq("is_template", false).not("team_id", "is", null)
        ).data?.map((r) => r.id) ?? [],
      );
    await supabaseAdmin.from("files").delete().eq("is_template", false).not("team_id", "is", null);

    await supabaseAdmin.from("group_norms_signatures").delete().not("id", "is", null);
    await supabaseAdmin.from("group_norms").delete().not("id", "is", null);
    await supabaseAdmin.from("company_focus").delete().not("id", "is", null);
    await supabaseAdmin.from("manager_submissions").delete().not("id", "is", null);
    await supabaseAdmin.from("team_members").delete().not("id", "is", null);
    await supabaseAdmin.from("teams").delete().not("id", "is", null);

    // Delete live storage under teams/ (archive/ and templates/ untouched)
    const deletedCount = await deleteLiveStorageRecursive(supabaseAdmin, "teams");

    await supabaseAdmin.from("admin_audit_log").insert({
      actor_id: context.userId,
      action: "reset",
      details: { storage_objects_deleted: deletedCount },
    });

    return { ok: true, storageDeleted: deletedCount };
  });

/* ---------------- PROMOTE ---------------- */

export const promoteArchive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { archiveId: string; confirm: string }) => {
    if (!input?.archiveId) throw new Error("archiveId required");
    if (input.confirm !== "PROMOTE") throw new Error("Type PROMOTE to confirm");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const archiveId = data.archiveId;

    // Load archive rows
    const [aRes, atRes, atmRes, afRes, afvRes, aftRes, afcRes, acfRes, agnRes, agnsRes, amsRes] =
      await Promise.all([
        supabaseAdmin.from("semester_archives").select("*").eq("id", archiveId).single(),
        supabaseAdmin.from("archived_teams").select("*").eq("archive_id", archiveId),
        supabaseAdmin.from("archived_team_members").select("*").eq("archive_id", archiveId),
        supabaseAdmin.from("archived_files").select("*").eq("archive_id", archiveId),
        supabaseAdmin.from("archived_file_versions").select("*").eq("archive_id", archiveId),
        supabaseAdmin.from("archived_file_tags").select("*").eq("archive_id", archiveId),
        supabaseAdmin.from("archived_file_comments").select("*").eq("archive_id", archiveId),
        supabaseAdmin.from("archived_company_focus").select("*").eq("archive_id", archiveId),
        supabaseAdmin.from("archived_group_norms").select("*").eq("archive_id", archiveId),
        supabaseAdmin.from("archived_group_norms_signatures").select("*").eq("archive_id", archiveId),
        supabaseAdmin.from("archived_manager_submissions").select("*").eq("archive_id", archiveId),
      ]);
    if (aRes.error || !aRes.data) throw new Error("Archive not found");

    // Wipe live (same as reset, inline to avoid double confirm requirement)
    await supabaseAdmin.from("file_comments").delete().not("team_id", "is", null);
    await supabaseAdmin.from("notifications").delete().not("team_id", "is", null);
    const teamFileIds =
      (await supabaseAdmin.from("files").select("id").eq("is_template", false).not("team_id", "is", null)).data?.map(
        (r) => r.id,
      ) ?? [];
    if (teamFileIds.length) {
      await supabaseAdmin.from("file_tags").delete().in("file_id", teamFileIds);
      await supabaseAdmin.from("files").update({ current_version_id: null }).in("id", teamFileIds);
      await supabaseAdmin.from("file_versions").delete().in("file_id", teamFileIds);
      await supabaseAdmin.from("files").delete().in("id", teamFileIds);
    }
    await supabaseAdmin.from("group_norms_signatures").delete().not("id", "is", null);
    await supabaseAdmin.from("group_norms").delete().not("id", "is", null);
    await supabaseAdmin.from("company_focus").delete().not("id", "is", null);
    await supabaseAdmin.from("manager_submissions").delete().not("id", "is", null);
    await supabaseAdmin.from("team_members").delete().not("id", "is", null);
    await supabaseAdmin.from("teams").delete().not("id", "is", null);
    await deleteLiveStorageRecursive(supabaseAdmin, "teams");

    // Restore rows
    const stripArchive = (rows: any[]) =>
      rows.map(({ archive_id, ...r }) => r);

    if (atRes.data?.length) await supabaseAdmin.from("teams").insert(stripArchive(atRes.data));
    if (atmRes.data?.length) await supabaseAdmin.from("team_members").insert(stripArchive(atmRes.data));
    if (afRes.data?.length) {
      // Insert files with current_version_id null first; set it after versions exist
      const files = stripArchive(afRes.data).map((f: any) => ({ ...f, current_version_id: null }));
      await supabaseAdmin.from("files").insert(files);
    }

    // Restore file versions + copy storage back
    if (afvRes.data?.length) {
      const versionRows: any[] = [];
      for (const v of afvRes.data) {
        const { error: copyErr } = await supabaseAdmin.storage
          .from(BUCKET)
          .copy(v.archive_storage_path, v.storage_path);
        if (copyErr && !/exists/i.test(copyErr.message)) {
          console.warn(`[promote] copy ${v.archive_storage_path} → ${v.storage_path}: ${copyErr.message}`);
        }
        versionRows.push({
          id: v.id,
          file_id: v.file_id,
          version_number: v.version_number,
          storage_path: v.storage_path,
          mime_type: v.mime_type,
          file_size: v.file_size,
          uploaded_by: v.uploaded_by,
          uploaded_at: v.uploaded_at,
        });
      }
      await supabaseAdmin.from("file_versions").insert(versionRows);

      // Restore current_version_id from archived_files
      for (const af of afRes.data ?? []) {
        if (af.current_version_id) {
          await supabaseAdmin
            .from("files")
            .update({ current_version_id: af.current_version_id })
            .eq("id", af.id);
        }
      }
    }

    if (aftRes.data?.length) await supabaseAdmin.from("file_tags").insert(stripArchive(aftRes.data));
    if (afcRes.data?.length) await supabaseAdmin.from("file_comments").insert(stripArchive(afcRes.data));
    if (acfRes.data?.length) await supabaseAdmin.from("company_focus").insert(stripArchive(acfRes.data));

    // Group norms
    if (agnRes.data?.length) {
      for (const g of agnRes.data) {
        const { error: copyErr } = await supabaseAdmin.storage
          .from(BUCKET)
          .copy(g.archive_document_path, g.document_path);
        if (copyErr && !/exists/i.test(copyErr.message)) {
          console.warn(`[promote] gn copy fail: ${copyErr.message}`);
        }
      }
      await supabaseAdmin.from("group_norms").insert(
        agnRes.data.map((g: any) => ({
          id: g.id,
          team_id: g.team_id,
          document_path: g.document_path,
          is_locked: g.is_locked,
          locked_at: g.locked_at,
          uploaded_at: g.uploaded_at,
        })),
      );
    }
    if (agnsRes.data?.length) await supabaseAdmin.from("group_norms_signatures").insert(stripArchive(agnsRes.data));
    if (amsRes.data?.length) await supabaseAdmin.from("manager_submissions").insert(stripArchive(amsRes.data));

    await supabaseAdmin.from("admin_audit_log").insert({
      actor_id: context.userId,
      action: "promote",
      archive_id: archiveId,
      archive_name: aRes.data.name,
      details: {
        teams: atRes.data?.length ?? 0,
        files: afRes.data?.length ?? 0,
        members: atmRes.data?.length ?? 0,
      },
    });

    return { ok: true };
  });

/* ---------------- DELETE ARCHIVE ---------------- */

export const deleteArchive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { archiveId: string }) => {
    if (!input?.archiveId) throw new Error("archiveId required");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Remove storage under archive/<archiveId>/
    await deleteLiveStorageRecursive(supabaseAdmin, `archive/${data.archiveId}`);

    const { data: a } = await supabaseAdmin
      .from("semester_archives")
      .select("name")
      .eq("id", data.archiveId)
      .single();

    // Cascades delete all archived_* rows
    const { error } = await supabaseAdmin.from("semester_archives").delete().eq("id", data.archiveId);
    if (error) throw error;

    await supabaseAdmin.from("admin_audit_log").insert({
      actor_id: context.userId,
      action: "delete_archive",
      archive_id: data.archiveId,
      archive_name: a?.name ?? null,
    });

    return { ok: true };
  });

/* ---------------- PREVIEW (read-only) ---------------- */

export const getArchiveContents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { archiveId: string }) => {
    if (!input?.archiveId) throw new Error("archiveId required");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const archiveId = data.archiveId;

    const [aRes, teamsRes, membersRes, filesRes, versionsRes, cfRes] = await Promise.all([
      supabaseAdmin.from("semester_archives").select("*").eq("id", archiveId).single(),
      supabaseAdmin.from("archived_teams").select("*").eq("archive_id", archiveId).order("name"),
      supabaseAdmin.from("archived_team_members").select("*").eq("archive_id", archiveId),
      supabaseAdmin.from("archived_files").select("*").eq("archive_id", archiveId),
      supabaseAdmin.from("archived_file_versions").select("*").eq("archive_id", archiveId),
      supabaseAdmin.from("archived_company_focus").select("*").eq("archive_id", archiveId),
    ]);
    if (aRes.error || !aRes.data) throw new Error("Archive not found");

    return {
      archive: aRes.data,
      teams: teamsRes.data ?? [],
      members: membersRes.data ?? [],
      files: filesRes.data ?? [],
      versions: versionsRes.data ?? [],
      companyFocus: cfRes.data ?? [],
    };
  });
