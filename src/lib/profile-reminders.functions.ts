import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Admin view: who still has not finished their profile. */
export const listIncompleteProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { findIncompleteStudents } = await import("@/lib/profile-reminders.server");
    const targets = await findIncompleteStudents(supabaseAdmin as any);
    return targets.map((t) => ({
      userId: t.userId,
      name: t.name,
      email: t.email,
      missing: t.missing,
    }));
  });

/** Admin action: run the daily reminder pass now. */
export const sendProfileReminders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runProfileReminders } = await import("@/lib/profile-reminders.server");
    return await runProfileReminders(supabaseAdmin as any, { force: true });
  });
