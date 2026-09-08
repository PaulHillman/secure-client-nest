import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { completionStatus } from "@/lib/profile-completion";

const SELECTABLE = [
  "PM",
  "Communication Specialist",
  "Video Specialist",
  "Company Liaison",
  "Client Vault & Tech Administrator",
];

/** What the signed-in student may pick right now, and who already holds what. */
export const getRoleOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: membership } = await supabase
      .from("team_members")
      .select("id, team_id, job_title")
      .eq("user_id", userId)
      .maybeSingle();

    const [{ data: profile }, { data: avail }] = await Promise.all([
      supabase.from("profiles").select("skills_have, skills_learn").eq("id", userId).maybeSingle(),
      supabase.from("student_availability").select("user_id").eq("user_id", userId).maybeSingle(),
    ]);

    const status = completionStatus({
      skillsHave: profile?.skills_have,
      skillsLearn: profile?.skills_learn,
      hasAvailability: !!avail,
    });

    let taken: { role: string; name: string }[] = [];
    if (membership?.team_id) {
      const { data: mates } = await supabase
        .from("team_members")
        .select("user_id, job_title")
        .eq("team_id", membership.team_id);
      const others = (mates ?? []).filter(
        (m) => m.user_id !== userId && SELECTABLE.includes(m.job_title as string),
      );
      if (others.length) {
        const { data: names } = await supabase
          .from("profiles")
          .select("id, name")
          .in(
            "id",
            others.map((o) => o.user_id),
          );
        const nameById = new Map((names ?? []).map((n) => [n.id, n.name]));
        taken = others.map((o) => ({
          role: o.job_title as string,
          name: nameById.get(o.user_id) ?? "A teammate",
        }));
      }
    }

    return {
      hasTeam: !!membership,
      currentRole: (membership?.job_title as string) ?? null,
      canSelect: status.complete,
      missing: status.missing,
      taken,
    };
  });

/** Claim a role. Blocked until the profile is complete; one holder per role per team. */
export const claimTeamRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { role: string }) => {
    if (!SELECTABLE.includes(input.role)) throw new Error("That is not a selectable role.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: membership } = await supabase
      .from("team_members")
      .select("id, team_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership) throw new Error("You are not on a team yet.");

    const [{ data: profile }, { data: avail }] = await Promise.all([
      supabase.from("profiles").select("skills_have, skills_learn").eq("id", userId).maybeSingle(),
      supabase.from("student_availability").select("user_id").eq("user_id", userId).maybeSingle(),
    ]);
    const status = completionStatus({
      skillsHave: profile?.skills_have,
      skillsLearn: profile?.skills_learn,
      hasAvailability: !!avail,
    });
    if (!status.complete) {
      throw new Error(`Finish your profile first — still missing: ${status.missing.join(", ")}.`);
    }

    const { data: mates } = await supabase
      .from("team_members")
      .select("user_id, job_title")
      .eq("team_id", membership.team_id);
    const clash = (mates ?? []).find((m) => m.user_id !== userId && m.job_title === data.role);
    if (clash) throw new Error(`${data.role} is already taken on your team.`);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("team_members")
      .update({ job_title: data.role as never })
      .eq("id", membership.id);
    if (error) throw error;

    return { role: data.role };
  });
