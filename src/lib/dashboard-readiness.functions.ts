import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isNormsComplete, normalizeNorms } from "@/lib/group-norms";
import { proofsForRole } from "@/lib/proofs";
import { roleStudy } from "@/lib/role-study";
import { teamLabel } from "@/lib/team-label";

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

export const getDashboardReadiness = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input?: { studentId?: string }) => input ?? {})
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const targetUserId = data.studentId ?? userId;

    if (targetUserId !== userId && !(await isAdmin(supabase, userId))) {
      throw new Error("You cannot view another student's readiness.");
    }

    const { data: memberships, error: membershipError } = await supabase
      .from("team_members")
      .select("team_id, job_title, teams(id, name, display_name, section)")
      .eq("user_id", targetUserId)
      .limit(1);
    if (membershipError) throw membershipError;

    const membership = memberships?.[0];
    const team = membership?.teams;
    if (!membership || !team) return null;

    const teamId = membership.team_id;
    const role = membership.job_title;
    const [{ count: memberCount }, { data: submissions }, { data: proposal }, { data: norms }] =
      await Promise.all([
        supabase
          .from("team_members")
          .select("id", { count: "exact", head: true })
          .eq("team_id", teamId),
        supabase
          .from("proof_submissions")
          .select("proof_key")
          .eq("team_id", teamId)
          .eq("user_id", targetUserId),
        supabase
          .from("team_meeting_proposals")
          .select("id")
          .eq("team_id", teamId)
          .maybeSingle(),
        supabase
          .from("group_norms")
          .select("id, version, content")
          .eq("team_id", teamId)
          .maybeSingle(),
      ]);

    const assignedProofs = proofsForRole(role).filter(
      (proof) => proof.role !== "Researcher" || (memberCount ?? 0) >= 6,
    );
    const submittedKeys = new Set((submissions ?? []).map((row) => row.proof_key));
    const remainingProofs = assignedProofs.filter((proof) => !submittedKeys.has(proof.key));

    const [{ data: agreement }, { data: approval }, { data: studyRow }] = await Promise.all([
      proposal
        ? supabase
            .from("team_meeting_agreements")
            .select("status")
            .eq("proposal_id", proposal.id)
            .eq("user_id", targetUserId)
            .maybeSingle()
        : Promise.resolve({ data: null as { status: string } | null }),
      Promise.resolve({ data: null as { signed_at: string } | null }),
      norms
        ? supabase
            .from("group_norms_signatures")
            .select("signed_at")
            .eq("group_norms_id", norms.id)
            .eq("version", norms.version)
            .eq("user_id", targetUserId)
            .maybeSingle()
        : Promise.resolve({ data: null as { signed_at: string } | null }),
    ]);

    const hasRole = !!role && role !== "Unassigned";
    const proofsDone = assignedProofs.length > 0 && remainingProofs.length === 0;
    const meetingDone = agreement?.status === "agreed";
    const normsComplete = !!norms && isNormsComplete(normalizeNorms(norms.content));
    const normsDone = normsComplete && !!approval;
    const steps = [hasRole, proofsDone, meetingDone, normsDone];
    const doneCount = steps.filter(Boolean).length;

    let nextAction = "Choose your team role";
    let detail = "Choose your role so ClientVault can show the activities required for your job.";
    if (hasRole && !proofsDone) {
      nextAction = "Complete your role proof points";
      detail = remainingProofs.length
        ? `${remainingProofs.length} role ${remainingProofs.length === 1 ? "activity remains" : "activities remain"}.`
        : "Review the activities assigned to your role.";
    } else if (hasRole && proofsDone && !meetingDone) {
      nextAction = proposal ? "Confirm your meeting commitment" : "Set your team meeting time";
      detail = proposal
        ? "Read the proposed standing meeting time and record your agreement."
        : "Your team still needs to establish its standing meeting time.";
    } else if (hasRole && proofsDone && meetingDone && !normsDone) {
      nextAction = normsComplete ? "Approve your Group Norms" : "Complete your Group Norms";
      detail = normsComplete
        ? "Read the saved norms and approve the current version personally."
        : "Work with your team to finish the Group Norms document, then approve it personally.";
    }

    return {
      teamId,
      teamName: teamLabel(team),
      doneCount,
      complete: doneCount === 4,
      nextAction,
      detail,
    };
  });