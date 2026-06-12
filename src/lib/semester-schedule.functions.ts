import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("Forbidden: admin role required");
}

export const getSemesterSchedule = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("semester_schedule")
      .select("start_date, end_date, updated_at")
      .eq("id", true)
      .maybeSingle();
    return { schedule: data ?? { start_date: null, end_date: null, updated_at: null } };
  });

export const updateSemesterSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { start_date: string | null; end_date: string | null }) => {
    const dateOk = (d: string | null) => d === null || /^\d{4}-\d{2}-\d{2}$/.test(d);
    if (!dateOk(input?.start_date) || !dateOk(input?.end_date)) throw new Error("Invalid date format (YYYY-MM-DD)");
    if (input.start_date && input.end_date && input.start_date > input.end_date)
      throw new Error("Start date must be on or before end date");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("semester_schedule")
      .upsert({
        id: true,
        start_date: data.start_date,
        end_date: data.end_date,
        updated_at: new Date().toISOString(),
        updated_by: context.userId,
      });
    if (error) throw error;
    return { ok: true };
  });

export const runAutoArchiveNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runDailyAutoArchive } = await import("./semester-auto.server");
    return await runDailyAutoArchive(supabaseAdmin as any);
  });
