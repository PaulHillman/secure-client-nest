import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { READINESS_STATUSES, TEAM_SETTABLE, type ReadinessStatus } from "@/lib/readiness";
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
  .inputValidator((input: { teamId: string }) => {
    if (!input?.teamId) throw new Error("Missing team.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: team } = await supabase
      .from("teams")
      .select("id, name, display_name, section")
      .eq("id", data.teamId)
      .maybeSingle();
    if (!team) throw new Error("Team not found.");

    const admin = await isAdmin(supabase, userId);

    const { data: members } = await supabase
      .from("team_members")
      .select("user_id, job_title")
      .eq("team_id", data.teamId);
    const memberIds = (members ?? []).map((m) => m.user_id);
    const viewerMember = (members ?? []).find((m) => m.user_id === userId);
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
      isAdmin: admin,
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
        supabaseAdmin.from("team_members").select("team_id, job_title"),
      ]);

    type StatusRow = Database["public"]["Tables"]["team_requirement_status"]["Row"];
    const byTeam = new Map<string, Map<string, StatusRow>>();
    for (const s of statuses ?? []) {
      if (!byTeam.has(s.team_id)) byTeam.set(s.team_id, new Map());
      byTeam.get(s.team_id)!.set(s.requirement_key, s);
    }
    const unassigned = new Map<string, number>();
    for (const m of members ?? []) {
      if (!m.job_title || m.job_title === "Unassigned") {
        unassigned.set(m.team_id, (unassigned.get(m.team_id) ?? 0) + 1);
      }
    }
    const openSet = new Set((openings ?? []).map((o) => `${o.requirement_key}|${o.section}`));
    const dueBy = new Map((openings ?? []).map((o) => [`${o.requirement_key}|${o.section}`, o.due_at]));

    return {
      requirements: requirements ?? [],
      sections: [...new Set((teams ?? []).map((t) => t.section).filter(Boolean))] as string[],
      rows: (teams ?? []).map((t) => ({
        team: t,
        needsRoleCount: unassigned.get(t.id) ?? 0,
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

    // Tell the PM — the trigger on notifications copies them on everything anyway,
    // but the PM is the person who has to act on a send-back.
    const [{ data: pms }, { data: req }] = await Promise.all([
      supabaseAdmin.from("team_members").select("user_id").eq("team_id", data.teamId).eq("job_title", "PM"),
      supabaseAdmin.from("project_requirements").select("title").eq("key", data.key).maybeSingle(),
    ]);
    const message =
      data.status === "approved"
        ? `"${req?.title ?? data.key}" was approved.`
        : `"${req?.title ?? data.key}" was sent back${data.note ? `: ${data.note}` : "."}`;
    if (pms?.length) {
      await supabaseAdmin.from("notifications").insert(
        pms.map((p) => ({
          user_id: p.user_id,
          team_id: data.teamId,
          actor_id: context.userId,
          kind: "requirement_decision",
          message,
        })),
      );
    }
    return { ok: true };
  });
