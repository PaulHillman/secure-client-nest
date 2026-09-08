import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Admin-only: save a student's weekly availability on their behalf. */
export const saveAvailabilityFor = createServerFn({ method: "POST" })
  .inputValidator((data: { userId: string; slots: string[] }) => {
    if (!data?.userId || !Array.isArray(data.slots)) throw new Error("Invalid input");
    return { userId: data.userId, slots: data.slots.map(String) };
  })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("student_availability")
      .upsert({ user_id: data.userId, busy_slots: data.slots }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
