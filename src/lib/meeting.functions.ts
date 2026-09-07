import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const notifyMeetingChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { teamId: string; message: string }) => {
    if (!input?.teamId || !input?.message) throw new Error("teamId and message are required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: admins } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    const rows = (admins ?? []).map((a) => ({
      user_id: a.user_id,
      team_id: data.teamId,
      actor_id: context.userId,
      kind: "meeting_time_change",
      message: data.message,
    }));
    if (rows.length) {
      const { error } = await supabaseAdmin.from("notifications").insert(rows);
      if (error) throw error;
    }
    return { notified: rows.length };
  });
