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

/**
 * Before a team may tick a deadline complete, check the evidence ClientVault
 * already holds for it. Unmet requirements are returned so the team sees an
 * error; they may still override, and the override is recorded.
 */
export const checkDutyRequirements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { teamId: string; dutyId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    const { data: membership } = await supabase
      .from("team_members")
      .select("id")
      .eq("team_id", data.teamId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership && !isAdmin) throw new Error("You are not on this team.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { proofsForRole } = await import("@/lib/proofs");
    const { roleStudy } = await import("@/lib/role-study");
    const { isNormsComplete, normalizeNorms } = await import("@/lib/group-norms");

    const { data: duty } = await supabaseAdmin
      .from("pm_duties")
      .select("id, title")
      .eq("id", data.dutyId)
      .maybeSingle();
    if (!duty) throw new Error("That responsibility no longer exists.");

    const title = (duty.title ?? "").toLowerCase();
    const missing: string[] = [];

    const [{ data: team }, { data: members }, { data: proposal }] = await Promise.all([
      supabaseAdmin
        .from("teams")
        .select("id, name, display_name")
        .eq("id", data.teamId)
        .maybeSingle(),
      supabaseAdmin
        .from("team_members")
        .select("user_id, job_title")
        .eq("team_id", data.teamId),
      supabaseAdmin
        .from("team_meeting_proposals")
        .select("id, meeting_time, location")
        .eq("team_id", data.teamId)
        .maybeSingle(),
    ]);

    const rows = (members ?? []) as { user_id: string; job_title: string }[];
    const { data: profileRows } = await supabaseAdmin
      .from("profiles")
      .select("id, name")
      .in("id", rows.length ? rows.map((m) => m.user_id) : ["00000000-0000-0000-0000-000000000000"]);
    const names = new Map((profileRows ?? []).map((p) => [p.id, p.name as string]));
    const roster = rows.map((m) => ({
      user_id: m.user_id,
      job_title: m.job_title,
      profiles: { name: names.get(m.user_id) ?? "A team member" },
    }));


    if (title.includes("team name") || title.includes("meeting time submitted")) {
      const label = (team?.display_name || team?.name || "").trim();
      if (!label || /^team\s*\d*$/i.test(label)) missing.push("The team still needs its management firm name.");
      if (!roster.some((m) => m.job_title === "PM")) missing.push("No Project Manager has been assigned.");
      if (!proposal) missing.push("No weekly meeting day, time and place has been submitted.");
    } else if (title.includes("team readiness")) {
      const memberCount = roster.length;
      const [{ data: studyRows }, { data: subs }, { data: agreements }, { data: norms }] =
        await Promise.all([
          supabaseAdmin.from("role_study_progress").select("user_id, role, checked").eq("team_id", data.teamId),
          supabaseAdmin.from("proof_submissions").select("user_id, proof_key").eq("team_id", data.teamId),
          proposal
            ? supabaseAdmin
                .from("team_meeting_agreements")
                .select("user_id, status")
                .eq("proposal_id", proposal.id)
            : Promise.resolve({ data: [] as { user_id: string; status: string }[] }),
          supabaseAdmin
            .from("group_norms")
            .select("id, version, content")
            .eq("team_id", data.teamId)
            .maybeSingle(),
        ]);

      const normsComplete = !!norms && isNormsComplete(normalizeNorms(norms.content));
      if (!normsComplete) missing.push("The Group Norms document is not finished.");

      const { data: sigs } = norms
        ? await supabaseAdmin
            .from("group_norms_signatures")
            .select("user_id")
            .eq("group_norms_id", norms.id)
            .eq("version", norms.version)
        : { data: [] as { user_id: string }[] };

      const signed = new Set((sigs ?? []).map((s) => s.user_id));
      const agreed = new Set(
        ((agreements ?? []) as { user_id: string; status: string }[])
          .filter((a) => a.status === "agreed")
          .map((a) => a.user_id),
      );
      const submittedBy = new Map<string, Set<string>>();
      for (const s of (subs ?? []) as { user_id: string; proof_key: string }[]) {
        submittedBy.set(s.user_id, (submittedBy.get(s.user_id) ?? new Set()).add(s.proof_key));
      }
      const studyBy = new Map(
        ((studyRows ?? []) as { user_id: string; role: string; checked: number[] }[]).map((r) => [
          r.user_id,
          r,
        ]),
      );

      for (const m of roster) {
        const who = m.profiles?.name ?? "A team member";
        const gaps: string[] = [];
        if (!m.job_title || m.job_title === "Unassigned") {
          missing.push(`${who} has not picked a role.`);
          continue;
        }
        const study = roleStudy(m.job_title);
        const row = studyBy.get(m.user_id);
        if (study && !(row?.role === study.role && (row?.checked?.length ?? 0) >= study.items.length)) {
          gaps.push("role checklist");
        }
        const assigned = proofsForRole(m.job_title).filter(
          (p) => p.role !== "Researcher" || memberCount >= 6,
        );
        const done = submittedBy.get(m.user_id) ?? new Set<string>();
        if (assigned.some((p) => !done.has(p.key))) gaps.push("role proof points");
        if (!agreed.has(m.user_id)) gaps.push("meeting commitment");
        if (!signed.has(m.user_id)) gaps.push("Group Norms approval");
        if (gaps.length) missing.push(`${who} still needs: ${gaps.join(", ")}.`);
      }
    }

    return { ok: missing.length === 0, missing, title: duty.title as string };
  });

/** Records a completion, noting when the team overrode the checks. */
export const completeDuty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { teamId: string; dutyId: string; override?: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: membership } = await supabase
      .from("team_members")
      .select("id")
      .eq("team_id", data.teamId)
      .eq("user_id", userId)
      .maybeSingle();
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!membership && !isAdmin) throw new Error("You are not on this team.");

    const { error } = await supabase.from("pm_duty_completions").insert({
      duty_id: data.dutyId,
      team_id: data.teamId,
      completed_by: userId,
      completed_at: new Date().toISOString(),
      notes: data.override
        ? "Marked complete as an override — the required items were not all in place."
        : null,
    });
    if (error) throw error;
    return { ok: true };
  });
