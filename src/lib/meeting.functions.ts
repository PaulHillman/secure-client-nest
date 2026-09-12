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

/**
 * Record a team member's response to the proposed meeting time. The PM must
 * sign just like everyone else — proposing the time is not an approval.
 * Admins may pass studentId when viewing as a student.
 */
export const respondMeetingAgreement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      teamId: string;
      status: "agreed" | "declined";
      initials: string;
      fullName?: string;
      studentId?: string;
    }) => {
      if (!input?.teamId || !input?.status) throw new Error("teamId and status are required");
      if (input.status !== "agreed" && input.status !== "declined") throw new Error("Bad status");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { AGREEMENT_VERSION, agreementText, meetingDetailsLine } = await import(
      "@/lib/meeting-agreement"
    );

    const target = data.studentId ?? context.userId;
    if (target !== context.userId) {
      const { data: isAdmin } = await context.supabase.rpc("has_role", {
        _user_id: context.userId,
        _role: "admin",
      });
      if (!isAdmin) throw new Error("You cannot respond for another student");
    }

    const { data: member } = await supabaseAdmin
      .from("team_members")
      .select("id")
      .eq("team_id", data.teamId)
      .eq("user_id", target)
      .maybeSingle();
    if (!member) throw new Error("That student is not on this team");

    const { data: proposal } = await supabaseAdmin
      .from("team_meeting_proposals")
      .select("*")
      .eq("team_id", data.teamId)
      .maybeSingle();
    if (!proposal) throw new Error("No meeting time has been proposed yet");

    const cleaned = (data.initials ?? "").trim().toUpperCase();
    if (!/^[A-Z]{2,4}$/.test(cleaned)) throw new Error("Enter 2–4 letter initials");

    const row: Record<string, unknown> = {
      proposal_id: proposal.id,
      team_id: data.teamId,
      user_id: target,
      initials: cleaned,
      status: data.status,
      responded_at: new Date().toISOString(),
    };
    if (data.status === "agreed") {
      if (data.fullName?.trim()) row.full_name = data.fullName.trim();
      row.agreement_version = AGREEMENT_VERSION;
      row.agreement_text = agreementText(meetingDetailsLine(proposal as any));
    }

    const { error } = await supabaseAdmin
      .from("team_meeting_agreements")
      .upsert(row as any, { onConflict: "proposal_id,user_id" });
    if (error) throw error;
    await supabaseAdmin.from("profiles").update({ initials: cleaned }).eq("id", target);
    return { ok: true };
  });

/** A meeting was held somewhere other than the agreed place/time — tell the PM and the professor. */
export const notifyMeetingMoved = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { teamId: string; message: string }) => {
    if (!input?.teamId || !input?.message) throw new Error("teamId and message are required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: admins }, { data: members }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin"),
      supabaseAdmin
        .from("team_members")
        .select("user_id, job_title")
        .eq("team_id", data.teamId)
        .eq("job_title", "PM"),
    ]);
    const ids = new Set<string>([
      ...(admins ?? []).map((a: any) => a.user_id),
      ...(members ?? []).map((m: any) => m.user_id),
    ]);
    const rows = Array.from(ids).map((user_id) => ({
      user_id,
      team_id: data.teamId,
      actor_id: context.userId,
      kind: "meeting_moved",
      message: data.message,
    }));
    if (rows.length) {
      const { error } = await supabaseAdmin.from("notifications").insert(rows);
      if (error) throw error;
    }
    return { notified: rows.length };
  });

/** Sweep every team for weeks with no logged meeting / no minutes, and alert PM, Comms and admins. */
export const notifyMeetingGaps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input?: { weeks?: number }) => ({ weeks: Math.max(1, input?.weeks ?? 2) }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const since = new Date(Date.now() - data.weeks * 7 * 24 * 60 * 60 * 1000);
    const sinceDate = since.toISOString().slice(0, 10);

    const [teamsRes, membersRes, logsRes, adminsRes] = await Promise.all([
      supabaseAdmin.from("teams").select("id, name, display_name, section").eq("is_test", false),
      supabaseAdmin.from("team_members").select("team_id, user_id, job_title"),
      supabaseAdmin.from("meeting_logs").select("team_id, meeting_date, minutes_posted").gte("meeting_date", sinceDate),
      supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin"),
    ]);

    const adminIds = (adminsRes.data ?? []).map((a: any) => a.user_id);
    const logsByTeam = new Map<string, any[]>();
    for (const l of (logsRes.data ?? []) as any[]) {
      logsByTeam.set(l.team_id, [...(logsByTeam.get(l.team_id) ?? []), l]);
    }

    const rows: { user_id: string; team_id: string; actor_id: string; kind: string; message: string }[] = [];
    const flagged: string[] = [];

    for (const t of (teamsRes.data ?? []) as any[]) {
      const members = (membersRes.data ?? []).filter((m: any) => m.team_id === t.id);
      if (members.length === 0) continue;
      const logs = logsByTeam.get(t.id) ?? [];
      const withMinutes = logs.filter((l) => l.minutes_posted);
      if (logs.length > 0 && withMinutes.length > 0) continue;

      const label = `${t.display_name || t.name}${t.section ? ` (Section ${t.section})` : ""}`;
      const reason =
        logs.length === 0
          ? `No meetings have been logged for ${label} in the last ${data.weeks} weeks.`
          : `${label} logged meetings but no minutes have been posted in the last ${data.weeks} weeks.`;
      flagged.push(label);

      const targets = members
        .filter((m: any) => m.job_title === "PM" || m.job_title === "Communication Specialist")
        .map((m: any) => m.user_id);
      for (const user_id of new Set([...targets, ...adminIds])) {
        rows.push({ user_id, team_id: t.id, actor_id: context.userId, kind: "meeting_gap", message: reason });
      }
    }

    if (rows.length) {
      const { error } = await supabaseAdmin.from("notifications").insert(rows);
      if (error) throw error;
    }
    return { flagged, teams: flagged.length, notified: rows.length };
  });
