import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { roleStudy } from "@/lib/role-study";

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

type ProgressRow = { role: string; checked: number[] };

async function readProgress(
  db: { from: (t: string) => any },
  userId: string,
): Promise<ProgressRow | null> {
  const { data } = await db
    .from("role_study_progress")
    .select("role, checked")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as ProgressRow | null) ?? null;
}

/** The student's ticked checklist items for their current role. */
export const getRoleStudy = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input?: { studentId?: string }) => input ?? {})
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const targetUserId = data.studentId ?? userId;
    const admin = await isAdmin(supabase, userId);
    if (targetUserId !== userId && !admin) {
      throw new Error("You cannot view another student's checklist.");
    }

    const db =
      targetUserId === userId
        ? supabase
        : ((await import("@/integrations/supabase/client.server")).supabaseAdmin as any);
    const row = await readProgress(db, targetUserId);

    const { data: membership } = await db
      .from("team_members")
      .select("job_title")
      .eq("user_id", targetUserId)
      .limit(1)
      .maybeSingle();
    const role = (membership?.job_title as string | null) ?? null;
    const study = roleStudy(role);

    // A saved list only counts while the student still holds that role.
    const checked = study && row?.role === study.role ? (row.checked ?? []) : [];
    return { role, itemCount: study?.items.length ?? 0, checked, done: !!study && checked.length >= study.items.length };
  });

/** Tick or untick one checklist item. Ticking every item finishes Step 1. */
export const toggleRoleStudyItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { teamId: string; index: number; checked: boolean; studentId?: string }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const targetUserId = data.studentId ?? userId;
    const admin = await isAdmin(supabase, userId);
    if (targetUserId !== userId && !admin) {
      throw new Error("You cannot change another student's checklist.");
    }

    const db =
      targetUserId === userId
        ? supabase
        : ((await import("@/integrations/supabase/client.server")).supabaseAdmin as any);

    const { data: membership } = await db
      .from("team_members")
      .select("job_title")
      .eq("team_id", data.teamId)
      .eq("user_id", targetUserId)
      .maybeSingle();
    const role = (membership?.job_title as string | null) ?? null;
    const study = roleStudy(role);
    if (!study) throw new Error("Pick a role before studying it.");
    if (!Number.isInteger(data.index) || data.index < 0 || data.index >= study.items.length) {
      throw new Error("Unknown checklist item.");
    }

    const row = await readProgress(db, targetUserId);
    const current = row?.role === study.role ? new Set(row.checked ?? []) : new Set<number>();
    if (data.checked) current.add(data.index);
    else current.delete(data.index);
    const checked = [...current].sort((a, b) => a - b);

    const { error } = await db.from("role_study_progress").upsert(
      {
        user_id: targetUserId,
        team_id: data.teamId,
        role: study.role,
        checked,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw error;

    return { checked, done: checked.length >= study.items.length };
  });
