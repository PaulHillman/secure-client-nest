import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Finds every active duty whose due date has passed and that a team has not
 * completed, then notifies that team's Project Manager (and all admins).
 * Duplicate reminders for the same team + duty are skipped.
 */
export const notifyOverdueDuties = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const nowIso = new Date().toISOString();

    const [{ data: duties }, { data: teams }, { data: completions }, { data: admins }, { data: existing }] =
      await Promise.all([
        supabaseAdmin
          .from("pm_duties")
          .select("id, title, due_at")
          .eq("active", true)
          .not("due_at", "is", null)
          .lt("due_at", nowIso),
        supabaseAdmin.from("teams").select("id, name, display_name, section").eq("is_test", false),
        supabaseAdmin.from("pm_duty_completions").select("duty_id, team_id"),
        supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin"),
        supabaseAdmin.from("notifications").select("message, user_id").eq("kind", "pm_duty_overdue"),
      ]);

    if (!duties?.length || !teams?.length) return { notified: 0, overdue: 0 };

    const done = new Set((completions ?? []).map((c) => `${c.duty_id}:${c.team_id}`));
    const sent = new Set((existing ?? []).map((n) => `${n.user_id}|${n.message}`));

    const { data: pms } = await supabaseAdmin
      .from("team_members")
      .select("team_id, user_id")
      .eq("job_title", "PM");
    const pmByTeam = new Map<string, string[]>();
    for (const p of pms ?? []) {
      pmByTeam.set(p.team_id, [...(pmByTeam.get(p.team_id) ?? []), p.user_id]);
    }
    const adminIds = (admins ?? []).map((a) => a.user_id);

    const rows: {
      user_id: string;
      team_id: string;
      actor_id: string;
      kind: string;
      message: string;
    }[] = [];
    let overdue = 0;

    for (const team of teams) {
      const label = team.display_name || team.name;
      const withSection = team.section ? `${label} (Section ${team.section})` : label;
      for (const duty of duties) {
        if (done.has(`${duty.id}:${team.id}`)) continue;
        overdue++;
        const due = new Date(duty.due_at as string).toLocaleString();
        const message = `${withSection} missed the deadline for "${duty.title}" (due ${due}).`;
        const recipients = new Set([...(pmByTeam.get(team.id) ?? []), ...adminIds]);
        for (const user_id of recipients) {
          if (sent.has(`${user_id}|${message}`)) continue;
          sent.add(`${user_id}|${message}`);
          rows.push({
            user_id,
            team_id: team.id,
            actor_id: context.userId,
            kind: "pm_duty_overdue",
            message,
          });
        }
      }
    }

    if (rows.length) {
      const { error } = await supabaseAdmin.from("notifications").insert(rows);
      if (error) throw error;
    }
    return { notified: rows.length, overdue };
  });
