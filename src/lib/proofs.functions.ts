import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { missingProofFields, PROOFS, proofByKey, proofsForRole } from "@/lib/proofs";

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

function asAnswers(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

/**
 * Everything the proofs panel needs for one team: the viewer's own assigned
 * activities and their state, plus every member's progress so the PM can chase.
 */
export const getTeamProofs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { teamId: string; studentId?: string }) => {
    if (!input?.teamId) throw new Error("Missing team.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const admin = await isAdmin(supabase, userId);
    const targetUserId = data.studentId ?? userId;
    if (targetUserId !== userId && !admin) {
      throw new Error("You cannot view another student's role activities.");
    }

    const { data: members } = await supabase
      .from("team_members")
      .select("user_id, job_title")
      .eq("team_id", data.teamId);
    const list = members ?? [];
    const me = list.find((m) => m.user_id === targetUserId);
    if (!me && !admin) throw new Error("You are not on this team.");

    const ids = list.map((m) => m.user_id);
    const [{ data: profiles }, { data: subs }, { data: materials }] = await Promise.all([
      ids.length
        ? supabase.from("profiles").select("id, name, avatar_url").in("id", ids)
        : Promise.resolve({ data: [] as { id: string; name: string; avatar_url: string | null }[] }),
      supabase
        .from("proof_submissions")
        .select(
          "id, user_id, proof_key, submitted_at, feedback, feedback_status, file_name, response, review_status, review_note, reviewed_at, score",
        )
        .eq("team_id", data.teamId),
      supabase.from("proof_materials").select("proof_key, ready, extra_instructions"),
    ]);

    const readiness = new Map((materials ?? []).map((m) => [m.proof_key, m]));
    const memberCount = list.length;

    const people = list.map((m) => {
      const profile = (profiles ?? []).find((p) => p.id === m.user_id);
      const assigned = proofsForRole(m.job_title)
        .filter((p) => p.role !== "Researcher" || memberCount >= 6)
        .map((p) => p.key);
      const own = (subs ?? []).filter((s) => s.user_id === m.user_id);
      const done = own.map((s) => s.proof_key);
      return {
        userId: m.user_id,
        name: profile?.name ?? "Student",
        avatarUrl: profile?.avatar_url ?? null,
        role: m.job_title,
        assigned,
        completed: assigned.filter((k) => done.includes(k)),
        approved: assigned.filter((k) =>
          own.some((s) => s.proof_key === k && s.review_status === "approved"),
        ),
        sentBack: assigned.filter((k) =>
          own.some((s) => s.proof_key === k && s.review_status === "sent_back"),
        ),
      };
    });

    const myRole = me?.job_title ?? null;
    const mine = proofsForRole(myRole)
      .filter((p) => p.role !== "Researcher" || memberCount >= 6)
      .map((p) => {
        const sub = (subs ?? []).find(
          (s) => s.user_id === targetUserId && s.proof_key === p.key,
        );
        const mat = readiness.get(p.key);
        return {
          key: p.key,
          open: !p.needsMaterials || mat?.ready === true,
          extraInstructions: mat?.extra_instructions ?? null,
          submission: sub
            ? {
                submittedAt: sub.submitted_at,
                feedback: sub.feedback,
                score: sub.score ?? null,
                feedbackStatus: sub.feedback_status,
                fileName: sub.file_name,
                answers: asAnswers(sub.response),
                reviewStatus: sub.review_status,
                reviewNote: sub.review_note,
                reviewedAt: sub.reviewed_at,
              }
            : null,
        };
      });

    return { myRole, memberCount, mine, people, isAdmin: admin };
  });

/** Signed links and text for the course material behind one activity. */
export const getProofMaterial = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { proofKey: string }) => {
    if (!proofByKey(input?.proofKey ?? "")) throw new Error("Unknown activity.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row } = await supabase
      .from("proof_materials")
      .select("*")
      .eq("proof_key", data.proofKey)
      .maybeSingle();
    if (!row) return { ready: false, audioUrl: null, zipUrl: null, transcript: null };

    const sign = async (path: string | null) => {
      if (!path) return null;
      const { data: signed } = await supabase.storage.from("proofs").createSignedUrl(path, 60 * 60);
      return signed?.signedUrl ?? null;
    };

    // The voicemail activities are listening exercises: the student hears the
    // message, they never read it. Only the minutes activity gets a transcript.
    const hidesTranscript = data.proofKey === "pm_voicemail" || data.proofKey === "liaison_voicemail";

    return {
      ready: row.ready,
      audioUrl: await sign(row.audio_path),
      zipUrl: await sign(row.zip_path),
      transcript: hidesTranscript ? null : row.transcript_text,
      extraInstructions: row.extra_instructions,
    };
  });

/**
 * Records one attempt. One per student per activity, locked immediately.
 * Feedback is attempted afterwards and can never undo the completion.
 */
export const submitProof = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      teamId: string;
      proofKey: string;
      answers: Record<string, string>;
      filePath?: string | null;
      fileName?: string | null;
      acknowledged?: boolean;
    }) => {
      if (!input?.teamId) throw new Error("Missing team.");
      const proof = proofByKey(input?.proofKey ?? "");
      if (!proof) throw new Error("Unknown activity.");
      const missing = missingProofFields(proof.key, input.answers ?? {});
      if (missing.length) throw new Error(`Please complete: ${missing.join(", ")}`);
      if (proof.requiresFile && !input.filePath) throw new Error("Please upload your file first.");
      if (proof.contactWarning && !input.acknowledged)
        throw new Error("Please tick the no-contact acknowledgement.");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const proof = proofByKey(data.proofKey)!;

    const { data: membership } = await supabase
      .from("team_members")
      .select("job_title")
      .eq("team_id", data.teamId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership) throw new Error("You are not on this team.");
    if (membership.job_title !== proof.role)
      throw new Error("This activity belongs to a different role.");

    const { data: material } = await supabase
      .from("proof_materials")
      .select("ready, transcript_text, answer_key")
      .eq("proof_key", proof.key)
      .maybeSingle();
    if (proof.needsMaterials && material?.ready !== true)
      throw new Error("Your professor has not posted the material for this activity yet.");

    // A submission the professor sent back is the one case a student may redo.
    const { data: existing } = await supabase
      .from("proof_submissions")
      .select("id, review_status, resubmit_count")
      .eq("user_id", userId)
      .eq("proof_key", proof.key)
      .maybeSingle();

    let inserted: { id: string; submitted_at: string };
    if (existing) {
      if (existing.review_status !== "sent_back")
        throw new Error("You have already submitted this activity.");
      const { data: updated, error: updateError } = await supabase
        .from("proof_submissions")
        .update({
          team_id: data.teamId,
          role_at_submission: membership.job_title,
          response: data.answers,
          file_path: data.filePath ?? null,
          file_name: data.fileName ?? null,
          submitted_at: new Date().toISOString(),
          review_status: "pending",
          review_note: null,
          reviewed_at: null,
          reviewed_by: null,
          resubmit_count: (existing.resubmit_count ?? 0) + 1,
        })
        .eq("id", existing.id)
        .select("id, submitted_at")
        .single();
      if (updateError) throw new Error(updateError.message);
      inserted = updated;
    } else {
      const { data: created, error } = await supabase
        .from("proof_submissions")
        .insert({
          user_id: userId,
          team_id: data.teamId,
          proof_key: proof.key,
          role_at_submission: membership.job_title,
          response: data.answers,
          file_path: data.filePath ?? null,
          file_name: data.fileName ?? null,
        })
        .select("id, submitted_at")
        .single();
      if (error) {
        if (error.code === "23505") throw new Error("You have already submitted this activity.");
        throw new Error(error.message);
      }
      inserted = created;
    }

    // Completion is already recorded. Everything below is coaching only.
    let feedbackStatus = "pending";
    let feedback: string | null = null;
    let score: number | null = null;
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { generateProofFeedback, listZipEntries } = await import("@/lib/proofs.server");

      let zipEntries: string[] | undefined;
      if (proof.requiresFile && data.filePath) {
        const { data: file } = await supabaseAdmin.storage.from("proofs").download(data.filePath);
        if (file) zipEntries = listZipEntries(await file.arrayBuffer());
      }

      const result = await generateProofFeedback({
        proofKey: proof.key,
        answers: data.answers,
        zipEntries,
        answerKey: material?.answer_key ?? null,
        transcript: material?.transcript_text ?? null,
      });
      feedbackStatus = result.status;
      feedback = result.text;
      score = result.score ?? null;
      await supabaseAdmin
        .from("proof_submissions")
        .update({
          feedback,
          feedback_status: feedbackStatus,
          feedback_at: new Date().toISOString(),
          score,
        })
        .eq("id", inserted.id);
    } catch {
      feedbackStatus = "unavailable";
    }

    return {
      ok: true,
      submittedAt: inserted.submitted_at,
      feedback,
      feedbackStatus,
      score: score ?? null,
      maxScore: proof.maxScore ?? null,
    };
  });

/** Professor view: who has completed which activity, across the sections. */
export const getProofOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    if (!(await isAdmin(supabase, userId))) throw new Error("Admins only.");

    const [{ data: teams }, { data: members }, { data: subs }, { data: materials }] =
      await Promise.all([
        supabase.from("teams").select("id, name, display_name, section"),
        supabase.from("team_members").select("team_id, user_id, job_title"),
        supabase
          .from("proof_submissions")
          .select("user_id, proof_key, submitted_at, feedback_status, review_status"),
        supabase.from("proof_materials").select("proof_key, ready"),
      ]);

    const ids = (members ?? []).map((m) => m.user_id);
    const { data: profiles } = ids.length
      ? await supabase.from("profiles").select("id, name, avatar_url").in("id", ids)
      : { data: [] as { id: string; name: string; avatar_url: string | null }[] };

    const rows = (teams ?? [])
      .map((t) => {
        const list = (members ?? []).filter((m) => m.team_id === t.id);
        const people = list.map((m) => {
          const profile = (profiles ?? []).find((p) => p.id === m.user_id);
          const assigned = proofsForRole(m.job_title)
            .filter((p) => p.role !== "Researcher" || list.length >= 6)
            .map((p) => p.key);
          const done = (subs ?? [])
            .filter((s) => s.user_id === m.user_id && assigned.includes(s.proof_key))
            .map((s) => s.proof_key);
          return {
            userId: m.user_id,
            name: profile?.name ?? "Student",
            avatarUrl: profile?.avatar_url ?? null,
            role: m.job_title,
            assigned,
            completed: done,
            approved: (subs ?? [])
              .filter(
                (s) =>
                  s.user_id === m.user_id &&
                  assigned.includes(s.proof_key) &&
                  s.review_status === "approved",
              )
              .map((s) => s.proof_key),
            awaiting: (subs ?? [])
              .filter(
                (s) =>
                  s.user_id === m.user_id &&
                  assigned.includes(s.proof_key) &&
                  s.review_status === "pending",
              )
              .map((s) => s.proof_key),
            sentBack: (subs ?? [])
              .filter(
                (s) =>
                  s.user_id === m.user_id &&
                  assigned.includes(s.proof_key) &&
                  s.review_status === "sent_back",
              )
              .map((s) => s.proof_key),
          };
        });
        return {
          teamId: t.id,
          section: t.section ?? "",
          label: t.display_name || t.name,
          name: t.name,
          people,
        };
      })
      .sort((a, b) => a.section.localeCompare(b.section) || a.name.localeCompare(b.name));

    return {
      rows,
      materials: PROOFS.map((p) => ({
        key: p.key,
        title: p.title,
        role: p.role,
        needsMaterials: !!p.needsMaterials,
        ready: (materials ?? []).find((m) => m.proof_key === p.key)?.ready ?? false,
      })),
    };
  });

/** Professor uploads or edits the material behind an activity. */
export const saveProofMaterial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      proofKey: string;
      ready?: boolean;
      audioPath?: string | null;
      zipPath?: string | null;
      transcript?: string | null;
      answerKey?: string | null;
      extraInstructions?: string | null;
    }) => {
      if (!proofByKey(input?.proofKey ?? "")) throw new Error("Unknown activity.");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!(await isAdmin(supabase, userId))) throw new Error("Admins only.");

    const patch: Record<string, unknown> = { proof_key: data.proofKey, updated_by: userId };
    if (data.ready !== undefined) patch["ready"] = data.ready;
    if (data.audioPath !== undefined) patch["audio_path"] = data.audioPath;
    if (data.zipPath !== undefined) patch["zip_path"] = data.zipPath;
    if (data.transcript !== undefined) patch["transcript_text"] = data.transcript;
    if (data.answerKey !== undefined) patch["answer_key"] = data.answerKey;
    if (data.extraInstructions !== undefined) patch["extra_instructions"] = data.extraInstructions;

    const { error } = await supabase
      .from("proof_materials")
      .upsert(patch as never, { onConflict: "proof_key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Everything waiting on the professor's decision, oldest first. */
export const getProofReviewQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    if (!(await isAdmin(supabase, userId))) throw new Error("Admins only.");

    const { data: subs } = await supabase
      .from("proof_submissions")
      .select(
        "id, user_id, team_id, proof_key, response, file_path, file_name, submitted_at, review_status, review_note, resubmit_count, feedback, score",
      )
      .eq("review_status", "pending")
      .order("submitted_at", { ascending: true })
      .limit(60);

    const rows = subs ?? [];
    const ids = Array.from(new Set(rows.map((s) => s.user_id)));
    const teamIds = Array.from(new Set(rows.map((s) => s.team_id).filter(Boolean) as string[]));

    const [{ data: profiles }, { data: teams }] = await Promise.all([
      ids.length
        ? supabase.from("profiles").select("id, name, avatar_url").in("id", ids)
        : Promise.resolve({ data: [] as { id: string; name: string; avatar_url: string | null }[] }),
      teamIds.length
        ? supabase.from("teams").select("id, name, display_name, section").in("id", teamIds)
        : Promise.resolve({
            data: [] as { id: string; name: string; display_name: string | null; section: string | null }[],
          }),
    ]);

    return await Promise.all(
      rows.map(async (s) => {
        const profile = (profiles ?? []).find((p) => p.id === s.user_id);
        const team = (teams ?? []).find((t) => t.id === s.team_id);
        let fileUrl: string | null = null;
        if (s.file_path) {
          const { data: signed } = await supabase.storage
            .from("proofs")
            .createSignedUrl(s.file_path, 60 * 60);
          fileUrl = signed?.signedUrl ?? null;
        }
        const proof = proofByKey(s.proof_key);
        return {
          id: s.id,
          proofKey: s.proof_key,
          proofTitle: proof?.title ?? s.proof_key,
          role: proof?.role ?? null,
          studentName: profile?.name ?? "Student",
          avatarUrl: profile?.avatar_url ?? null,
          teamLabel: team ? team.display_name || team.name : "—",
          section: team?.section ?? "",
          submittedAt: s.submitted_at,
          resubmitCount: s.resubmit_count ?? 0,
          answers: asAnswers(s.response),
          fileName: s.file_name,
          fileUrl,
          feedback: s.feedback,
          score: s.score ?? null,
        };
      }),
    );
  });

/** Professor approves a submission, or sends it back with a note to fix. */
export const reviewProof = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { submissionId: string; decision: "approved" | "sent_back"; note?: string }) => {
    if (!input?.submissionId) throw new Error("Missing submission.");
    if (input.decision !== "approved" && input.decision !== "sent_back")
      throw new Error("Unknown decision.");
    if (input.decision === "sent_back" && !(input.note ?? "").trim())
      throw new Error("Please write a note saying what to fix.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!(await isAdmin(supabase, userId))) throw new Error("Admins only.");

    const { data: sub } = await supabase
      .from("proof_submissions")
      .select("id, user_id, team_id, proof_key")
      .eq("id", data.submissionId)
      .maybeSingle();
    if (!sub) throw new Error("Submission not found.");

    const { error } = await supabase
      .from("proof_submissions")
      .update({
        review_status: data.decision,
        review_note: data.decision === "sent_back" ? (data.note ?? "").trim() : null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: userId,
      })
      .eq("id", sub.id);
    if (error) throw new Error(error.message);

    const title = proofByKey(sub.proof_key)?.title ?? sub.proof_key;
    // The PM is copied automatically on every team notification.
    await supabase.from("notifications").insert({
      user_id: sub.user_id,
      team_id: sub.team_id,
      actor_id: userId,
      kind: "proof_review",
      message:
        data.decision === "approved"
          ? `Your "${title}" activity was approved.`
          : `Your "${title}" activity was sent back: ${(data.note ?? "").trim()}`,
    });

    return { ok: true };
  });
