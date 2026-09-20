import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assessTeam, type AssessmentInput, type TeamAssessment } from "@/lib/team-readiness-assessment";

type RoleChecker = {
  rpc: (
    fn: "has_role",
    args: { _user_id: string; _role: "admin" },
  ) => PromiseLike<{ data: boolean | null }>;
};

async function requireAdmin(supabase: RoleChecker, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (data !== true) throw new Error("Forbidden");
}

const CLIENT_KEY = "client_proposal";
const SETUP_KEY = "team_setup";

/**
 * Gathers every live record the assessment needs, for one team or all of them,
 * and runs the single shared calculation over each. The Teams indicator, the
 * assessment list, the detail report and the print view all read this.
 */
async function buildAssessments(teamId?: string): Promise<{
  assessments: TeamAssessment[];
  excluded: { id: string; name: string; section: string | null }[];
  generatedAt: string;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const generatedAt = new Date().toISOString();

  let teamQuery = supabaseAdmin
    .from("teams")
    .select("id, name, display_name, section, is_test")
    .order("section")
    .order("name");
  if (teamId) teamQuery = teamQuery.eq("id", teamId);
  const { data: allTeams, error: teamErr } = await teamQuery;
  if (teamErr) throw teamErr;

  const excluded = (allTeams ?? [])
    .filter((t) => t.is_test)
    .map((t) => ({ id: t.id, name: t.display_name?.trim() || t.name, section: t.section }));
  const teams = (allTeams ?? []).filter((t) => teamId ? true : !t.is_test);
  const ids = teams.map((t) => t.id);
  if (!ids.length) return { assessments: [], excluded, generatedAt };

  const [
    { data: members },
    { data: focus },
    { data: proposals },
    { data: agreements },
    { data: norms },
    { data: proofs },
    { data: statuses },
    { data: submissions },
  ] = await Promise.all([
    supabaseAdmin.from("team_members").select("team_id, user_id, job_title").in("team_id", ids),
    supabaseAdmin
      .from("company_focus")
      .select(
        "team_id, company_name, industry, contact_person, contact_job_title, email, website, employee_count, hq_address, updated_at",
      )
      .in("team_id", ids),
    supabaseAdmin
      .from("team_meeting_proposals")
      .select("id, team_id, day_of_week, meeting_time, location, meeting_mode")
      .in("team_id", ids),
    supabaseAdmin.from("team_meeting_agreements").select("team_id, proposal_id, user_id, status").in("team_id", ids),
    supabaseAdmin
      .from("group_norms")
      .select("id, team_id, version, content, uploaded_at, updated_at")
      .in("team_id", ids),
    supabaseAdmin
      .from("proof_submissions")
      .select("team_id, user_id, proof_key, submitted_at, feedback, feedback_status, review_status, score")
      .in("team_id", ids),
    supabaseAdmin
      .from("team_requirement_status")
      .select("team_id, requirement_key, status, revision_note, submitted_at, decided_at")
      .in("team_id", ids),
    supabaseAdmin
      .from("requirement_submissions")
      .select("team_id, requirement_key, answers, submitted_at, submitted_by")
      .in("team_id", ids)
      .eq("requirement_key", CLIENT_KEY),
  ]);

  const normIds = (norms ?? []).map((n) => n.id);
  const { data: signatures } = normIds.length
    ? await supabaseAdmin
        .from("group_norms_signatures")
        .select("group_norms_id, user_id, version")
        .in("group_norms_id", normIds)
    : { data: [] as { group_norms_id: string; user_id: string; version: number }[] };

  const memberIds = [...new Set((members ?? []).map((m) => m.user_id))];
  const submitterIds = (submissions ?? []).map((s) => s.submitted_by).filter(Boolean) as string[];
  const profileIds = [...new Set([...memberIds, ...submitterIds])];
  const { data: profiles } = profileIds.length
    ? await supabaseAdmin.from("profiles").select("id, name, email").in("id", profileIds)
    : { data: [] as { id: string; name: string | null; email: string | null }[] };
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, { name: p.name, email: p.email }]));

  const by = <T extends { team_id: string | null }>(rows: T[] | null) => {
    const m = new Map<string, T[]>();
    for (const r of rows ?? []) {
      if (!r.team_id) continue;
      if (!m.has(r.team_id)) m.set(r.team_id, []);
      m.get(r.team_id)!.push(r);
    }
    return m;
  };
  const membersBy = by(members);
  const focusBy = new Map((focus ?? []).map((f) => [f.team_id, f]));
  const proposalBy = new Map((proposals ?? []).map((p) => [p.team_id, p]));
  const agreementsBy = by(agreements);
  const normsBy = new Map((norms ?? []).map((n) => [n.team_id, n]));
  const proofsBy = by(proofs);
  const statusesBy = by(statuses);
  const submissionBy = new Map((submissions ?? []).map((s) => [s.team_id, s]));
  const signaturesByNorms = new Map<string, { user_id: string; version: number }[]>();
  for (const s of signatures ?? []) {
    if (!signaturesByNorms.has(s.group_norms_id)) signaturesByNorms.set(s.group_norms_id, []);
    signaturesByNorms.get(s.group_norms_id)!.push({ user_id: s.user_id, version: s.version });
  }

  const assessments = teams.map((team) => {
    const proposal = proposalBy.get(team.id) ?? null;
    const normRow = normsBy.get(team.id) ?? null;
    const teamStatuses = statusesBy.get(team.id) ?? [];
    const sub = submissionBy.get(team.id) ?? null;
    const answers: Record<string, string> = {};
    if (sub?.answers && typeof sub.answers === "object" && !Array.isArray(sub.answers)) {
      for (const [k, v] of Object.entries(sub.answers as Record<string, unknown>)) {
        if (typeof v === "string") answers[k] = v;
      }
    }

    const input: AssessmentInput = {
      team,
      members: (membersBy.get(team.id) ?? []).map((m) => ({ user_id: m.user_id, job_title: m.job_title })),
      profiles: profileMap,
      companyFocus: focusBy.get(team.id) ?? null,
      clientSubmission: sub
        ? { answers, submitted_at: sub.submitted_at, submitted_by: sub.submitted_by }
        : null,
      clientStatus: teamStatuses.find((s) => s.requirement_key === CLIENT_KEY) ?? null,
      setupStatus: teamStatuses.find((s) => s.requirement_key === SETUP_KEY) ?? null,
      proposal,
      agreements: (agreementsBy.get(team.id) ?? [])
        .filter((a) => !proposal || a.proposal_id === proposal.id)
        .map((a) => ({ user_id: a.user_id, status: a.status })),
      norms: normRow
        ? {
            version: normRow.version,
            content: normRow.content,
            uploaded_at: normRow.uploaded_at,
            updated_at: normRow.updated_at,
          }
        : null,
      normsSignatures: normRow ? signaturesByNorms.get(normRow.id) ?? [] : [],
      proofSubmissions: (proofsBy.get(team.id) ?? []).map((p) => ({
        user_id: p.user_id,
        proof_key: p.proof_key,
        submitted_at: p.submitted_at,
        feedback: p.feedback,
        feedback_status: p.feedback_status,
        review_status: p.review_status,
      })),
      generatedAt,
    };
    return assessTeam(input);
  });

  return { assessments, excluded, generatedAt };
}

/** Admin-only: every non-test team, summarised. Powers the list and the Teams indicators. */
export const getReadinessAssessments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { assessments, excluded, generatedAt } = await buildAssessments();
    return {
      generatedAt,
      excluded,
      totals: {
        teams: assessments.length,
        green: assessments.filter((a) => a.color === "green").length,
        yellow: assessments.filter((a) => a.color === "yellow").length,
        red: assessments.filter((a) => a.color === "red").length,
      },
      sections: [...new Set(assessments.map((a) => a.section).filter(Boolean))] as string[],
      teams: assessments,
    };
  });

/** Admin-only: the full detail report for one team. Same calculation as the list. */
export const getTeamReadinessAssessment = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { teamId: string }) => {
    if (!input?.teamId) throw new Error("Missing team.");
    return input;
  })
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { assessments, generatedAt } = await buildAssessments(data.teamId);
    const assessment = assessments[0];
    if (!assessment) throw new Error("Team not found.");
    return { generatedAt, assessment };
  });
