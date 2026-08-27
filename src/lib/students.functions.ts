import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ImportRow = {
  lastName: string;
  firstName: string;
  username: string;
  studentId: string;
  section?: string | null;
};

export type ImportResult = {
  created: number;
  skipped: { email: string; reason: string }[];
  errors: { email: string; error: string }[];
};

export const bulkImportStudents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { rows: ImportRow[] }) => {
    if (!input || !Array.isArray(input.rows)) throw new Error("rows required");
    if (input.rows.length === 0) throw new Error("No rows to import");
    if (input.rows.length > 500) throw new Error("Max 500 rows per import");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError || !isAdmin) throw new Error("Forbidden: admin role required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const result: ImportResult = { created: 0, skipped: [], errors: [] };

    for (const raw of data.rows) {
      const username = String(raw.username ?? "").trim().toLowerCase();
      const studentId = String(raw.studentId ?? "").trim();
      const firstName = String(raw.firstName ?? "").trim();
      const lastName = String(raw.lastName ?? "").trim();
      const section = raw.section ? String(raw.section).trim() : null;

      if (!username || !studentId) {
        result.errors.push({
          email: username || "(blank)",
          error: "Missing username or student ID",
        });
        continue;
      }

      const email = `${username}@mail.gvsu.edu`;
      const fullName = `${firstName} ${lastName}`.trim();

      try {
        const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: studentId,
          email_confirm: true,
          user_metadata: { name: fullName },
        });

        if (error) {
          const msg = error.message ?? "Unknown error";
          if (/already.*registered|already exists|duplicate/i.test(msg)) {
            result.skipped.push({ email, reason: "Account already exists" });
          } else {
            result.errors.push({ email, error: msg });
          }
          continue;
        }

        // Update profile with section if provided (trigger already inserted profile+role)
        if (created?.user?.id && section) {
          await supabaseAdmin
            .from("profiles")
            .update({ section })
            .eq("id", created.user.id);
        }

        result.created++;
      } catch (e: any) {
        result.errors.push({ email, error: e?.message ?? "Failed" });
      }
    }

    return result;
  });

export type PurgeResult = { deleted: number; failed: { email: string; error: string }[] };

export const deleteAllStudents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { confirm: string }) => {
    if (input?.confirm !== "DELETE STUDENTS") throw new Error("Type DELETE STUDENTS to confirm");
    return input;
  })
  .handler(async ({ context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError || !isAdmin) throw new Error("Forbidden: admin role required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Admins are anyone with the admin role — everyone else is treated as a student
    const { data: adminRows } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    const adminIds = new Set((adminRows ?? []).map((r: any) => r.user_id));
    adminIds.add(context.userId);

    const { data: profileRows, error: pErr } = await supabaseAdmin.from("profiles").select("id, email");
    if (pErr) throw new Error(pErr.message);

    const authUsers: Array<{ id: string; email?: string }> = [];
    let page = 1;
    while (true) {
      const { data: userPage, error: listError } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 1000,
      });
      if (listError) throw new Error(`Could not list login accounts: ${listError.message}`);
      authUsers.push(...userPage.users);
      if (userPage.users.length < 1000) break;
      page += 1;
    }

    const targetsById = new Map<string, { id: string; email?: string | null }>();
    for (const user of authUsers) {
      if (!adminIds.has(user.id)) targetsById.set(user.id, user);
    }
    for (const profile of profileRows ?? []) {
      if (profile.id && !adminIds.has(profile.id)) targetsById.set(profile.id, profile);
    }
    const targets = Array.from(targetsById.values());
    const ids = targets.map((target) => target.id);

    const result: PurgeResult = { deleted: 0, failed: [] };
    if (ids.length === 0) return result;

    // Clear dependent rows that block user deletion
    const cleanupOperations = [
      supabaseAdmin.from("notifications").delete().in("user_id", ids),
      supabaseAdmin.from("notifications").delete().in("actor_id", ids),
      supabaseAdmin.from("team_meeting_agreements").delete().in("user_id", ids),
      supabaseAdmin.from("team_meeting_proposals").delete().in("proposed_by", ids),
      supabaseAdmin.from("group_norms_signatures").delete().in("user_id", ids),
      supabaseAdmin.from("file_comments").delete().in("author_id", ids),
      supabaseAdmin.from("manager_submissions").delete().in("submitted_by", ids),
      supabaseAdmin.from("team_members").delete().in("user_id", ids),
      supabaseAdmin.from("auth_audit_log").delete().in("user_id", ids),
      supabaseAdmin.from("files").update({ assigned_to: null }).in("assigned_to", ids),
      supabaseAdmin.from("files").update({ uploaded_by: context.userId }).in("uploaded_by", ids),
      supabaseAdmin.from("file_versions").update({ uploaded_by: context.userId }).in("uploaded_by", ids),
    ];
    const cleanupResults = await Promise.all(cleanupOperations);
    const cleanupError = cleanupResults.find((operation) => operation.error)?.error;
    if (cleanupError) throw new Error(`Could not clean student records: ${cleanupError.message}`);

    for (const p of targets) {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(p.id);
      if (error && !/not found/i.test(error.message)) {
        result.failed.push({ email: p.email ?? p.id, error: error.message });
        continue;
      }
      // Remove the profile row too (covers orphaned profiles with no auth user)
      const { error: profileError } = await supabaseAdmin.from("profiles").delete().eq("id", p.id);
      const { error: userRoleError } = await supabaseAdmin.from("user_roles").delete().eq("user_id", p.id);
      if (profileError || userRoleError) {
        result.failed.push({
          email: p.email ?? p.id,
          error: profileError?.message ?? userRoleError?.message ?? "Profile cleanup failed",
        });
        continue;
      }
      result.deleted++;
    }
    return result;
  });
