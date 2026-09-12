import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { missingRequired, moduleForm } from "@/lib/modules";

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

type Answers = Record<string, string>;

function asAnswers(value: unknown): Answers {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Answers = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

/** The team's answer sheet for one module, plus its current state. */
export const getModuleSubmission = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { teamId: string; key: string }) => {
    if (!input?.teamId || !input?.key) throw new Error("Missing team or module.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const admin = await isAdmin(supabase, userId);

    const { data: membership } = await supabase
      .from("team_members")
      .select("job_title")
      .eq("team_id", data.teamId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership && !admin) throw new Error("You are not on this team.");

    const [{ data: row }, { data: status }, { data: submitter }] = await Promise.all([
      supabase
        .from("requirement_submissions")
        .select("*")
        .eq("team_id", data.teamId)
        .eq("requirement_key", data.key)
        .maybeSingle(),
      supabase
        .from("team_requirement_status")
        .select("status, revision_note, submitted_at")
        .eq("team_id", data.teamId)
        .eq("requirement_key", data.key)
        .maybeSingle(),
      Promise.resolve({ data: null as { name: string } | null }),
    ]);

    let submittedByName: string | null = null;
    if (row?.submitted_by) {
      const { data: p } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", row.submitted_by)
        .maybeSingle();
      submittedByName = p?.name ?? null;
    }
    void submitter;

    return {
      answers: asAnswers(row?.answers),
      submittedAt: row?.submitted_at ?? null,
      submittedByName,
      submitCount: row?.submit_count ?? 0,
      status: status?.status ?? "not_started",
      revisionNote: status?.revision_note ?? null,
      isPM: membership?.job_title === "PM",
      isAdmin: admin,
    };
  });

/** Save a draft, or submit it for the professor to review. */
export const saveModuleSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { teamId: string; key: string; answers: Record<string, string>; submit: boolean }) => {
    if (!input?.teamId || !input?.key) throw new Error("Missing team or module.");
    if (!moduleForm(input.key)) throw new Error("Unknown module.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const admin = await isAdmin(supabase, userId);

    const { data: membership } = await supabase
      .from("team_members")
      .select("job_title")
      .eq("team_id", data.teamId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership && !admin) throw new Error("You are not on this team.");

    const { data: current } = await supabase
      .from("team_requirement_status")
      .select("status")
      .eq("team_id", data.teamId)
      .eq("requirement_key", data.key)
      .maybeSingle();
    if (current?.status === "approved" && !admin) {
      throw new Error("This module has been approved and can no longer be changed.");
    }

    const answers = asAnswers(data.answers);

    if (data.submit) {
      const missing = missingRequired(data.key, answers);
      if (missing.length) throw new Error(`Still needed: ${missing.join(", ")}.`);

      if (data.key === "team_setup") {
        const { data: members } = await supabase
          .from("team_members")
          .select("job_title")
          .eq("team_id", data.teamId);
        if ((members ?? []).some((m) => !m.job_title || m.job_title === "Unassigned")) {
          throw new Error("Every member needs a role before team setup can be submitted.");
        }
      }
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("requirement_submissions")
      .select("submit_count")
      .eq("team_id", data.teamId)
      .eq("requirement_key", data.key)
      .maybeSingle();

    const now = new Date().toISOString();
    const { error } = await supabaseAdmin.from("requirement_submissions").upsert(
      {
        team_id: data.teamId,
        requirement_key: data.key,
        answers,
        updated_by: userId,
        ...(data.submit
          ? {
              submitted_by: userId,
              submitted_at: now,
              submit_count: (existing?.submit_count ?? 0) + 1,
            }
          : {}),
      },
      { onConflict: "team_id,requirement_key" },
    );
    if (error) throw error;

    if (data.submit) {
      const { error: statusError } = await supabaseAdmin.from("team_requirement_status").upsert(
        {
          team_id: data.teamId,
          requirement_key: data.key,
          status: "submitted",
          revision_note: null,
          submitted_at: now,
          updated_by: userId,
        },
        { onConflict: "team_id,requirement_key" },
      );
      if (statusError) throw statusError;
    } else if (!current || current.status === "not_started") {
      await supabaseAdmin.from("team_requirement_status").upsert(
        {
          team_id: data.teamId,
          requirement_key: data.key,
          status: "in_progress",
          updated_by: userId,
        },
        { onConflict: "team_id,requirement_key" },
      );
    }

    return { ok: true, submitted: data.submit };
  });

/** Professor's review queue: every submitted module waiting on a decision. */
export const getSubmissionQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: statuses } = await supabaseAdmin
      .from("team_requirement_status")
      .select("team_id, requirement_key, status, submitted_at")
      .eq("status", "submitted")
      .order("submitted_at");

    if (!statuses?.length) return { items: [] };

    const teamIds = [...new Set(statuses.map((s) => s.team_id))];
    const [{ data: teams }, { data: subs }, { data: reqs }] = await Promise.all([
      supabaseAdmin.from("teams").select("id, name, display_name, section").in("id", teamIds),
      supabaseAdmin.from("requirement_submissions").select("*").in("team_id", teamIds),
      supabaseAdmin.from("project_requirements").select("key, title"),
    ]);

    const teamById = new Map((teams ?? []).map((t) => [t.id, t]));
    const titleByKey = new Map((reqs ?? []).map((r) => [r.key, r.title]));
    const subByPair = new Map(
      (subs ?? []).map((s) => [`${s.team_id}|${s.requirement_key}`, s]),
    );

    const submitterIds = [
      ...new Set((subs ?? []).map((s) => s.submitted_by).filter(Boolean) as string[]),
    ];
    const { data: profiles } = submitterIds.length
      ? await supabaseAdmin.from("profiles").select("id, name").in("id", submitterIds)
      : { data: [] as { id: string; name: string }[] };
    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.name]));

    return {
      items: statuses
        .filter((s) => teamById.has(s.team_id))
        .map((s) => {
          const sub = subByPair.get(`${s.team_id}|${s.requirement_key}`);
          return {
            teamId: s.team_id,
            team: teamById.get(s.team_id)!,
            key: s.requirement_key,
            title: titleByKey.get(s.requirement_key) ?? s.requirement_key,
            submittedAt: s.submitted_at ?? sub?.submitted_at ?? null,
            submittedByName: sub?.submitted_by ? nameById.get(sub.submitted_by) ?? null : null,
            submitCount: sub?.submit_count ?? 0,
            answers: asAnswers(sub?.answers),
          };
        }),
    };
  });
