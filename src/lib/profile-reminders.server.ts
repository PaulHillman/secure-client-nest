// Server-only: daily reminders for students who have not finished their profile.
import type { SupabaseClient } from "@supabase/supabase-js";
import { completionStatus } from "@/lib/profile-completion";
import { sendTemplateEmail } from "@/lib/email-templates/send-email";

const KIND = "profile_incomplete";
const DAY_MS = 24 * 60 * 60 * 1000;

export type ReminderTarget = {
  userId: string;
  name: string;
  email: string | null;
  teamId: string | null;
  missing: string[];
  message: string;
};

/** Everyone (non-admin) still missing skills or availability. */
export async function findIncompleteStudents(
  supabaseAdmin: SupabaseClient,
): Promise<ReminderTarget[]> {
  const [profilesRes, availRes, membersRes, rolesRes] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, name, email, skills_have, skills_learn"),
    supabaseAdmin.from("student_availability").select("user_id"),
    supabaseAdmin.from("team_members").select("user_id, team_id"),
    supabaseAdmin.from("user_roles").select("user_id, role").eq("role", "admin"),
  ]);
  for (const r of [profilesRes, availRes, membersRes, rolesRes]) {
    if (r.error) throw r.error;
  }

  const hasAvail = new Set((availRes.data ?? []).map((a: any) => a.user_id));
  const teamByUser = new Map((membersRes.data ?? []).map((m: any) => [m.user_id, m.team_id]));
  const admins = new Set((rolesRes.data ?? []).map((a: any) => a.user_id));

  const targets: ReminderTarget[] = [];
  for (const p of (profilesRes.data ?? []) as any[]) {
    if (admins.has(p.id)) continue;
    const status = completionStatus({
      skillsHave: p.skills_have,
      skillsLearn: p.skills_learn,
      hasAvailability: hasAvail.has(p.id),
    });
    if (status.complete) continue;

    targets.push({
      userId: p.id,
      name: p.name || p.email || "Student",
      email: p.email ?? null,
      teamId: teamByUser.get(p.id) ?? null,
      missing: status.missing,
      message:
        `Your ClientVault profile is not finished yet — still to do: ${status.missing.join(", ")}. ` +
        "Only block time you absolutely cannot meet (class, scheduled work shifts, athletic practices) and leave as much time open as possible.",
    });
  }
  return targets;
}

/** Is today inside the admin-set reminder window? */
export async function remindersWindowOpen(supabaseAdmin: SupabaseClient) {
  const { data } = await supabaseAdmin
    .from("semester_schedule")
    .select("profile_reminders_start, profile_reminders_end")
    .eq("id", true)
    .maybeSingle();
  const today = new Date().toISOString().slice(0, 10);
  const start = (data as any)?.profile_reminders_start as string | null | undefined;
  const end = (data as any)?.profile_reminders_end as string | null | undefined;
  if (start && today < start) return { open: false, reason: `Reminders start ${start}` };
  if (end && today > end) return { open: false, reason: `Reminders ended ${end}` };
  return { open: true, reason: "" };
}

/** Send at most one reminder per student per 24 hours. */
export async function runProfileReminders(
  supabaseAdmin: SupabaseClient,
  opts: { force?: boolean } = {},
) {
  if (!opts.force) {
    const win = await remindersWindowOpen(supabaseAdmin);
    if (!win.open) return { candidates: 0, reminded: 0, skipped: 0, skippedReason: win.reason };
  }
  const targets = await findIncompleteStudents(supabaseAdmin);
  if (targets.length === 0) return { candidates: 0, reminded: 0, skipped: 0 };

  const { data: sent, error: sentErr } = await supabaseAdmin
    .from("profile_reminders")
    .select("user_id, last_sent_at")
    .eq("kind", KIND);
  if (sentErr) throw sentErr;

  const lastSent = new Map(
    (sent ?? []).map((r: any) => [r.user_id, new Date(r.last_sent_at).getTime()]),
  );
  const now = Date.now();
  const due = targets.filter((t) => now - (lastSent.get(t.userId) ?? 0) >= DAY_MS);
  if (due.length === 0) return { candidates: targets.length, reminded: 0, skipped: targets.length };

  // In-app notification. The database trigger copies each team's PM automatically.
  const { error: notifyErr } = await supabaseAdmin.from("notifications").insert(
    due.map((t) => ({
      user_id: t.userId,
      team_id: t.teamId,
      kind: KIND,
      message: t.message,
    })),
  );
  if (notifyErr) throw notifyErr;

  // Email each student. One send per student per day; suppressed recipients are skipped.
  const day = new Date(now).toISOString().slice(0, 10);
  let emailed = 0;
  for (const t of due) {
    if (!t.email) continue;
    try {
      const result = await sendTemplateEmail("profile-incomplete", t.email, {
        idempotencyKey: `profile-incomplete-${t.userId}-${day}`,
        templateData: { name: t.name, missing: t.missing },
      });
      if (result.sent) emailed += 1;
    } catch (e) {
      console.error("[profile-reminders] email failed for", t.userId, e);
    }
  }


  const { error: upsertErr } = await supabaseAdmin.from("profile_reminders").upsert(
    due.map((t) => ({
      user_id: t.userId,
      kind: KIND,
      last_sent_at: new Date(now).toISOString(),
      missing: t.missing,
    })),
    { onConflict: "user_id,kind" },
  );
  if (upsertErr) throw upsertErr;

  return {
    candidates: targets.length,
    reminded: due.length,
    emailed,
    skipped: targets.length - due.length,
  };
}
