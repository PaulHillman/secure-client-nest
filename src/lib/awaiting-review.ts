import { supabase } from "@/integrations/supabase/client";
import { teamPrimaryName } from "@/lib/team-label";

export type AwaitingRequirement = {
  id: string;
  teamId: string;
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
      .select("id, team_id, manager_first_name, manager_last_name, company_name, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    // Third attempt still below 8 — requires the instructor meeting decision.
    supabase
      .from("peer_review_assessments")
      .select("id, team_id, user_id, attempt, score, created_at")
      .gte("attempt", 3)
      .lt("score", 8)
      .order("created_at", { ascending: true }),
    supabase.from("teams").select("id, name, display_name, section"),
    supabase.from("project_requirements").select("key, title"),
    supabase.from("profiles").select("id, name, first_name, last_name"),
  ]);
  if (reqRes.error) throw reqRes.error;
  if (mgrRes.error) throw mgrRes.error;
  if (peerRes.error) throw peerRes.error;
  if (teamsRes.error) throw teamsRes.error;
  if (reqDefsRes.error) throw reqDefsRes.error;
  if (profilesRes.error) throw profilesRes.error;

  const teamName = new Map((teamsRes.data ?? []).map((t) => [t.id, teamPrimaryName(t)]));
  const reqTitle = new Map((reqDefsRes.data ?? []).map((r) => [r.key, r.title]));
  const personName = new Map(
    (profilesRes.data ?? []).map((p) => [
      p.id,
      p.first_name && p.last_name ? `${p.first_name} ${p.last_name}` : p.name,
    ]),
  );

  const requirements: AwaitingRequirement[] = (reqRes.data ?? []).map((r) => ({
    id: r.id,
    teamId: r.team_id,
    teamName: teamName.get(r.team_id) ?? "Unknown team",
    requirementTitle: reqTitle.get(r.requirement_key) ?? r.requirement_key,
    submittedAt: r.submitted_at,
  }));
  const managers: AwaitingManager[] = (mgrRes.data ?? []).map((m) => ({
    id: m.id,
    teamId: m.team_id,
    teamName: teamName.get(m.team_id) ?? "Unknown team",
    managerName: `${m.manager_first_name} ${m.manager_last_name}`.trim(),
    companyName: m.company_name,
    createdAt: m.created_at,
  }));
  const peerDecisions: AwaitingPeerDecision[] = (peerRes.data ?? []).map((p) => ({
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
