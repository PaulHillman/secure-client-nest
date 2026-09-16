import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { teamLabel } from "@/lib/team-label";

export type SluggoFlag = {
  key: string;
  label: string;
  severity: "high" | "medium";
};

export type SluggoRow = {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  section: string | null;
  team: string | null;
  role: string | null;
  lastActive: string | null;
  eventsInWindow: number;
  practiceDone: number;
  uploads: number;
  comments: number;
  flags: SluggoFlag[];
};

type Stamp = { userId: string; at: string | null };

function push(map: Map<string, string[]>, userId: string | null, at: string | null | undefined) {
  if (!userId || !at) return;
  const list = map.get(userId);
  if (list) list.push(at);
  else map.set(userId, [at]);
}

/**
 * Activity report across every student. Sign-in rows alone badly understate
 * activity (the browser only logs a fresh sign-in), so "active" here means any
 * recorded action: sign-in, availability, role study, meeting agreement, norms
 * signature, practice submission, module answer, upload, comment, meeting log.
 */
export const getSluggoReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { windowDays: number }) => ({
    windowDays: [7, 14, 30].includes(input.windowDays) ? input.windowDays : 7,
  }))
  .handler(async ({ data, context }) => {
    const { data: admin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (admin !== true) throw new Error("Admins only.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const since = new Date();
    since.setDate(since.getDate() - data.windowDays);
    const sinceIso = since.toISOString();

    const [
      profilesRes,
      rolesRes,
      membersRes,
      teamsRes,
      authRes,
      availRes,
      studyRes,
      agreeRes,
      normsRes,
      proofRes,
      reqRes,
      filesRes,
      commentsRes,
      meetingRes,
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, name, email, section, avatar_url, skills_have, top_skills, phone_number"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.from("team_members").select("user_id, team_id, job_title"),
      supabaseAdmin.from("teams").select("id, name, section, display_name, is_test"),
      supabaseAdmin.from("auth_audit_log").select("user_id, created_at"),
      supabaseAdmin.from("student_availability").select("user_id, updated_at"),
      supabaseAdmin.from("role_study_progress").select("user_id, updated_at"),
      supabaseAdmin.from("team_meeting_agreements").select("user_id, responded_at"),
      supabaseAdmin.from("group_norms_signatures").select("user_id, signed_at"),
      supabaseAdmin.from("proof_submissions").select("user_id, submitted_at"),
      supabaseAdmin.from("requirement_submissions").select("submitted_by, updated_at"),
      supabaseAdmin.from("files").select("uploaded_by, created_at"),
      supabaseAdmin.from("file_comments").select("author_id, created_at"),
      supabaseAdmin.from("meeting_logs").select("logged_by, created_at"),
    ]);

    const events = new Map<string, string[]>();
    const add = (rows: Stamp[] | null | undefined) =>
      (rows ?? []).forEach((r) => push(events, r.userId, r.at));

    add((authRes.data ?? []).map((r) => ({ userId: r.user_id, at: r.created_at })));
    add((availRes.data ?? []).map((r) => ({ userId: r.user_id, at: r.updated_at })));
    add((studyRes.data ?? []).map((r) => ({ userId: r.user_id, at: r.updated_at })));
    add((agreeRes.data ?? []).map((r) => ({ userId: r.user_id, at: r.responded_at })));
    add((normsRes.data ?? []).map((r) => ({ userId: r.user_id, at: r.signed_at })));
    add((proofRes.data ?? []).map((r) => ({ userId: r.user_id, at: r.submitted_at })));
    add((reqRes.data ?? []).map((r) => ({ userId: r.submitted_by, at: r.updated_at })));
    add((filesRes.data ?? []).map((r) => ({ userId: r.uploaded_by, at: r.created_at })));
    add((commentsRes.data ?? []).map((r) => ({ userId: r.author_id, at: r.created_at })));
    add((meetingRes.data ?? []).map((r) => ({ userId: r.logged_by, at: r.created_at })));

    const practice = new Map<string, number>();
    (proofRes.data ?? []).forEach((r) => {
      if (r.user_id) practice.set(r.user_id, (practice.get(r.user_id) ?? 0) + 1);
    });
    const uploads = new Map<string, number>();
    (filesRes.data ?? []).forEach((r) => {
      if (r.uploaded_by) uploads.set(r.uploaded_by, (uploads.get(r.uploaded_by) ?? 0) + 1);
    });
    const comments = new Map<string, number>();
    (commentsRes.data ?? []).forEach((r) => {
      if (r.author_id) comments.set(r.author_id, (comments.get(r.author_id) ?? 0) + 1);
    });

    const teams = teamsRes.data ?? [];
    const teamById = new Map(teams.map((t) => [t.id, t]));
    const memberOf = new Map<string, { label: string; role: string; isTest: boolean }>();
    (membersRes.data ?? []).forEach((m) => {
      const team = m.team_id ? teamById.get(m.team_id) : undefined;
      if (!m.user_id || !team) return;
      memberOf.set(m.user_id, {
        label: teamLabel(team),
        role: m.job_title,
        isTest: team.is_test === true,
      });
    });

    const studentIds = new Set(
      (rolesRes.data ?? []).filter((r) => r.role === "student").map((r) => r.user_id),
    );
    const adminIds = new Set(
      (rolesRes.data ?? []).filter((r) => r.role === "admin").map((r) => r.user_id),
    );

    const rows: SluggoRow[] = (profilesRes.data ?? [])
      .filter((p) => studentIds.has(p.id) && !adminIds.has(p.id))
      .map((p) => {
        const stamps = events.get(p.id) ?? [];
        const lastActive = stamps.length ? stamps.reduce((a, b) => (a > b ? a : b)) : null;
        const inWindow = stamps.filter((s) => s >= sinceIso).length;
        const membership = memberOf.get(p.id);
        const profileDone =
          (p.skills_have?.length ?? 0) > 0 &&
          (p.top_skills?.length ?? 0) > 0 &&
          !!p.phone_number;
        const hasAvailability = (availRes.data ?? []).some((a) => a.user_id === p.id);

        const flags: SluggoFlag[] = [];
        if (!lastActive) flags.push({ key: "never", label: "No activity ever", severity: "high" });
        else if (inWindow === 0)
          flags.push({ key: "idle", label: `Nothing in ${data.windowDays}d`, severity: "high" });
        if (!membership) flags.push({ key: "no-team", label: "Not on any team", severity: "high" });
        else if (membership.role === "Unassigned")
          flags.push({ key: "no-role", label: "No role chosen", severity: "medium" });
        if (!profileDone) flags.push({ key: "profile", label: "Profile incomplete", severity: "medium" });
        if (!hasAvailability) flags.push({ key: "availability", label: "No availability set", severity: "medium" });
        if ((practice.get(p.id) ?? 0) === 0)
          flags.push({ key: "no-practice", label: "No role practice submitted", severity: "medium" });

        return {
          userId: p.id,
          name: p.name || p.email || "—",
          email: p.email ?? "",
          avatarUrl: p.avatar_url ?? null,
          section: p.section ?? null,
          team: membership && !membership.isTest ? membership.label : membership ? `${membership.label} (test)` : null,
          role: membership?.role ?? null,
          lastActive,
          eventsInWindow: inWindow,
          practiceDone: practice.get(p.id) ?? 0,
          uploads: uploads.get(p.id) ?? 0,
          comments: comments.get(p.id) ?? 0,
          flags,
        };
      })
      .filter((r) => r.flags.length > 0);

    return {
      rows,
      teams: teams
        .filter((t) => !t.is_test)
        .map((t) => ({ id: t.id, label: teamLabel(t) })),
      totalStudents: studentIds.size,
    };
  });
