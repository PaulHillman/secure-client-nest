// Server-only helpers for the weekly vault digest (uploads + inactive members).
import type { SupabaseClient } from "@supabase/supabase-js";

export const VAULT_ADMIN_JOB = "Client Vault & Tech Administrator";

export type TeamDigest = {
  teamId: string;
  teamLabel: string;
  recipientIds: string[];
  uploads: { fileName: string; section: string | null; at: string }[];
  inactive: { userId: string; name: string }[];
  message: string;
};

function fmt(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Build one digest per team for the last 7 days. */
export async function buildWeeklyDigests(supabaseAdmin: SupabaseClient): Promise<TeamDigest[]> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const sinceIso = since.toISOString();

  const [teamsRes, membersRes, profilesRes, uploadsRes, loginsRes] = await Promise.all([
    supabaseAdmin.from("teams").select("id, name, display_name, section"),
    supabaseAdmin.from("team_members").select("team_id, user_id, job_title"),
    supabaseAdmin.from("profiles").select("id, name, email"),
    supabaseAdmin
      .from("file_audit_log")
      .select("team_id, file_name, section, created_at, action")
      .eq("action", "insert")
      .gte("created_at", sinceIso),
    supabaseAdmin.from("auth_audit_log").select("user_id, created_at").gte("created_at", sinceIso),
  ]);
  for (const r of [teamsRes, membersRes, profilesRes, uploadsRes, loginsRes]) {
    if (r.error) throw r.error;
  }

  const teams = teamsRes.data ?? [];
  const members = membersRes.data ?? [];
  const nameById = new Map((profilesRes.data ?? []).map((p: any) => [p.id, p.name || p.email || "A teammate"]));
  const activeUsers = new Set((loginsRes.data ?? []).map((l: any) => l.user_id));

  const uploadsByTeam = new Map<string, { fileName: string; section: string | null; at: string }[]>();
  for (const u of (uploadsRes.data ?? []) as any[]) {
    if (!u.team_id) continue;
    uploadsByTeam.set(u.team_id, [
      ...(uploadsByTeam.get(u.team_id) ?? []),
      { fileName: u.file_name ?? "Untitled file", section: u.section ?? null, at: u.created_at },
    ]);
  }

  const digests: TeamDigest[] = [];
  for (const t of teams as any[]) {
    const teamMembers = members.filter((m: any) => m.team_id === t.id);
    if (teamMembers.length === 0) continue;

    const label = `${t.display_name || t.name}${t.section ? ` (Section ${t.section})` : ""}`;
    const uploads = uploadsByTeam.get(t.id) ?? [];
    const inactive = teamMembers
      .filter((m: any) => !activeUsers.has(m.user_id))
      .map((m: any) => ({ userId: m.user_id, name: nameById.get(m.user_id) ?? "A teammate" }));

    const vaultAdmins = teamMembers.filter((m: any) => m.job_title === VAULT_ADMIN_JOB).map((m: any) => m.user_id);
    const pms = teamMembers.filter((m: any) => m.job_title === "PM").map((m: any) => m.user_id);
    const recipientIds = Array.from(new Set(vaultAdmins.length ? vaultAdmins : pms));

    const parts = [
      `Week of ${fmt(since)}–${fmt(new Date())} for ${label}:`,
      uploads.length
        ? `${uploads.length} file${uploads.length === 1 ? "" : "s"} uploaded — check each is in the right place, clearly labelled and visible to everyone.`
        : "No files were uploaded to the vault this week.",
      inactive.length
        ? `Not signed in this week: ${inactive.map((i) => i.name).join(", ")}.`
        : "Everyone signed in this week.",
    ];

    digests.push({
      teamId: t.id,
      teamLabel: label,
      recipientIds,
      uploads,
      inactive,
      message: parts.join(" "),
    });
  }
  return digests;
}

/** Build the digests and deliver them as in-app notifications. */
export async function runWeeklyDigest(supabaseAdmin: SupabaseClient) {
  const digests = await buildWeeklyDigests(supabaseAdmin);

  const { data: admins } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin");
  const adminIds = (admins ?? []).map((a: any) => a.user_id);

  const rows: {
    user_id: string;
    team_id: string;
    kind: string;
    message: string;
  }[] = [];

  for (const d of digests) {
    for (const user_id of new Set([...d.recipientIds, ...adminIds])) {
      rows.push({ user_id, team_id: d.teamId, kind: "weekly_digest", message: d.message });
    }
  }

  if (rows.length) {
    const { error } = await supabaseAdmin.from("notifications").insert(rows);
    if (error) throw error;
  }

  return {
    teams: digests.length,
    notifications: rows.length,
    inactiveTotal: digests.reduce((n, d) => n + d.inactive.length, 0),
    uploadsTotal: digests.reduce((n, d) => n + d.uploads.length, 0),
  };
}
