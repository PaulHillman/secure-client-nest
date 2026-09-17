import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isPastDue, READINESS_STATUSES, TEAM_SETTABLE, type ReadinessStatus } from "@/lib/readiness";
import type { Database } from "@/integrations/supabase/types";

type RoleChecker = {
  rpc: (
    fn: "has_role",
    args: { _user_id: string; _role: "admin" },
  ) => PromiseLike<{ data: boolean | null }>;
};

async function isAdmin(supabase: RoleChecker, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  return data === true;
}

/**
 * Everything one team needs to see: the requirements their professor has opened
 * for their section, their own state on each, who owns it, and who still has no role.
 */
export const getTeamReadiness = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { teamId: string; studentId?: string }) => {
    if (!input?.teamId) throw new Error("Missing team.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const targetUserId = data.studentId ?? userId;

    const { data: team } = await supabase
      .from("teams")
      .select("id, name, display_name, section")
      .eq("id", data.teamId)
      .maybeSingle();
    if (!team) throw new Error("Team not found.");

    const admin = await isAdmin(supabase, userId);
    if (targetUserId !== userId && !admin) {
      throw new Error("You cannot view another student's team role.");
    }

    const { data: members } = await supabase
      .from("team_members")
      .select("user_id, job_title")
      .eq("team_id", data.teamId);
    const memberIds = (members ?? []).map((m) => m.user_id);
    const viewerMember = (members ?? []).find((m) => m.user_id === targetUserId);
    if (!viewerMember && !admin) throw new Error("You are not on this team.");

    const section = team.section ?? "";

    // Openings are per section, so only this team's section is read.
    const [{ data: requirements }, { data: openings }, { data: statuses }, { data: profiles }] =
      await Promise.all([
        supabase
          .from("project_requirements")
          .select("key, title, alias, description, module_number, order_index")
          .eq("active", true)
          .order("order_index"),
        supabase
          .from("requirement_openings")
          .select("requirement_key, due_at, opened_at")
          .eq("section", section),
        supabase.from("team_requirement_status").select("*").eq("team_id", data.teamId),
        memberIds.length
          ? supabase.from("profiles").select("id, name, avatar_url").in("id", memberIds)
          : Promise.resolve({ data: [] as { id: string; name: string; avatar_url: string | null }[] }),
      ]);

    const openByKey = new Map((openings ?? []).map((o) => [o.requirement_key, o]));

    const statusByKey = new Map((statuses ?? []).map((s) => [s.requirement_key, s]));
    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

    const needsRole = (members ?? [])
      .filter((m) => !m.job_title || m.job_title === "Unassigned")
      .map((m) => ({
        userId: m.user_id,
        name: profileById.get(m.user_id)?.name ?? "A teammate",
        avatarUrl: profileById.get(m.user_id)?.avatar_url ?? null,
      }));

    const items = (requirements ?? []).map((r) => {
      const opening = openByKey.get(r.key);
      const row = statusByKey.get(r.key);
      const owner = row?.owner_id ? profileById.get(row.owner_id) : undefined;
      // Team setup can never be Approved while somebody has no role.
      const blockers = r.key === "team_setup" && needsRole.length ? needsRole.map((n) => n.name) : [];
      return {
        key: r.key,
        title: r.title,
        alias: r.alias,
        description: r.description,
        moduleNumber: r.module_number,
        open: !!opening,
        dueAt: opening?.due_at ?? null,
        status: (row?.status ?? "not_started") as ReadinessStatus,
        ownerId: row?.owner_id ?? null,
        ownerName: owner?.name ?? null,
        ownerAvatarUrl: owner?.avatar_url ?? null,
        revisionNote: row?.revision_note ?? null,
        submittedAt: row?.submitted_at ?? null,
        overdue:
          !!opening?.due_at &&
          new Date(opening.due_at) < new Date() &&
          (row?.status ?? "not_started") !== "approved",
        blockers,
      };
    });

    return {
      team,
      isAdmin: admin && targetUserId === userId,
      isPM: viewerMember?.job_title === "PM",
      members: (members ?? []).map((m) => ({
        userId: m.user_id,
        jobTitle: (m.job_title as string) ?? "Unassigned",
        name: profileById.get(m.user_id)?.name ?? "A teammate",
        avatarUrl: profileById.get(m.user_id)?.avatar_url ?? null,
      })),
      needsRole,
      items,
    };
  });

/** A team moves its own work forward. Approve / send back stays with the professor. */
export const setRequirementStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { teamId: string; key: string; status: ReadinessStatus; ownerId?: string | null }) => {
    if (!input?.teamId || !input?.key) throw new Error("Missing team or requirement.");
    if (!TEAM_SETTABLE.includes(input.status)) throw new Error("Only your professor can set that state.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const admin = await isAdmin(supabase, userId);

    const { data: membership } = await supabase
      .from("team_members")
      .select("user_id")
      .eq("team_id", data.teamId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership && !admin) throw new Error("You are not on this team.");

    if (data.status === "submitted" && data.key === "team_setup") {
      const { data: members } = await supabase
        .from("team_members")
        .select("job_title")
        .eq("team_id", data.teamId);
      if ((members ?? []).some((m) => !m.job_title || m.job_title === "Unassigned")) {
        throw new Error("Every member needs a role before team setup can be submitted.");
      }
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("team_requirement_status").upsert(
      {
        team_id: data.teamId,
        requirement_key: data.key,
        status: data.status,
        owner_id: data.ownerId ?? undefined,
        submitted_at: data.status === "submitted" ? new Date().toISOString() : null,
        updated_by: userId,
      },
      { onConflict: "team_id,requirement_key" },
    );
    if (error) throw error;
    return { ok: true };
  });

/** Assign the team member responsible for an item, so the PM knows who to chase. */
export const setRequirementOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { teamId: string; key: string; ownerId: string | null }) => {
    if (!input?.teamId || !input?.key) throw new Error("Missing team or requirement.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const admin = await isAdmin(supabase, userId);
    const { data: membership } = await supabase
      .from("team_members")
      .select("job_title")
      .eq("team_id", data.teamId)
      .eq("user_id", userId)
      .maybeSingle();
    if (membership?.job_title !== "PM" && !admin) {
      throw new Error("Only the Project Manager can assign who owns an item.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("team_requirement_status").upsert(
      {
        team_id: data.teamId,
        requirement_key: data.key,
        owner_id: data.ownerId,
        updated_by: userId,
      },
      { onConflict: "team_id,requirement_key" },
    );
    if (error) throw error;
    return { ok: true };
  });

/** The PM chases a teammate. Logged, and the professor is copied. */
export const nudgeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { teamId: string; key: string; targetUserId: string; message?: string }) => {
    if (!input?.teamId || !input?.key || !input?.targetUserId) throw new Error("Missing details.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const admin = await isAdmin(supabase, userId);
    const { data: membership } = await supabase
      .from("team_members")
      .select("job_title")
      .eq("team_id", data.teamId)
      .eq("user_id", userId)
      .maybeSingle();
    if (membership?.job_title !== "PM" && !admin) {
      throw new Error("Only the Project Manager can send a nudge.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: req }, { data: sender }] = await Promise.all([
      supabaseAdmin.from("project_requirements").select("title").eq("key", data.key).maybeSingle(),
      supabaseAdmin.from("profiles").select("name").eq("id", userId).maybeSingle(),
    ]);

    const text =
      data.message?.trim() ||
      `${sender?.name ?? "Your Project Manager"} is waiting on you for "${req?.title ?? data.key}".`;

    await supabaseAdmin.from("requirement_nudges").insert({
      team_id: data.teamId,
      requirement_key: data.key,
      target_user_id: data.targetUserId,
      sent_by: userId,
      message: text,
    });

    // The PM copy trigger on notifications keeps the PM in the loop automatically.
    const { error } = await supabaseAdmin.from("notifications").insert({
      user_id: data.targetUserId,
      team_id: data.teamId,
      actor_id: userId,
      kind: "requirement_nudge",
      message: text,
    });
    if (error) throw error;

    // Email the person as well, so the nudge lands outside the app too.
    try {
      const [{ data: target }, { data: team }] = await Promise.all([
        supabaseAdmin.from("profiles").select("name, email").eq("id", data.targetUserId).maybeSingle(),
        supabaseAdmin.from("teams").select("name, display_name").eq("id", data.teamId).maybeSingle(),
      ]);
      if (target?.email) {
        const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
        await sendTemplateEmail("requirement-nudge", target.email, {
          templateData: {
            name: target.name ?? undefined,
            teamName: team?.display_name ?? team?.name ?? "your team",
            title: req?.title ?? data.key,
            senderName: sender?.name ?? "Your Project Manager",
            note: data.message?.trim() || undefined,
          },
          idempotencyKey: `req-nudge:${data.teamId}:${data.key}:${data.targetUserId}:${Date.now()}`,
        });
      }
    } catch (e) {
      console.error("nudge email failed", e);
    }

    return { ok: true };
  });

/* ---------------------------------- admin --------------------------------- */

/** One row per team, one column per requirement. */
export const getReadinessBoard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: teams }, { data: requirements }, { data: statuses }, { data: openings }, { data: members }] =
      await Promise.all([
        supabaseAdmin.from("teams").select("id, name, display_name, section").eq("is_test", false).order("section").order("name"),
        supabaseAdmin
          .from("project_requirements")
          .select("key, title, alias, module_number, order_index")
          .eq("active", true)
          .order("order_index"),
        supabaseAdmin.from("team_requirement_status").select("*"),
        supabaseAdmin.from("requirement_openings").select("requirement_key, section, due_at"),
        supabaseAdmin.from("team_members").select("team_id, user_id, job_title"),
      ]);

    type StatusRow = Database["public"]["Tables"]["team_requirement_status"]["Row"];
    const byTeam = new Map<string, Map<string, StatusRow>>();
    for (const s of statuses ?? []) {
      if (!byTeam.has(s.team_id)) byTeam.set(s.team_id, new Map());
      byTeam.get(s.team_id)!.set(s.requirement_key, s);
    }
    const unassigned = new Map<string, number>();
    const memberIds = [...new Set((members ?? []).map((m) => m.user_id))];
    const { data: memberProfiles } = memberIds.length
      ? await supabaseAdmin.from("profiles").select("id, name").in("id", memberIds)
      : { data: [] as { id: string; name: string }[] };
    const nameById = new Map((memberProfiles ?? []).map((p) => [p.id, p.name]));
    const membersByTeam = new Map<string, { userId: string; name: string; jobTitle: string }[]>();
    for (const m of members ?? []) {
      if (!m.job_title || m.job_title === "Unassigned") {
        unassigned.set(m.team_id, (unassigned.get(m.team_id) ?? 0) + 1);
      }
      if (!membersByTeam.has(m.team_id)) membersByTeam.set(m.team_id, []);
      membersByTeam.get(m.team_id)!.push({
        userId: m.user_id,
        name: nameById.get(m.user_id) ?? "Team member",
        jobTitle: m.job_title ?? "Unassigned",
      });
    }
    const openSet = new Set((openings ?? []).map((o) => `${o.requirement_key}|${o.section}`));
    const dueBy = new Map((openings ?? []).map((o) => [`${o.requirement_key}|${o.section}`, o.due_at]));

    return {
      requirements: requirements ?? [],
      sections: [...new Set((teams ?? []).map((t) => t.section).filter(Boolean))] as string[],
      rows: (teams ?? []).map((t) => ({
        team: t,
        needsRoleCount: unassigned.get(t.id) ?? 0,
        members: membersByTeam.get(t.id) ?? [],
        cells: (requirements ?? []).map((r) => {
          const k = `${r.key}|${t.section ?? ""}`;
          const row = byTeam.get(t.id)?.get(r.key);
          const dueAt = dueBy.get(k) ?? null;
          const status = (row?.status ?? "not_started") as ReadinessStatus;
          return {
            key: r.key,
            status,
            open: openSet.has(k),
            dueAt,
            overdue: !!dueAt && new Date(dueAt) < new Date() && status !== "approved",
            ownerId: row?.owner_id ?? null,
          };
        }),
      })),
    };
  });

/** Professor kickoff: open a requirement for a section (or close it again). */
export const setRequirementOpening = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { key: string; sections: string[]; open: boolean; dueAt?: string | null }) => {
    if (!input?.key || !Array.isArray(input.sections)) throw new Error("Missing details.");
    return input;
  })
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (!data.open) {
      const { error } = await supabaseAdmin
        .from("requirement_openings")
        .delete()
        .eq("requirement_key", data.key)
        .in("section", data.sections);
      if (error) throw error;
      return { opened: 0, closed: data.sections.length };
    }

    const { error } = await supabaseAdmin.from("requirement_openings").upsert(
      data.sections.map((section) => ({
        requirement_key: data.key,
        section,
        due_at: data.dueAt ?? null,
        opened_by: context.userId,
      })),
      { onConflict: "requirement_key,section" },
    );
    if (error) throw error;
    return { opened: data.sections.length, closed: 0 };
  });

/** Everything the professor needs to read one team's submitted module. */
export const getSubmissionReview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { teamId: string; key: string }) => {
    if (!input?.teamId || !input?.key) throw new Error("Missing details.");
    return input;
  })
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: sub }, { data: status }, { data: req }] = await Promise.all([
      supabaseAdmin
        .from("requirement_submissions")
        .select("answers, submitted_at, submitted_by, submit_count, updated_at, updated_by")
        .eq("team_id", data.teamId)
        .eq("requirement_key", data.key)
        .maybeSingle(),
      supabaseAdmin
        .from("team_requirement_status")
        .select("status, submitted_at, revision_note")
        .eq("team_id", data.teamId)
        .eq("requirement_key", data.key)
        .maybeSingle(),
      supabaseAdmin.from("project_requirements").select("key, title").eq("key", data.key).maybeSingle(),
    ]);

    const answers: Record<string, string> = {};
    const raw = sub?.answers;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        if (typeof v === "string") answers[k] = v;
      }
    }

    const ids = [sub?.submitted_by, sub?.updated_by].filter(Boolean) as string[];
    const { data: profiles } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, name").in("id", ids)
      : { data: [] as { id: string; name: string }[] };
    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.name]));

    // Team setup is judged on the team's real records, not only the answer sheet.
    let roster: { name: string; jobTitle: string }[] = [];
    if (data.key === "team_setup") {
      const { data: members } = await supabaseAdmin
        .from("team_members")
        .select("user_id, job_title")
        .eq("team_id", data.teamId);
      const memberIds = (members ?? []).map((m) => m.user_id);
      const { data: mp } = memberIds.length
        ? await supabaseAdmin.from("profiles").select("id, name").in("id", memberIds)
        : { data: [] as { id: string; name: string }[] };
      const byId = new Map((mp ?? []).map((p) => [p.id, p.name]));
      roster = (members ?? []).map((m) => ({
        name: byId.get(m.user_id) ?? "A teammate",
        jobTitle: (m.job_title as string) ?? "Unassigned",
      }));
    }

    return {
      title: req?.title ?? data.key,
      answers,
      roster,
      status: (status?.status ?? "not_started") as ReadinessStatus,
      revisionNote: status?.revision_note ?? null,
      submittedAt: status?.submitted_at ?? sub?.submitted_at ?? null,
      submittedByName: sub?.submitted_by ? nameById.get(sub.submitted_by) ?? null : null,
      lastEditedAt: sub?.updated_at ?? null,
      lastEditedByName: sub?.updated_by ? nameById.get(sub.updated_by) ?? null : null,
      submitCount: sub?.submit_count ?? 0,
    };
  });

/** Professor approves or sends something back with a note. */
export const decideRequirement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { teamId: string; key: string; status: ReadinessStatus; note?: string }) => {
    if (!input?.teamId || !input?.key) throw new Error("Missing details.");
    if (!READINESS_STATUSES.includes(input.status)) throw new Error("Unknown state.");
    return input;
  })
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin.from("team_requirement_status").upsert(
      {
        team_id: data.teamId,
        requirement_key: data.key,
        status: data.status,
        revision_note: data.status === "needs_revision" ? data.note ?? null : null,
        decided_at: new Date().toISOString(),
        decided_by: context.userId,
        updated_by: context.userId,
      },
      { onConflict: "team_id,requirement_key" },
    );
    if (error) throw error;

    // On a send-back the whole team gets the note so everyone knows what to fix;
    // on approval the PM gets the confirmation (they own the checklist).
    const [{ data: members }, { data: req }] = await Promise.all([
      supabaseAdmin
        .from("team_members")
        .select("user_id, job_title")
        .eq("team_id", data.teamId)
        .neq("job_title", "Unassigned"),
      supabaseAdmin.from("project_requirements").select("title").eq("key", data.key).maybeSingle(),
    ]);
    const title = req?.title ?? data.key;
    const recipients =
      data.status === "approved"
        ? (members ?? []).filter((m) => m.job_title === "PM")
        : (members ?? []);
    const message =
      data.status === "approved"
        ? `"${title}" was approved.`
        : `"${title}" was sent back${data.note ? `: ${data.note}` : "."}`;
    if (recipients.length) {
      await supabaseAdmin.from("notifications").insert(
        recipients.map((m) => ({
          user_id: m.user_id,
          team_id: data.teamId,
          actor_id: context.userId,
          kind: "requirement_decision",
          message,
        })),
      );
    }

    // Email the same people, so the decision reaches them outside the app too.
    if (recipients.length) {
      const [{ data: profiles }, { data: team }] = await Promise.all([
        supabaseAdmin
          .from("profiles")
          .select("id, name, email")
          .in("id", recipients.map((m) => m.user_id)),
        supabaseAdmin
          .from("teams")
          .select("name, display_name")
          .eq("id", data.teamId)
          .maybeSingle(),
      ]);
      const teamName = team?.display_name || team?.name || "your team";
      const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
      await Promise.all(
        (profiles ?? [])
          .filter((p) => !!p.email)
          .map((p) =>
            sendTemplateEmail("requirement-decision", p.email as string, {
              templateData: {
                name: p.name,
                teamName,
                title,
                approved: data.status === "approved",
                note: data.status === "needs_revision" ? data.note ?? "" : "",
              },
              idempotencyKey: `req-decision:${data.teamId}:${data.key}:${data.status}:${p.id}:${Date.now()}`,
            }).catch((e) => console.error("decision email failed", e)),
          ),
      );
    }
    return { ok: true };
  });
