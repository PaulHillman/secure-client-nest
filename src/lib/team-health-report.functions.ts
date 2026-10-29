import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeHealthReview } from "@/lib/team-health-review.functions";
import type { HealthException, TeamCheckResult, HealthCheck } from "@/lib/team-health-review.functions";

type Payload = {
  generatedAt: string; week: number; progress: number; teamsChecked: number; peopleChecked: number;
  teamResults: TeamCheckResult[]; exceptions: HealthException[]; ranking: unknown[];
};
type Input = { action: "save" | "send" | "both"; scope: string; scopeLabel: string; payload: Payload };

const CHECK_LABELS: Record<HealthCheck, string> = {
  gaps: "Dashboard Gaps", readiness: "Team Readiness", meetings: "Weekly Meetings", reports: "Health Report follow-up",
  activity: "Login / upload activity", vault: "File Vault requirements",
};
const PARFUNKEL = /parfunkel/i;
const INSTRUCTOR_CC = "HillmanP@gvsu.edu";

/** Admin-only: save a reviewed health report, email each team its PDF, or both. */
export const saveOrSendHealthReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: Input) => {
    if (!["save", "send", "both"].includes(i?.action)) throw new Error("Bad action");
    if (!i.payload || !Array.isArray(i.payload.teamResults)) throw new Error("Missing report");
    return i;
  })
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (ok !== true) throw new Error("Forbidden");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const p = data.payload;

    const scores = p.teamResults.map((t) => {
      const mine = p.exceptions.filter((e) => e.teamId === t.teamId);
      const red = mine.filter((e) => e.level === "red").length;
      return {
        team_id: t.teamId, team_label: t.teamLabel, section: t.section,
        good: Object.values(t.results).filter((s) => s === "pass").length,
        bad: mine.length, red, yellow: mine.length - red,
      };
    });

    let reportId: string | null = null;
    if (data.action !== "send") {
      const { data: rep, error } = await db.from("health_review_reports").insert({
        scope: data.scope, scope_label: data.scopeLabel, run_by: context.userId,
        teams_checked: p.teamsChecked,
        good_count: scores.reduce((s, x) => s + x.good, 0),
        bad_count: scores.reduce((s, x) => s + x.bad, 0),
        payload: JSON.parse(JSON.stringify({ ...p, reportId: null })),
      }).select("id").single();
      if (error) throw new Error(error.message);
      reportId = rep.id;
      if (scores.length) {
        const { error: e2 } = await db.from("health_review_scores").insert(scores.map((s) => ({ ...s, report_id: rep.id })));
        if (e2) throw new Error(e2.message);
      }
    }

    let emailsSent = 0, emailsFailed = 0, teamsSent = 0;
    if (data.action !== "save") {
      const { buildHealthReportPdf } = await import("@/lib/health-report-pdf");
      const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
      const ids = p.teamResults.map((t) => t.teamId);
      const { data: members } = await db.from("team_members").select("team_id, user_id").in("team_id", ids);
      const uids = [...new Set((members ?? []).map((m) => m.user_id))];
      const { data: profs } = uids.length
        ? await db.from("profiles").select("id, name, first_name, email").in("id", uids)
        : { data: [] as { id: string; name: string; first_name: string | null; email: string | null }[] };
      const runAt = new Date(p.generatedAt).toLocaleString("en-US", { timeZone: "America/New_York" });
      const stamp = Date.now();
      // Student buttons open the report inside ClientVault so the open is recorded to them.
      const APP_ORIGIN = "https://clientvault.immersivebusiness.net";

      for (const t of p.teamResults) {
        const score = scores.find((s) => s.team_id === t.teamId);
        if (!score) continue;
        const pdf = await buildHealthReportPdf({
          teamLabel: t.teamLabel, runAt, week: p.week,
          comparison: t.comparison, research: t.research, passNotes: t.passNotes,
          checks: (Object.keys(CHECK_LABELS) as HealthCheck[]).map((k) => ({ label: CHECK_LABELS[k], status: t.results[k] })),
          concerns: p.exceptions.filter((e) => e.teamId === t.teamId).map((e) => ({
            level: e.level, check: CHECK_LABELS[e.check], person: e.person, role: e.role, reason: e.reason,
          })),
        });
        const path = `${t.teamId}/${stamp}-health-review.pdf`;
        const up = await db.storage.from("health-reports").upload(path, pdf, { contentType: "application/pdf" });
        if (up.error) { emailsFailed++; continue; }
        const { data: signed } = await db.storage.from("health-reports").createSignedUrl(path, 60 * 60 * 24 * 30);
        if (!signed?.signedUrl) { emailsFailed++; continue; }
        // Publish the same PDF to the team vault; Save and refresh do not advance the shared baseline.
        const vaultPath = `teams/${t.teamId}/health-reports/${stamp}-health-review.pdf`;
        const vaultUpload = await db.storage.from("vault").upload(vaultPath, pdf, { contentType: "application/pdf" });
        if (vaultUpload.error) throw new Error("Could not place the shared report in the team vault; no email was sent.");
        // A distinct report file preserves old versions and gives the new report its own two-login banner budget.
        const fileId = crypto.randomUUID();
        const { error: fileError } = await db.from("files").insert({ id: fileId, team_id: t.teamId, uploaded_by: context.userId, file_name: `Team Health Review ${new Date(p.generatedAt).toISOString().slice(0, 10)}.pdf`, section: "Team Documents", subsection: "Health Reports", category: "Health Reports", is_locked: true });
        if (fileError) throw new Error("Could not create the team report file.");
        const { data: oldVersion } = await db.from("file_versions").select("version_number").eq("file_id", fileId).order("version_number", { ascending: false }).limit(1).maybeSingle();
        const { data: vaultVersion, error: versionError } = await db.from("file_versions").insert({ file_id: fileId, version_number: (oldVersion?.version_number ?? 0) + 1, storage_path: vaultPath, mime_type: "application/pdf", file_size: pdf.byteLength, uploaded_by: context.userId }).select("id").single();
        if (versionError || !vaultVersion) throw new Error("Could not create the shared report version.");
        const { error: updateError } = await db.from("files").update({ current_version_id: vaultVersion.id }).eq("id", fileId);
        if (updateError) throw new Error("Could not update the shared report in the vault.");
        const accepted: string[] = [];
        const roster = (profs ?? []).filter((pr) =>
          (members ?? []).some((m) => m.team_id === t.teamId && m.user_id === pr.id) && pr.email && !PARFUNKEL.test(pr.name ?? ""));
        for (const pr of roster) {
          try {
            if (!pr.email) continue;
            const sent = await sendTemplateEmail("health-review", pr.email, {
              templateData: { name: pr.first_name || pr.name, teamName: t.teamLabel, good: score.good, bad: score.bad, pdfUrl: `${APP_ORIGIN}/app/health-report/${fileId}` },
              idempotencyKey: `health-${stamp}-${t.teamId}-${pr.id}`,
            });
            if (sent.sent) { emailsSent++; accepted.push(pr.id); } else emailsFailed++;
          } catch { emailsFailed++; }
        }
        if (accepted.length) {
          const { error: shareError } = await db.from("health_review_shares").insert({ team_id: t.teamId, generated_at: p.generatedAt, shared_by: context.userId, payload: JSON.parse(JSON.stringify({ team: t, exceptions: p.exceptions.filter(e => e.teamId === t.teamId) })), recipient_ids: accepted, vault_file_id: fileId, vault_version_id: vaultVersion.id });
          if (shareError) throw new Error("Emails were accepted, but the shared baseline could not be recorded. Do not resend without checking the email log.");
          teamsSent++;
        }
        // Instructor copy (cc) of every team report; logged in the email log like all sends.
        try {
          const instructorSent = await sendTemplateEmail("health-review", INSTRUCTOR_CC, {
            templateData: { name: "Paul (instructor copy)", teamName: t.teamLabel, good: score.good, bad: score.bad, pdfUrl: signed.signedUrl },
            idempotencyKey: `health-${stamp}-${t.teamId}-instructor-cc`,
          });
          if (instructorSent.sent) emailsSent++; else emailsFailed++;
        } catch { emailsFailed++; }
      }
    }
    return { reportId, emailsSent, emailsFailed, teamsSent };
  });

/** Admin-only: regenerate the Health Reports PDF in each team's vault with current rules. No emails, no saved-report rows. */
export const refreshVaultHealthReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { teamIds?: string[] } | undefined) => {
    if (input?.teamIds && (!Array.isArray(input.teamIds) || !input.teamIds.length || input.teamIds.some(id => typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)))) throw new Error("Choose valid teams.");
    return input;
  })
  .handler(async ({ context, data }) => {
    const { data: ok } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (ok !== true) throw new Error("Forbidden");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { buildHealthReportPdf } = await import("@/lib/health-report-pdf");

    const review = await computeHealthReview({ scope: "all" }, context);
    const runAt = new Date(review.generatedAt).toLocaleString("en-US", { timeZone: "America/New_York" });

    const { data: vaultFiles, error } = await db
      .from("files")
      .select("id, team_id, file_name, teams!inner(is_test), file_versions(id, version_number, storage_path)")
      .eq("subsection", "Health Reports");
    if (error) throw new Error(error.message);

    let refreshed = 0;
    const skipped: string[] = [];
    const stamp = Date.now();
    for (const f of vaultFiles ?? []) {
      if ((f.teams as { is_test: boolean } | null)?.is_test) continue;
      if (data?.teamIds && !data.teamIds.includes(f.team_id ?? "")) continue;
      const t = review.teamResults.find((r) => r.teamId === f.team_id);
      if (!t) { skipped.push(f.file_name); continue; }
      const concerns = review.exceptions
        .filter((e) => e.teamId === t.teamId)
        .map((e) => ({ level: e.level, check: CHECK_LABELS[e.check], person: e.person, role: e.role, reason: e.reason }));
      const pdf = await buildHealthReportPdf({
        teamLabel: t.teamLabel, runAt, week: review.week,
        comparison: t.comparison, research: t.research, passNotes: t.passNotes,
        checks: (Object.keys(CHECK_LABELS) as HealthCheck[]).map((k) => ({ label: CHECK_LABELS[k], status: t.results[k] })),
        concerns,
      });
      const path = `teams/${f.team_id}/health-reports/${stamp}-${f.file_name}`;
      const up = await db.storage.from("vault").upload(path, pdf, { contentType: "application/pdf" });
      if (up.error) { skipped.push(`${f.file_name} (upload failed)`); continue; }
      const versions = (f.file_versions as { id: string; version_number: number }[]) ?? [];
      const nextVersion = versions.reduce((m, v) => Math.max(m, v.version_number), 0) + 1;
      const { data: ver, error: vErr } = await db.from("file_versions").insert({
        file_id: f.id, version_number: nextVersion, storage_path: path,
        mime_type: "application/pdf", file_size: pdf.byteLength, uploaded_by: context.userId,
      }).select("id").single();
      if (vErr) { skipped.push(`${f.file_name} (version failed)`); continue; }
      const { error: uErr } = await db.from("files").update({ current_version_id: ver.id, updated_at: new Date().toISOString() }).eq("id", f.id);
      if (uErr) { skipped.push(`${f.file_name} (update failed)`); continue; }
      refreshed++;
    }
    return { refreshed, skipped, generatedAt: review.generatedAt };
  });
