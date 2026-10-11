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

      for (const t of p.teamResults) {
        const score = scores.find((s) => s.team_id === t.teamId)!;
        const pdf = await buildHealthReportPdf({
          teamLabel: t.teamLabel, runAt, week: p.week,
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
        teamsSent++;
        const roster = (profs ?? []).filter((pr) =>
          (members ?? []).some((m) => m.team_id === t.teamId && m.user_id === pr.id) && pr.email && !PARFUNKEL.test(pr.name ?? ""));
        for (const pr of roster) {
          try {
            await sendTemplateEmail("health-review", pr.email!, {
              templateData: { name: pr.first_name || pr.name, teamName: t.teamLabel, good: score.good, bad: score.bad, pdfUrl: signed.signedUrl },
              idempotencyKey: `health-${stamp}-${t.teamId}-${pr.id}`,
            });
            emailsSent++;
          } catch { emailsFailed++; }
        }
        // Instructor copy (cc) of every team report; logged in the email log like all sends.
        try {
          await sendTemplateEmail("health-review", INSTRUCTOR_CC, {
            templateData: { name: "Paul (instructor copy)", teamName: t.teamLabel, good: score.good, bad: score.bad, pdfUrl: signed.signedUrl },
            idempotencyKey: `health-${stamp}-${t.teamId}-instructor-cc`,
          });
          emailsSent++;
        } catch { emailsFailed++; }
      }
    }
    return { reportId, emailsSent, emailsFailed, teamsSent };
  });
