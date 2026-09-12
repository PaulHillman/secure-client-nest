import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  findVagueLanguage,
  isNormsComplete,
  missingNorms,
  normalizeNorms,
  sameNorms,
  type NormsContent,
} from "@/lib/group-norms";

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

export type NormsRoster = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  jobTitle: string | null;
  approvedAt: string | null;
};

/** The team's group norms document, its approvals and its history. */
export const getTeamNorms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { teamId: string; studentId?: string }) => {
    if (!input?.teamId) throw new Error("Missing team.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const admin = await isAdmin(supabase, userId);
    const targetUserId = data.studentId ?? userId;
    if (targetUserId !== userId && !admin) {
      throw new Error("You cannot view another student's Group Norms progress.");
    }

    const { data: membership } = await supabase
      .from("team_members")
      .select("job_title")
      .eq("team_id", data.teamId)
      .eq("user_id", targetUserId)
      .maybeSingle();
    if (!membership && !admin) throw new Error("You are not on this team.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: norms } = await supabaseAdmin
      .from("group_norms")
      .select("id, version, content, updated_at, updated_by, flagged_for_review, flagged_at")
      .eq("team_id", data.teamId)
      .maybeSingle();

    const [{ data: members }, { data: sigs }, { data: history }] = await Promise.all([
      supabaseAdmin
        .from("team_members")
        .select("user_id, job_title")
        .eq("team_id", data.teamId),
      norms
        ? supabaseAdmin
            .from("group_norms_signatures")
            .select("user_id, signed_at, version")
            .eq("group_norms_id", norms.id)
        : Promise.resolve({ data: [] as { user_id: string; signed_at: string; version: number }[] }),
      norms
        ? supabaseAdmin
            .from("group_norms_versions")
            .select("version, created_at")
            .eq("group_norms_id", norms.id)
            .order("version", { ascending: false })
        : Promise.resolve({ data: [] as { version: number; created_at: string }[] }),
    ]);

    const memberIds = (members ?? []).map((m) => m.user_id);
    const ids = [...new Set([...memberIds, ...(norms?.updated_by ? [norms.updated_by] : [])])];
    const { data: profiles } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, name, email, avatar_url").in("id", ids)
      : { data: [] as { id: string; name: string; email: string | null; avatar_url: string | null }[] };
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

    const version = norms?.version ?? 1;
    const current = (sigs ?? []).filter((s) => s.version === version);
    const approvedAtByUser = new Map(current.map((s) => [s.user_id, s.signed_at]));

    const roster: NormsRoster[] = (members ?? []).map((m) => ({
      userId: m.user_id,
      name: byId.get(m.user_id)?.name || byId.get(m.user_id)?.email || "Team member",
      avatarUrl: byId.get(m.user_id)?.avatar_url ?? null,
      jobTitle: m.job_title ?? null,
      approvedAt: approvedAtByUser.get(m.user_id) ?? null,
    }));

    const content = normalizeNorms(norms?.content);

    return {
      exists: !!norms,
      version,
      content,
      updatedAt: norms?.updated_at ?? null,
      updatedByName: norms?.updated_by ? (byId.get(norms.updated_by)?.name ?? null) : null,
      roster,
      approvedCount: roster.filter((r) => r.approvedAt).length,
      total: roster.length,
      myApprovalAt: approvedAtByUser.get(targetUserId) ?? null,
      missing: missingNorms(content),
      complete: isNormsComplete(content),
      isMember: !!membership,
      isPM: membership?.job_title === "PM",
      isAdmin: admin,
      canEdit:
        targetUserId === userId && (membership?.job_title === "PM" || admin),
      canApprove: targetUserId === userId && !!membership,
      vagueFindings: findVagueLanguage(content),
      flaggedForReview: norms?.flagged_for_review === true,
      flaggedAt: norms?.flagged_at ?? null,
      history: (history ?? []).map((h) => ({ version: h.version, createdAt: h.created_at })),
    };
  });

/** Save the shared document. Changed wording starts a new version. */
export const saveTeamNorms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { teamId: string; content: Record<string, string>; studentId?: string }) => {
    if (!input?.teamId) throw new Error("Missing team.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId: authUserId } = context;
    const admin = await isAdmin(supabase, authUserId);
    // An admin viewing as a student writes as that student.
    const userId = data.studentId && admin ? data.studentId : authUserId;

    const { data: membership } = await supabase
      .from("team_members")
      .select("job_title")
      .eq("team_id", data.teamId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership && !admin) throw new Error("You are not on this team.");
    if (membership && membership.job_title !== "PM" && !admin) {
      throw new Error(
        "The Project Manager writes the Group Norms document. Give your input to your PM — every member still approves it.",
      );
    }

    const next: NormsContent = normalizeNorms(data.content);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("group_norms")
      .select("id, version, content")
      .eq("team_id", data.teamId)
      .maybeSingle();

    if (!existing) {
      const { data: created, error } = await supabaseAdmin
        .from("group_norms")
        .insert({
          team_id: data.teamId,
          content: next,
          version: 1,
          document_path: null,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        })
        .select("id, version")
        .single();
      if (error) throw error;
      await supabaseAdmin.from("group_norms_versions").insert({
        group_norms_id: created.id,
        team_id: data.teamId,
        version: 1,
        content: next,
        saved_by: userId,
      });
      return { version: 1, newVersion: true, vagueFindings: findVagueLanguage(next) };
    }

    const prev = normalizeNorms(existing.content);
    if (sameNorms(prev, next)) {
      // Nothing changed: approvals stay intact.
      return { version: existing.version, newVersion: false, vagueFindings: findVagueLanguage(next) };
    }

    const version = existing.version + 1;
    const { error } = await supabaseAdmin
      .from("group_norms")
      .update({ content: next, version, updated_by: userId, updated_at: new Date().toISOString(), flagged_for_review: false, flagged_at: null, vague_flags: [] })
      .eq("id", existing.id);
    if (error) throw error;
    await supabaseAdmin.from("group_norms_versions").insert({
      group_norms_id: existing.id,
      team_id: data.teamId,
      version,
      content: next,
      saved_by: userId,
    });
    return { version, newVersion: true, vagueFindings: findVagueLanguage(next) };
  });

/** Record this member's own approval of the current version. */
export const approveTeamNorms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { teamId: string; version: number; studentId?: string }) => {
      if (!input?.teamId || !Number.isInteger(input?.version)) throw new Error("Missing team or version.");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId: authUserId } = context;
    // Identity comes from the token; an admin viewing as a student approves as them.
    const userId =
      data.studentId && (await isAdmin(supabase, authUserId)) ? data.studentId : authUserId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = userId === authUserId ? supabase : supabaseAdmin;
    const { data: membership } = await db
      .from("team_members")
      .select("job_title")
      .eq("team_id", data.teamId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership) throw new Error("Only a current member of this team can approve its norms.");
    const { data: norms } = await supabaseAdmin
      .from("group_norms")
      .select("id, version, content")
      .eq("team_id", data.teamId)
      .maybeSingle();
    if (!norms) throw new Error("Your team has not saved its group norms yet.");
    if (norms.version !== data.version) {
      throw new Error("These norms were changed since you opened them. Reload and read the new version.");
    }
    const missing = missingNorms(normalizeNorms(norms.content));
    if (missing.length) {
      throw new Error(`Every section must be completed before approval. Still needed: ${missing.join(", ")}.`);
    }

    // Vague wording never blocks approval; it is simply recorded so it can appear
    // in the summary report before the kick-off meeting.
    const vagueFindings = findVagueLanguage(normalizeNorms(norms.content));


    const { error } = await supabaseAdmin.from("group_norms_signatures").insert({
      group_norms_id: norms.id,
      user_id: userId,
      version: norms.version,
      signed_at: new Date().toISOString(),
    });
    if (error && !/duplicate key/i.test(error.message)) throw error;

    if (vagueFindings.length) {
      await supabaseAdmin
        .from("group_norms")
        .update({
          flagged_for_review: true,
          flagged_at: new Date().toISOString(),
          vague_flags: vagueFindings,
        })
        .eq("id", norms.id);
    }

    return {
      ok: true as const,
      needsAcknowledgement: false,
      vagueFindings,
      version: norms.version,
    };
  });
