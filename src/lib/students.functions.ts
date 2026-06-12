import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden: admin role required");
}

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

const EMAIL_DOMAIN = "mail.gvsu.edu";

export const bulkImportStudents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { rows: ImportRow[] }) => {
    if (!input || !Array.isArray(input.rows)) throw new Error("rows required");
    if (input.rows.length === 0) throw new Error("No rows to import");
    if (input.rows.length > 500) throw new Error("Max 500 rows per import");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
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

      const email = `${username}@${EMAIL_DOMAIN}`;
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
