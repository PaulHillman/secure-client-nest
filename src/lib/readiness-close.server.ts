import { isPastDue } from "@/lib/readiness";

/* eslint-disable @typescript-eslint/no-explicit-any */
type DbLike = { from: (table: string) => any };

/**
 * A module is closed for a team once the due date set for their section has
 * passed. Closed modules stay readable but can no longer be changed.
 */
export async function moduleIsClosed(dbIn: unknown, teamId: string, key: string) {
  const db = dbIn as DbLike;
  const { data: team } = await db.from("teams").select("section").eq("id", teamId).maybeSingle();
  const section = (team as { section?: string | null } | null)?.section ?? "";
  const { data: opening } = await db
    .from("requirement_openings")
    .select("due_at")
    .eq("requirement_key", key)
    .eq("section", section)
    .maybeSingle();
  if (!opening) return false;
  return isPastDue((opening as { due_at: string | null }).due_at);
}
