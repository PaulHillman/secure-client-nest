import { supabase } from "@/integrations/supabase/client";
import { teamPrimaryName } from "@/lib/team-label";

export type AwaitingRequirement = {
  id: string;
  teamId: string;
  requirementKey: string;
  teamName: string;
  requirementTitle: string;
  submittedAt: string | null;
};

export type AwaitingManager = {
  id: string;
  teamId: string;
  teamName: string;
  managerName: string;
  companyName: string;
  companyWebsite: string | null;
  industry: string | null;
  numEmployees: number | null;
  createdAt: string;
};

export type AwaitingPeerDecision = {
  id: string;
  teamId: string;
  teamName: string;
  studentName: string;
  attempt: number;
  score: number | null;
  createdAt: string;
};

export type AwaitingReview = {
  requirements: AwaitingRequirement[];
  managers: AwaitingManager[];
  peerDecisions: AwaitingPeerDecision[];
  total: number;
};

type TeamRow = {
  id: string;
  name: string;
  display_name: string | null;
  section: string | null;
  is_test?: boolean | null;
};

type ReqStatusRow = {
  id: string;
  team_id: string;
  requirement_key: string;
  submitted_at: string | null;
};

type ManagerRow = {
  id: string;
  team_id: string;
  manager_first_name: string | null;
  manager_last_name: string | null;
  company_name: string | null;
  company_website?: string | null;
  industry?: string | null;
  num_employees?: number | null;
  created_at: string;
};

type PeerRow = {
  id: string;
  team_id: string;
  user_id: string;
  attempt: number;
  score: number | null;
  created_at: string;
};

type ProfileRow = {
  id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
};

/**
 * Pure assembly of the queue. Test teams (teams.is_test — e.g. C/D/H Consulting)
 * are placeholder fixtures, so nothing from them belongs in the instructor's queue.
 */
export function assembleAwaitingReview(input: {
  reqStatuses: ReqStatusRow[];
  managerSubmissions: ManagerRow[];
  peerAssessments: PeerRow[];
  teams: TeamRow[];
  requirementDefs: { key: string; title: string }[];
  profiles: ProfileRow[];
}): AwaitingReview {
  const { reqStatuses, managerSubmissions, peerAssessments, teams, requirementDefs, profiles } =
    input;

  const testTeamIds = new Set(teams.filter((t) => t.is_test === true).map((t) => t.id));
  const teamName = new Map(teams.map((t) => [t.id, teamPrimaryName(t)]));
  const reqTitle = new Map(requirementDefs.map((r) => [r.key, r.title]));
  const personName = new Map(
    profiles.map((p) => [
      p.id,
      p.first_name && p.last_name ? `${p.first_name} ${p.last_name}` : (p.name ?? "Unknown student"),
    ]),
  );

  const requirements: AwaitingRequirement[] = reqStatuses
    .filter((r) => !testTeamIds.has(r.team_id))
    .map((r) => ({
      id: r.id,
      teamId: r.team_id,
      requirementKey: r.requirement_key,
      teamName: teamName.get(r.team_id) ?? "Unknown team",
      requirementTitle: reqTitle.get(r.requirement_key) ?? r.requirement_key,
      submittedAt: r.submitted_at,
    }));
  const managers: AwaitingManager[] = managerSubmissions
    .filter((m) => !testTeamIds.has(m.team_id))
    .map((m) => ({
      id: m.id,
      teamId: m.team_id,
      teamName: teamName.get(m.team_id) ?? "Unknown team",
      managerName: `${m.manager_first_name ?? ""} ${m.manager_last_name ?? ""}`.trim(),
      companyName: m.company_name ?? "",
      companyWebsite: m.company_website ?? null,
      industry: m.industry ?? null,
      numEmployees: m.num_employees ?? null,
      createdAt: m.created_at,
    }));
  const peerDecisions: AwaitingPeerDecision[] = peerAssessments
    .filter((p) => !testTeamIds.has(p.team_id))
    .map((p) => ({
      id: p.id,
      teamId: p.team_id,
      teamName: teamName.get(p.team_id) ?? "Unknown team",
      studentName: personName.get(p.user_id) ?? "Unknown student",
      attempt: p.attempt,
      score: p.score,
      createdAt: p.created_at,
    }));

  return {
    requirements,
    managers,
    peerDecisions,
    total: requirements.length + managers.length + peerDecisions.length,
  };
}

/** Everything waiting on the instructor, oldest first. Admin-only data (RLS). */
export async function fetchAwaitingReview(): Promise<AwaitingReview> {
  const [reqRes, mgrRes, peerRes, teamsRes, reqDefsRes, profilesRes] = await Promise.all([
    supabase
      .from("team_requirement_status")
      .select("id, team_id, requirement_key, submitted_at")
      .eq("status", "submitted")
      .order("submitted_at", { ascending: true }),
    supabase
      .from("manager_submissions")
      .select(
        "id, team_id, manager_first_name, manager_last_name, company_name, company_website, industry, num_employees, created_at",
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    // Third attempt still below 8 — requires the instructor meeting decision.
    supabase
      .from("peer_review_assessments")
      .select("id, team_id, user_id, attempt, score, created_at")
      .gte("attempt", 3)
      .lt("score", 8)
      .order("created_at", { ascending: true }),
    supabase.from("teams").select("id, name, display_name, section, is_test"),
    supabase.from("project_requirements").select("key, title"),
    supabase.from("profiles").select("id, name, first_name, last_name"),
  ]);
  if (reqRes.error) throw reqRes.error;
  if (mgrRes.error) throw mgrRes.error;
  if (peerRes.error) throw peerRes.error;
  if (teamsRes.error) throw teamsRes.error;
  if (reqDefsRes.error) throw reqDefsRes.error;
  if (profilesRes.error) throw profilesRes.error;

  return assembleAwaitingReview({
    reqStatuses: reqRes.data ?? [],
    managerSubmissions: mgrRes.data ?? [],
    peerAssessments: peerRes.data ?? [],
    teams: teamsRes.data ?? [],
    requirementDefs: reqDefsRes.data ?? [],
    profiles: profilesRes.data ?? [],
  });
}
