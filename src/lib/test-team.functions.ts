import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Practice ("test") team support.
 *
 * The fixture team is flagged with teams.is_test, which keeps it out of class
 * statistics and every automated email. Placeholder teammates use
 * non-deliverable @example.invalid addresses so nothing can ever be sent to a
 * real person. Passwords are random and are never returned to the caller.
 */

export const TEST_PM_EMAIL = "paul@paulhillman.com";

const PLACEHOLDERS: { name: string; email: string; job: string }[] = [
  { name: "Keith Dierking", email: "keith.dierking.test@example.invalid", job: "Communication Specialist" },
  { name: "Mark Becker", email: "mark.becker.test@example.invalid", job: "Company Liaison" },
  { name: "David Tappan", email: "david.tappan.test@example.invalid", job: "Client Vault & Tech Administrator" },
  { name: "Julie Boudro", email: "julie.boudro.test@example.invalid", job: "Video Specialist" },
];

function randomSecret() {
  return `${crypto.randomUUID()}${crypto.randomUUID()}`;
}

async function requireAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (data !== true) throw new Error("Forbidden: admin only.");
}

/** Create/repair the placeholder teammates on a test team. Admin only. */
export const seedTestTeamMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { teamId: string }) => {
    if (!input?.teamId) throw new Error("Missing team.");
    return input;
  })
  .handler(async ({ data, context }) => {
    await requireAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: team } = await supabaseAdmin
      .from("teams")
      .select("id, is_test, section")
      .eq("id", data.teamId)
      .maybeSingle();
    if (!team) throw new Error("Team not found.");
    if (!(team as { is_test?: boolean }).is_test) throw new Error("Not a test team.");

    const report: { email: string; status: string }[] = [];

    for (const p of PLACEHOLDERS) {
      let userId: string | null = null;

      const { data: existing } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .ilike("email", p.email)
        .maybeSingle();

      if (existing) {
        userId = existing.id;
        report.push({ email: p.email, status: "reused" });
      } else {
        const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
          email: p.email,
          password: randomSecret(),
          email_confirm: true,
          user_metadata: { name: p.name, test_fixture: true },
        });
        if (error || !created?.user) {
          report.push({ email: p.email, status: `failed: ${error?.message ?? "unknown"}` });
          continue;
        }
        userId = created.user.id;
        report.push({ email: p.email, status: "created" });
      }

      if (!userId) continue;

      await supabaseAdmin
        .from("profiles")
        .update({ name: p.name, section: team.section ?? null })
        .eq("id", userId);

      // Never move a real membership: only touch this fixture account.
      const { data: mem } = await supabaseAdmin
        .from("team_members")
        .select("id, team_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (!mem) {
        await supabaseAdmin
          .from("team_members")
          .insert({ team_id: data.teamId, user_id: userId, job_title: p.job as never });
      } else if (mem.team_id === data.teamId) {
        await supabaseAdmin
          .from("team_members")
          .update({ job_title: p.job as never })
          .eq("id", mem.id);
      }
    }

    return { report };
  });

/**
 * The professor's own practice account joins the test team as PM.
 * Identity comes from the signed-in token; only the designated test email
 * qualifies, and no admin privilege is granted.
 */
export const claimTestPmSeat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, claims } = context as { userId: string; claims: { email?: string } };
    const email = (claims?.email ?? "").toLowerCase();
    if (email !== TEST_PM_EMAIL) throw new Error("This practice seat is reserved for another account.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: team } = await supabaseAdmin
      .from("teams")
      .select("id, name, section, display_name")
      .eq("is_test", true)
      .eq("name", "Team 8")
      .eq("section", "05")
      .maybeSingle();
    if (!team) throw new Error("The practice team has not been set up yet.");

    const { data: mem } = await supabaseAdmin
      .from("team_members")
      .select("id, team_id, job_title")
      .eq("user_id", userId)
      .maybeSingle();

    if (mem && mem.team_id !== team.id) {
      throw new Error("This account already belongs to another team; nothing was changed.");
    }

    const { data: pm } = await supabaseAdmin
      .from("team_members")
      .select("user_id")
      .eq("team_id", team.id)
      .eq("job_title", "PM")
      .maybeSingle();
    if (pm && pm.user_id !== userId) throw new Error("The practice team already has a PM.");

    if (!mem) {
      const { error } = await supabaseAdmin
        .from("team_members")
        .insert({ team_id: team.id, user_id: userId, job_title: "PM" as never });
      if (error) throw error;
    } else if (mem.job_title !== "PM") {
      await supabaseAdmin.from("team_members").update({ job_title: "PM" as never }).eq("id", mem.id);
    }

    await supabaseAdmin
      .from("profiles")
      .update({ name: "Parfunkel Hillman", first_name: "Parfunkel", last_name: "Hillman", section: "05" })
      .eq("id", userId);

    return { teamId: team.id };
  });
