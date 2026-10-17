import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildAssessments } from "@/lib/team-readiness-assessment.functions";
import { teamLineLabel, compareTeamsBySectionThenNumber } from "@/lib/team-label";
import { compareConcerns, concernKey, RESEARCH_NOTE, type Comparison, type Observation } from "@/lib/health-review-comparison";
import { subsectionMatches } from "@/lib/vault-structure";
import { lowEngagementStreak, lowEngagementLevel, isMaterialView, LOW_ENGAGEMENT_START, type Contribution } from "@/lib/low-engagement";

export type HealthScope = "team" | "section" | "all" | "role";

export const ROLE_SCOPES = ["PM", "Company Liaison", "Client Vault & Tech Administrator", "Communication Specialist", "Video Specialist", "Researcher"] as const;
export type HealthCheck = "gaps" | "readiness" | "meetings" | "activity" | "vault" | "reports";

export type HealthException = {
  check: HealthCheck;
  level: "red" | "yellow";
  teamId: string;
  teamLabel: string;
  section: string | null;
  person: string | null;
  role: string | null;
  userId?: string | null;
  ruleId?: string;
  reason: string;
};

export type PersonRank = {
  userId: string;
  name: string;
  teamLabel: string;
  red: number;
  yellow: number;
  total: number;
};

export type CheckStatus = "pass" | "flagged" | "skipped";

export type TeamCheckResult = {
  teamId: string;
  teamLabel: string;
  section: string | null;
  peopleChecked: number;
  comparison?: Comparison;
  observations?: Observation[];
  research?: { topics: { topic: string; evidence: { fileName: string; excerpt: string }[] }[]; unreadable: string[]; inspected: string[] };
  results: Record<HealthCheck, CheckStatus>;
  /** Human-readable facts showing why each passed check passed. */
  passNotes: Record<HealthCheck, string[]>;
};

const DAY = 86400000;
const PARFUNKEL = /parfunkel/i;

/** Read-only: runs the five Team Health checks and returns exceptions only. */
export const runTeamHealthReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { scope: HealthScope; teamId?: string; section?: string; role?: string }) => {
    if (!["team", "section", "all", "role"].includes(i?.scope)) throw new Error("Bad scope");
    if (i.scope === "team" && !i.teamId) throw new Error("Choose a team.");
    if (i.scope === "section" && !i.section) throw new Error("Choose a section.");
    if (i.scope === "role") {
      if (!i.role) throw new Error("Choose a role.");
      if (!(ROLE_SCOPES as readonly string[]).includes(i.role)) throw new Error("Unknown role.");
    }
    return i;
  })
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (ok !== true) throw new Error("Forbidden");
    return computeHealthReview(data, context);
  });

/** Shared review logic; also used when regenerating vault report PDFs. */
export async function computeHealthReview(
  data: { scope: HealthScope; teamId?: string; section?: string; role?: string },
  context: { supabase: any; userId: string },
) {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");

    const { assessments, generatedAt } = await buildAssessments(data.scope === "team" ? data.teamId : undefined);
    let teams = assessments.filter((a) => data.scope === "team" || !a.isTest);
    if (data.scope === "section") teams = teams.filter((a) => a.section === data.section);
    const roleFilter = data.scope === "role" ? data.role ?? null : null;
    const ids = teams.map((t) => t.teamId);
    const now = Date.now();

    const { data: sched } = await db.from("semester_schedule").select("start_date, end_date").maybeSingle();
    const start = sched?.start_date ? new Date(sched.start_date + "T00:00:00Z").getTime() : now - 42 * DAY;
    const end = sched?.end_date ? new Date(sched.end_date + "T23:59:59Z").getTime() : now + 60 * DAY;
    const total = Math.max(1, end - start);
    const progress = Math.min(1, Math.max(0, (now - start) / total));
    const week = Math.max(0, Math.floor((now - start) / (7 * DAY)) + 1);

    if (!ids.length) return { generatedAt, week, progress, teamsChecked: 0, peopleChecked: 0, teamResults: [] as TeamCheckResult[], exceptions: [] as HealthException[], ranking: [] as PersonRank[], reportId: null as string | null };

    const since = new Date(now - 7 * DAY).toISOString();
    const [{ data: members }, { data: logs }, { data: files }, { data: norms }, { data: profiles }, { data: reportViews }, { data: minutesTemplateRows }] = await Promise.all([
      db.from("team_members").select("team_id, user_id, job_title").in("team_id", ids),
      db.from("meeting_logs").select("team_id, meeting_date, attendance, minutes_posted").in("team_id", ids),
      db.from("files").select("id, current_version_id, created_at, team_id, section, subsection, file_name, uploaded_by, is_template, is_locked").in("team_id", ids),
      db.from("group_norms").select("team_id, version, group_norms_signatures(user_id, version)").in("team_id", ids),
      db.from("profiles").select("id, name, first_name, last_name, email"),
      db.from("health_report_views").select("user_id, file_id, last_version_id, team_id, view_count, clicked_at, last_viewed_at").in("team_id", ids),
      db.from("files").select("id, current_version_id, file_name").eq("is_template", true).ilike("file_name", "Meeting Minutes Template%").limit(1),
    ]);
    const minutesTemplate = minutesTemplateRows?.[0] ?? null;
    const { data: companyFocus } = await db.from("company_focus").select("team_id, company_name, confirmed_at").in("team_id", ids);
    const { data: shares, error: sharesError } = await db.from("health_review_shares").select("team_id, shared_at, generated_at, payload, source, vault_file_id, vault_version_id, recipient_ids").in("team_id", ids).order("shared_at", { ascending: false });
    if (sharesError) throw new Error("Unable to load prior shared reports; comparison cannot be verified.");
    const latestShare = (teamId: string) => (shares ?? []).find((s: any) => s.team_id === teamId);
    const observationsByTeam = new Map<string, Observation[]>();
    const researchByTeam = new Map<string, Awaited<ReturnType<typeof import("./health-research.server").inspectResearch>>>();
    const minutesTextCache = new Map<string, string | null>();
    const userIds = [...new Set((members ?? []).map((m) => m.user_id))];
    const [{ data: auths }, { data: usage }, { data: versions }, { data: sessions }] = await Promise.all([
      db.from("auth_audit_log").select("user_id, created_at").in("user_id", userIds).gte("created_at", since),
      db.from("usage_events").select("user_id, created_at").eq("event", "page_view").in("user_id", userIds).gte("created_at", since).limit(20000),
      db.from("file_versions").select("uploaded_by, uploaded_at").in("uploaded_by", userIds).gte("uploaded_at", since),
      // Authoritative sign-in/session activity straight from the auth system (admin-only function).
      context.supabase.rpc("auth_activity_since", { _since: since }),
    ]);

    // Three-week low-engagement cycle: meaningful contributions over the last 21 days.
    const since21 = new Date(now - 21 * DAY).toISOString();
    const [{ data: v21 }, { data: c21 }, { data: p21 }, { data: u21 }] = await Promise.all([
      db.from("file_versions").select("uploaded_by, uploaded_at").in("uploaded_by", userIds).gte("uploaded_at", since21),
      db.from("file_comments").select("author_id, created_at").in("author_id", userIds).gte("created_at", since21),
      db.from("proof_submissions").select("user_id, submitted_at").in("user_id", userIds).gte("submitted_at", since21),
      db.from("usage_events").select("user_id, path, label, created_at").in("event", ["page_view", "click"]).in("user_id", userIds).gte("created_at", since21).limit(20000),
    ]);
    const contributions: Contribution[] = [
      ...(v21 ?? []).map((r) => ({ userId: r.uploaded_by, at: r.uploaded_at })),
      ...(c21 ?? []).map((r) => ({ userId: r.author_id, at: r.created_at })),
      ...(p21 ?? []).map((r) => ({ userId: r.user_id, at: r.submitted_at })),
      ...(u21 ?? []).filter((r) => isMaterialView(r.path, r.label)).map((r) => ({ userId: r.user_id, at: r.created_at })),
      ...(logs ?? []).flatMap((l) => ((l.attendance as { user_id: string; status: string }[] | null) ?? []).filter((a) => a.status !== "absent").map((a) => ({ userId: a.user_id, at: `${l.meeting_date}T23:00:00Z` }))),
    ];

    const nameOf = (id: string) => {
      const p = (profiles ?? []).find((x) => x.id === id);
      return (p?.first_name && p?.last_name ? `${p.first_name} ${p.last_name}` : p?.name || p?.email) || "Unknown student";
    };
    const days = new Map<string, Set<string>>();
    const sessionRows = (sessions ?? []).map((s: { user_id: string; active_at: string }) => ({ user_id: s.user_id, created_at: s.active_at }));
    for (const r of [...(auths ?? []), ...(usage ?? []), ...sessionRows]) {
      if (!r.user_id || !r.created_at) continue;
      if (!days.has(r.user_id)) days.set(r.user_id, new Set());
      days.get(r.user_id)?.add(String(r.created_at).slice(0, 10));
    }
    const uploads = new Map<string, number>();
    for (const v of versions ?? []) uploads.set(v.uploaded_by, (uploads.get(v.uploaded_by) ?? 0) + 1);

    const out: HealthException[] = [];
    const passNotesByTeam = new Map<string, Record<HealthCheck, string[]>>();
    let people = 0;
    const sorted = [...teams].sort((a, b) =>
      compareTeamsBySectionThenNumber({ name: a.teamRecordName, section: a.section }, { name: b.teamRecordName, section: b.section }));

    for (const t of sorted) {
      const label = teamLineLabel({ name: t.teamRecordName, display_name: t.teamName !== t.teamRecordName ? t.teamName : null, section: t.section });
      const push = (check: HealthCheck, level: "red" | "yellow", reason: string, person: string | null = null, role: string | null = null, userId: string | null = null, ruleId?: string) => {
        const inferred = concernKey({ check, level, reason, person, userId });
        const rulePattern = check === "vault" ? /^(Minutes|Agendas|Mid-Semester Peer Reviews|Peer review|No Interview Questions|No Video files|Video Final Submission|Client Communications)/.exec(reason)?.[1]
          : check === "meetings" ? /^(Last meeting logged|\d+ of \d+ logged meeting|Missed \d{4}-\d{2}-\d{2} meeting)/.exec(reason)?.[0].replace(/^\d+ of \d+ logged meeting$/, "missing_minutes")
          : check === "activity" ? "relative_activity" : undefined;
        const generatedRule = rulePattern ? `${check}:${rulePattern}:${userId ?? "team"}` : undefined;
        out.push({ check, level, teamId: t.teamId, teamLabel: label, section: t.section, person, role, userId, reason, ruleId: ruleId ?? inferred ?? generatedRule });
      };
      const observations: Observation[] = [];
      observationsByTeam.set(t.teamId, observations);
      const observe = (ruleId: string, evidence: string, remaining = 0, verified = true) => observations.push({ ruleId, evidence, remaining, verified });
      const notes: Record<HealthCheck, string[]> = { gaps: [], readiness: [], meetings: [], activity: [], vault: [], reports: [] };
      passNotesByTeam.set(t.teamId, notes);
      const tm = (members ?? []).filter((m) => m.team_id === t.teamId && !PARFUNKEL.test(nameOf(m.user_id)));
      const roleHolders = roleFilter ? tm.filter((m) => m.job_title === roleFilter) : tm;
      const teamFiles = (files ?? []).filter((f) => f.team_id === t.teamId && !f.is_template);
      const teamLogs = (logs ?? []).filter((l) => l.team_id === t.teamId);
      const count = (sub: string) => teamFiles.filter((f) => f.section === "Team Documents" && subsectionMatches(f.subsection, sub)).length;
      const isTeamLevel = !roleFilter;
      const pmScope = roleFilter === "PM";
      const vidScope = roleFilter === "Video Specialist";

      if (roleFilter && !roleHolders.length) {
        push("readiness", "red", `No ${roleFilter} assigned on this team.`);
        continue;
      }

      // 1. Dashboard Gaps
      if (isTeamLevel || pmScope) {
        {
          // Same rule as the Group Norms card's "Fully approved" badge: every current member signed the current version.
          const gn = (norms ?? []).find((n) => n.team_id === t.teamId) as { version: number; group_norms_signatures: { user_id: string; version: number }[] } | undefined;
          const roster = (members ?? []).filter((m) => m.team_id === t.teamId).map((m) => m.user_id);
          const signed = new Set((gn?.group_norms_signatures ?? []).filter((s) => s.version === gn?.version).map((s) => s.user_id));
          const missing = roster.filter((u) => !signed.has(u));
          if (!gn) push("gaps", "yellow", "Group Norms not written yet.", null, null, null, "gaps:norms_signatures");
          else if (missing.length) push("gaps", "yellow", `Group Norms version ${gn.version} not signed by: ${missing.map(nameOf).join(", ")}.`, null, null, null, "gaps:norms_signatures");
          else notes.gaps.push(`Group Norms version ${gn.version} signed by all ${roster.length} members.`);
          observe("gaps:norms_signatures", `Group Norms version ${gn?.version} is signed by all current members.`, missing.length, !!gn);
        }
        if (t.setup.meetingState !== "complete") push("gaps", "yellow", "No weekly meeting consensus yet.");
        else notes.gaps.push("Weekly meeting time agreed by the team.");
      }

      observe("gaps:meeting", "Weekly meeting time agreed by the team.", t.setup.meetingState === "complete" ? 0 : 1);

      // 2. Team Readiness
      if (isTeamLevel) {
        // Retired for the current semester at the instructor's request: students were never briefed on where to record the client selection rationale. It returns next semester.
        const rationaleRetired = now <= end;
        const activeBlockers = rationaleRetired ? t.blockers.filter((f) => f.key !== "no_rationale") : t.blockers;
        const activeWarnings = rationaleRetired ? t.warnings.filter((f) => f.key !== "no_rationale") : t.warnings;
        // Agreement findings name the members still outstanding so the team knows exactly who must act.
        const named = (f: { key: string; reason: string; detail?: string }) => (f.key === "meeting_not_agreed" || f.key === "norms_not_agreed") && f.detail ? `${f.reason}: ${f.detail}.` : f.reason;
        for (const b of activeBlockers) push("readiness", "red", named(b), null, null, null, `readiness:${b.key}`);
        for (const w of activeWarnings) push("readiness", "yellow", named(w), null, null, null, `readiness:${w.key}`);
        if (!activeBlockers.length && !activeWarnings.length) notes.readiness.push("No readiness concerns — all readiness checks came back clean.");
        const evidence: Record<string, string> = {
          no_rationale: "A client selection rationale is now recorded.", no_norms: "Group Norms are now posted.",
          no_manager: "A manager contact is now recorded.", no_size: "Company size is now recorded.", no_location: "Company location is now recorded.",
          no_industry: "Client industry is now recorded.", meeting_time: "Meeting day and time are now recorded.", meeting_location: "Meeting place is now recorded.",
          no_pm: "A Project Manager is now assigned.", team_name: "The team name is now recorded.", duplicate_roles: "No duplicate role assignments remain.",
          norms_incomplete: "All required Group Norms sections are now complete.",
          norms_communication: "All communication wording checks now have concrete, measurable details.",
          norms_deadlines: "All internal deadline wording checks now have concrete, measurable details.",
          norms_accountability: "All accountability wording checks now have concrete actions and responsibilities.",
          norms_not_agreed: "All members have agreed to the current Group Norms version.",
          meeting_not_agreed: "Every member has now agreed to the current weekly meeting day and time.",
          pm_verification: "Team Setup is submitted and the Project Manager has signed the current norms.",
        };
        for (const [key, fact] of Object.entries(evidence)) {
          if (rationaleRetired && key === "no_rationale") continue;
          const found = [...t.blockers, ...t.warnings].filter(f => f.key === key);
          const category = t.norms.categories.find(c => `norms_${c.key}` === key);
          const remaining = category ? category.items.filter(i => i.status !== "found").length : key === "norms_not_agreed" ? t.norms.notAgreed.length : key === "norms_incomplete" ? t.norms.missingSections.length : key === "meeting_not_agreed" ? (found.length ? t.members.filter(m => !m.agreedToMeeting).length : 0) : found.length;
          observe(`readiness:${key}`, fact, remaining);
        }
      } else {
        for (const m of t.members.filter((x) => x.role === roleFilter)) {
          if (m.missingProofs > 0) {
            const uid = (members ?? []).find((tm2) => tm2.team_id === t.teamId && tm2.job_title === roleFilter && nameOf(tm2.user_id) === m.name)?.user_id ?? null;
            push("readiness", "yellow", `${m.missingProofs} role activit${m.missingProofs === 1 ? "y" : "ies"} not submitted.`, m.name, m.role, uid);
          } else {
            notes.readiness.push(`${m.name}: all role activities submitted.`);
          }
        }
      }

      // 3. Weekly Meetings — itemized sub-checks: (a) meetings logged, (b) recency, (c) minutes per meeting, (d) reason per absence, (e) minutes follow the shared Meeting Minutes Template
      if ((isTeamLevel || pmScope) && week >= 3) {
        const last = teamLogs.map((l) => l.meeting_date).sort().pop();
        const gap = last ? Math.floor((now - new Date(last + "T12:00:00Z").getTime()) / DAY) : null;
        let passed = 0;
        let failed = 0;
        if (gap === null) { failed++; push("meetings", "red", "No weekly meetings logged this semester."); }
        else {
          passed++;
          notes.meetings.push(`Meetings logged: ${teamLogs.length} this semester.`);
          if (gap > 7) { failed++; push("meetings", gap > 13 ? "red" : "yellow", `Last meeting logged ${gap} days ago (${last}).`); }
          else { passed++; notes.meetings.push(`Recency: last meeting ${last} (${gap} day${gap === 1 ? "" : "s"} ago) — within the 7-day limit.`); }
        }
        observe("meetings:logged", `Meetings logged: ${teamLogs.length} this semester.`, teamLogs.length ? 0 : 1);
        const noMinutes = teamLogs.filter((l) => !l.minutes_posted).length;
        observe("meetings:missing_minutes:team", `Minutes are now posted for all ${teamLogs.length} logged meetings.`, noMinutes);
        observe("meetings:Last meeting logged:team", `Latest logged meeting: ${last}; ${gap} days ago, within the 7-day limit.`, gap === null || gap > 7 ? 1 : 0);
        if (noMinutes) { failed += noMinutes; push("meetings", "yellow", `${noMinutes} of ${teamLogs.length} logged meeting${teamLogs.length === 1 ? " has" : "s have"} no minutes posted.`); }
        if (teamLogs.length - noMinutes > 0) { passed += teamLogs.length - noMinutes; notes.meetings.push(`Minutes posted for ${teamLogs.length - noMinutes} of ${teamLogs.length} logged meeting${teamLogs.length === 1 ? "" : "s"}.`); }
        // (e) minutes follow the shared Meeting Minutes Template.
        // Minutes uploaded before 2026-09-27 are exempt: the template requirement was only
        // communicated that week, so earlier minutes are not checked for compliance.
        const TEMPLATE_REQUIRED_FROM = Date.parse("2026-09-27T00:00:00Z");
        const allMinutesFiles = teamFiles.filter((f) => f.section === "Team Documents" && subsectionMatches(f.subsection, "Minutes"));
        const exemptMinutes = allMinutesFiles.filter((f) => f.created_at && Date.parse(f.created_at) < TEMPLATE_REQUIRED_FROM);
        const minutesFiles = allMinutesFiles.filter((f) => !exemptMinutes.includes(f));
        if (exemptMinutes.length)
          notes.meetings.push(`Minutes template: ${exemptMinutes.length} minutes file${exemptMinutes.length === 1 ? "" : "s"} uploaded before 9/27/26 are exempt — the template requirement was announced that week (${exemptMinutes.map((f) => f.file_name).join(", ")}).`);
        if (minutesFiles.length && minutesTemplate) {
          const { inspectMinutesTemplate } = await import("./health-research.server");
          const minutesCheck = await inspectMinutesTemplate(db, minutesFiles, minutesTemplate, minutesTextCache);
          const readableCount = minutesCheck.compliant.length + minutesCheck.violations.length;
          observe("meetings:minutes_template:team", `Minutes template: ${minutesCheck.compliant.length} of ${readableCount} readable minutes files follow the shared Meeting Minutes Template.`, minutesCheck.violations.length, minutesCheck.unverified.length < minutesFiles.length);
          if (minutesCheck.violations.length) {
            failed += minutesCheck.violations.length;
            passed += minutesCheck.compliant.length;
            push("meetings", "yellow", `${minutesCheck.violations.length} of ${readableCount} minutes files do not follow the shared Meeting Minutes Template (${minutesCheck.violations.join(", ")}). Start each minutes document from the template in Operational Resources and Templates.`, null, null, null, "meetings:minutes_template");
            notes.meetings.push(`Minutes template: ${minutesCheck.compliant.length} of ${readableCount} readable minutes files follow the shared Meeting Minutes Template.`);
          } else if (minutesCheck.unverified.length >= minutesFiles.length) {
            notes.meetings.push(`Minutes template: unable to verify — ${minutesCheck.unverified.join(", ")} could not be read. Not counted as a violation; instructor review required.`);
          } else {
            passed++;
            notes.meetings.push(`Minutes template: all ${readableCount} readable minutes files follow the shared Meeting Minutes Template${minutesCheck.unverified.length ? `; ${minutesCheck.unverified.join(", ")} could not be read (not counted as violations)` : ""}.`);
          }
        } else {
          notes.meetings.push(minutesFiles.length ? "Minutes template: the shared Meeting Minutes Template could not be loaded, so compliance could not be verified." : "Minutes template: no minutes files posted yet to check.");
        }
        let absences = 0;
        let unexplained = 0;
        for (const l of teamLogs) {
          for (const a of (Array.isArray(l.attendance) ? l.attendance : []) as { user_id?: string; status?: string; reason?: string | null }[]) {
            if (a.status === "absent" && a.user_id) {
              absences++;
              if (!a.reason?.trim()) {
                unexplained++;
                push("meetings", "yellow", `Missed ${l.meeting_date} meeting with no reason recorded.`, nameOf(a.user_id), null, a.user_id);
              }
            }
          }
        }
        failed += unexplained;
        if (absences - unexplained > 0) { passed += absences - unexplained; notes.meetings.push(`Attendance: ${absences - unexplained} of ${absences} absence${absences === 1 ? "" : "s"} have a reason recorded.`); }
        else if (!absences && teamLogs.length) { passed++; notes.meetings.push("Attendance: no unexplained absences."); }
        notes.meetings.unshift(`Weekly Meetings sub-checks: ${passed} passed, ${failed} flagged (meetings logged, recency vs. 7-day limit, minutes per meeting, minutes on the shared template, reason per absence).`);
      }

      // 4. Relative login / upload activity (vs. this team's own median)
      const scores = tm.map((m) => ({ m, d: days.get(m.user_id)?.size ?? 0, u: uploads.get(m.user_id) ?? 0 }));
      const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
      const medDays = med(scores.map((s) => s.d));
      const medUp = med(scores.map((s) => s.u));
      for (const s of scores) {
        if (roleFilter && s.m.job_title !== roleFilter) continue;
        people++;
        const nm = nameOf(s.m.user_id);
        if (s.d === 0 && s.u === 0) push("activity", "red", "No sign-ins, visits, or uploads in the last 7 days.", nm, s.m.job_title, s.m.user_id);
        else if (medDays >= 2 && s.d < medDays / 2) push("activity", "yellow", `Active ${s.d} day(s) in 7 vs. team median ${medDays}.`, nm, s.m.job_title, s.m.user_id);
        else if (medUp >= 2 && s.u === 0) push("activity", "yellow", `No uploads in 7 days while teammates median ${medUp}.`, nm, s.m.job_title, s.m.user_id);
        else notes.activity.push(`${nm}: active ${s.d} of last 7 days, ${s.u} upload${s.u === 1 ? "" : "s"} — at or above the team's typical level.`);
        const streak = lowEngagementStreak(s.m.user_id, contributions, now, 3, LOW_ENGAGEMENT_START);
        const lvl = lowEngagementLevel(streak);
        if (lvl === "yellow" || lvl === "red") push("activity", lvl, `Low engagement: ${streak} consecutive weeks with no uploads, comments, meeting attendance, role activities, or review of team materials beyond the dashboard/health report.`, nm, s.m.job_title, s.m.user_id, `activity:low_engagement:${s.m.user_id}`);
        else if (lvl === "note") notes.activity.push(`${nm}: no meaningful contribution recorded this past week (note only — low engagement is flagged after 2 consecutive weeks).`);
        observe(`activity:low_engagement:${s.m.user_id}`, `${nm}: meaningful contribution recorded this week; low-engagement cycle reset.`, streak >= 2 ? 1 : 0);
        observe(`activity:relative_activity:${s.m.user_id}`, `${nm}: ${s.d} active days and ${s.u} uploads in the last 7 days; no relative-activity concern remains.`, out.some(e => e.check === "activity" && e.userId === s.m.user_id) ? 1 : 0);
      }

      // 5. Semester-aware File Vault requirements
      const expectedMinutes = Math.max(0, week - 3);
      if ((isTeamLevel || pmScope) && expectedMinutes > 0) {
        const mins = count("Minutes");
        if (mins < expectedMinutes) push("vault", mins < expectedMinutes / 2 ? "red" : "yellow", `Minutes: ${mins} posted, ${expectedMinutes} expected by week ${week}.`);
        else notes.vault.push(`Minutes on file: ${mins} (${expectedMinutes} expected by week ${week}).`);
        observe("vault:Minutes:team", `${mins} minutes files posted; ${expectedMinutes} expected in week ${week}.`, Math.max(0, expectedMinutes - mins));
        const ag = count("Agendas");
        observe("vault:Agendas:team", `${ag} agenda files posted; ${expectedMinutes} expected in week ${week}.`, Math.max(0, expectedMinutes - ag));
        if (ag < expectedMinutes) push("vault", ag < expectedMinutes / 2 ? "red" : "yellow", `Agendas: ${ag} posted, ${expectedMinutes} expected by week ${week}.`);
        else notes.vault.push(`Agendas on file: ${ag} (${expectedMinutes} expected by week ${week}).`);
      }
      // Mid-Semester Peer Reviews: one per student, due Friday 2026-10-23.
      // Before the deadline: no warnings — early filers get a compliment only.
      // After the deadline: each student without a review on file is flagged.
      if (isTeamLevel) {
        const peerDue = Date.parse("2026-10-24T03:59:59Z"); // end of Friday 10/23, America/Detroit
        const reviews = teamFiles.filter((f) => subsectionMatches(f.subsection, "Mid-Semester Peer Reviews"));
        const reviewedBy = new Set(reviews.map((f) => f.uploaded_by));
        if (now <= peerDue) {
          const early = tm.filter((m) => reviewedBy.has(m.user_id));
          for (const m of early)
            notes.vault.push(`${nameOf(m.user_id)}: peer review already filed — ahead of the 10/23 deadline. Nice early follow-through!`);
          if (!early.length) notes.vault.push(`Peer reviews: due Friday 10/23 — none filed yet, none expected before then.`);
        } else {
          const missing = tm.filter((m) => !reviewedBy.has(m.user_id));
          for (const m of missing)
            push("vault", "red", "Peer review not filed (due Friday 10/23).", nameOf(m.user_id), m.job_title, m.user_id, "vault:peer_review");
          if (missing.length)
            observe("vault:peer_review:team", `Peer reviews on file for ${tm.length - missing.length} of ${tm.length} members.`, missing.length);
          else notes.vault.push(`Peer reviews: all ${tm.length} members have filed (due 10/23).`);
        }
      }
      // Instructor granted a one-week grace period (2026-10-17): flag from 47% of the semester, not 40%.
      if (isTeamLevel && progress >= 0.47 && !teamFiles.some((f) => f.section === "Semester Long Project" && f.subsection === "Interview Questions"))
        push("vault", "yellow", "No Interview Questions uploaded (expected by 47% of semester).");
      if ((isTeamLevel || vidScope) && progress >= 0.6 && !teamFiles.some((f) => f.section === "Video"))
        push("vault", vidScope ? "red" : "yellow", "No Video files uploaded (expected by 60% of semester).", null, vidScope ? "Video Specialist" : null);
      if ((isTeamLevel || vidScope) && progress >= 0.9 && !teamFiles.some((f) => f.section === "Video" && f.subsection === "Final Submission"))
        push("vault", "red", "Video Final Submission not uploaded.");

      // 6. Client research: at least 2 files now, 4 expected by 10/18; misfiled research flagged to the Tech Admin
      const techScope = roleFilter === "Client Vault & Tech Administrator";
      if (isTeamLevel || techScope) {
        const researchDue = Date.parse("2026-10-18T23:59:59Z");
        const pastDue = now > researchDue;
        const inResearch = teamFiles.filter((f) => subsectionMatches(f.subsection, "Client research"));
        // Org charts are company materials filed under Organizational Chart, not client research.
        // Common misspellings (reaserch/reserach/reseach) must still be caught as research.
        const looksResearch = (f: { file_name?: string }) => /research|reaserch|reserach|reseach|resarch|company (profile|analysis|overview)|history|culture|location|competitor|industry|job[ -]description/i.test(f.file_name ?? "");
        const misfiled = teamFiles.filter((f) => !subsectionMatches(f.subsection, "Client research") && looksResearch(f));
        const total = inResearch.length + misfiled.length;
        const techAdmin = tm.find((m) => m.job_title === "Client Vault & Tech Administrator");
        const taName = techAdmin ? nameOf(techAdmin.user_id) : null;
        const taId = techAdmin?.user_id ?? null;
        const required = pastDue ? 4 : 2;
        notes.vault.push(RESEARCH_NOTE);
        if (total < required) {
          const { inspectResearch } = await import("./health-research.server");
          const research = await inspectResearch(db, [...inResearch, ...misfiled]);
          researchByTeam.set(t.teamId, research);
          const missing = research.topics.filter(topic => !topic.evidence.length).map(topic => topic.topic);
          if (!missing.length) {
            notes.vault.push(`All four research topics have text evidence across ${total} file(s). Combined documents accepted; content quality is not graded automatically.`);
            observe("vault:research", "All four required research topics have supporting text excerpts in the uploaded documents.");
          } else if (research.unreadable.length) {
            notes.vault.push(`Research coverage unverified: ${research.unreadable.join(", ")} could not be read. Do not infer missing research from file count.`);
            push("vault", "yellow", `Research coverage unable to verify: ${research.unreadable.join(", ")} could not be read. Instructor review required; this is not a finding of missing content.`, null, null, null, "vault:research");
            observe("vault:research", "Research coverage requires instructor review because some documents could not be read.", missing.length, false);
          } else {
            push("vault", pastDue ? "red" : "yellow", `Client research: ${total} file(s); no text evidence found for ${missing.join(", ")}. Expected ${required} files or combined coverage of all four topics. Please add the content or identify where it appears.`, null, null, null, "vault:research");
            observe("vault:research", "Research topics without supporting text evidence.", missing.length);
          }
        } else {
          notes.vault.push(`Client research file-count expectation met: ${total} files (${required} expected). Topic coverage has not been inspected because the count is met.`);
          observe("vault:research", "File count met; topic coverage has not been verified.", 0, false);
        }
        const seenMisfiled = new Set<string>();
        for (const f of misfiled) {
          const dedupeKey = `${f.file_name}|${f.subsection}`;
          if (seenMisfiled.has(dedupeKey)) continue;
          seenMisfiled.add(dedupeKey);
          push("vault", "yellow", `"${f.file_name}" looks like client research but is filed under ${f.subsection} — move it to Client research.`, taName, "Client Vault & Tech Administrator", taId, `vault:misfiled:${f.id}`);
        }
        if (!misfiled.length && inResearch.length) notes.vault.push("All research files are filed in the Client research folder.");
      }

      // 6b. Client Communications — graded relative to the client-confirmed date:
      //   not confirmed yet        -> not expected (neutral note)
      //   within 3 weeks of confirm -> any file = green; none yet = not expected (neutral note)
      //   3+ weeks after confirm    -> 0 files = red, 1 = yellow, 2+ = green
      if (isTeamLevel) {
        const comms = teamFiles.filter((f) => subsectionMatches(f.subsection, "Client Communications"));
        // Correspondence filed anywhere else is misfiled: flag it to the Tech Admin (never moved automatically).
        const looksComms = (f: { file_name?: string }) => /client.{0,20}(email|e-mail|mail|text|message|correspondence|communication)|(email|e-mail|text|message|correspondence).{0,20}client/i.test(f.file_name ?? "");
        const misfiledComms = teamFiles.filter((f) => !subsectionMatches(f.subsection, "Client Communications") && looksComms(f));
        const commsAdmin = tm.find((m) => m.job_title === "Client Vault & Tech Administrator");
        for (const f of misfiledComms)
          push("vault", "yellow", `"${f.file_name}" looks like client communication but is filed under ${f.subsection} — move it to Client Communications.`, commsAdmin ? nameOf(commsAdmin.user_id) : null, "Client Vault & Tech Administrator", commsAdmin?.user_id ?? null, "vault:Client Communications");
        const cfRow = (companyFocus ?? []).find((c) => c.team_id === t.teamId);
        const confirmedAt = cfRow?.confirmed_at ? Date.parse(cfRow.confirmed_at) : null;
        if (confirmedAt === null || Number.isNaN(confirmedAt)) {
          notes.vault.push("Client Communications: client not confirmed yet — correspondence is expected within 3 weeks of confirmation.");
        } else {
          const weeksSince = (now - confirmedAt) / (7 * DAY);
          const dueDate = new Date(confirmedAt + 21 * DAY).toISOString().slice(0, 10);
          if (weeksSince < 3) {
            if (comms.length)
              notes.vault.push(`Client Communications: ${comms.length} file${comms.length === 1 ? "" : "s"} filed within 3 weeks of confirmation — on track.`);
            else
              notes.vault.push(`Client Communications: none filed yet — not expected until 3 weeks after confirmation (${dueDate}).`);
          } else if (!comms.length) {
            push("vault", "red", `Client Communications: no client emails or texts filed — expected since 3 weeks after confirmation (${dueDate}).`);
          } else if (comms.length === 1) {
            push("vault", "yellow", `Client Communications: only 1 client email or text filed — 2+ expected 3+ weeks after confirmation (${dueDate}).`);
          } else {
            notes.vault.push(`Client Communications on track: ${comms.length} files filed (2+ expected 3+ weeks after confirmation).`);
          }
        }
      }

      // 6c. Misfiled minutes, agendas and interview questions — flagged to the role that owns
      // that content (minutes: Communication Specialist, agendas: PM, questions: Company Liaison).
      // Files are flagged, never moved automatically.
      if (isTeamLevel) {
        const misfileChecks: { match: RegExp; subsection: string; label: string; role: string }[] = [
          { match: /minutes|meeting[ -]?notes/i, subsection: "Minutes", label: "meeting minutes", role: "Communication Specialist" },
          { match: /agenda/i, subsection: "Agendas", label: "a meeting agenda", role: "PM" },
          { match: /intervie?w|interveiw/i, subsection: "Interview Questions", label: "interview questions", role: "Company Liaison" },
        ];
        for (const check of misfileChecks) {
          const owner = tm.find((m) => m.job_title === check.role);
          const seen = new Set<string>();
          for (const f of teamFiles.filter((f) =>
            !subsectionMatches(f.subsection, check.subsection) &&
            // The shared Meeting Minutes Template legitimately lives in Operational Resources and Templates.
            !/^Meeting Minutes Template/i.test(f.file_name ?? "") &&
            check.match.test(f.file_name ?? ""))) {
            // Duplicate uploads of the same file into the same wrong folder are one finding, not many.
            const dedupeKey = `${f.file_name}|${f.subsection}`;
            if (seen.has(dedupeKey)) continue;
            seen.add(dedupeKey);
            push("vault", "yellow", `"${f.file_name}" looks like ${check.label} but is filed under ${f.subsection} — move it to ${check.subsection}.`, owner ? nameOf(owner.user_id) : null, check.role, owner?.user_id ?? null, `vault:misfiled:${f.id}`);
          }
        }
      }

      // Latest shared report only: historical openings cannot establish current follow-through.
      if (isTeamLevel) {
        const share = latestShare(t.teamId);
        if (share) {
          for (const m of tm) {
            const v = (reportViews ?? []).find((x: any) => x.user_id === m.user_id && (share.vault_file_id ? x.file_id === share.vault_file_id : x.team_id === t.teamId) && x.last_viewed_at >= share.shared_at && (!share.vault_version_id || x.last_version_id === share.vault_version_id));
            const nm = nameOf(m.user_id);
            const opened = !!v && v.view_count > 0;
            const ruleId = `reports:opened:${m.user_id}`;
            if (opened) notes.reports.push(`${nm}: ${share.source === "legacy_email_matched" ? "historical team-vault opening after the shared date (exact report version unverified)" : "recorded opening of the report shared"} ${share.shared_at.slice(0, 10)}; last opened ${v.last_viewed_at}. Opening is not proof of reading or understanding.`);
            else push("reports", "yellow", `No recorded opening of the report shared ${share.shared_at.slice(0, 10)}. Staying current with feedback is a team accountability concern, especially before peer review. Teammates should follow up. Emailed PDF reading is not independently tracked.`, nm, m.job_title, m.user_id, ruleId);
            observe(ruleId, `${nm} has now opened the latest shared report.`, opened ? 0 : 1, share.source !== "legacy_email_matched");
          }
        } else notes.reports.push("No verified prior shared report baseline is available; member follow-through cannot yet be assessed.");
      }
    }

    // Per-concern escalation across consecutive shared reports (team-level runs only):
    // each warning is tracked independently; a 2nd consecutive appearance turns red,
    // a 3rd adds a grade-deduction notice. Addressing one warning resets only that one.
    const streaksByTeam = new Map<string, Map<string, number>>();
    if (!roleFilter) {
      const { escalateConcerns } = await import("./health-review-escalation");
      for (const t of sorted) {
        const mine = out.filter((e) => e.teamId === t.teamId);
        if (!mine.length) continue;
        const priors = (shares ?? [])
          .filter((s: any) => s.team_id === t.teamId)
          .map((s: any) => ((s.payload as { exceptions?: HealthException[] })?.exceptions ?? []).filter((e) => !PARFUNKEL.test(e.person ?? "")));
        const escalated = escalateConcerns(mine, priors);
        const streaks = new Map<string, number>();
        // Replace in place, preserving order.
        let i = 0;
        for (let k = 0; k < out.length; k++) {
          if (out[k].teamId !== t.teamId) continue;
          const { concern, streak } = escalated[i++];
          out[k] = concern;
          const key = concern.ruleId ?? concernKey(concern);
          if (key) streaks.set(key, streak);
        }
        streaksByTeam.set(t.teamId, streaks);
      }
    }

    const CHECK_KEYS: HealthCheck[] = ["gaps", "readiness", "meetings", "activity", "vault", "reports"];
    const worst = new Map<string, "red" | "yellow">();
    for (const e of out) {
      const k = `${e.teamId}:${e.check}`;
      worst.set(k, e.level === "red" ? "red" : (worst.get(k) ?? "yellow"));
    }

    const teamResults: TeamCheckResult[] = sorted.map((t) => {
      const label = teamLineLabel({ name: t.teamRecordName, display_name: t.teamName !== t.teamRecordName ? t.teamName : null, section: t.section });
      const roster = (members ?? []).filter((m) => m.team_id === t.teamId && !PARFUNKEL.test(nameOf(m.user_id)));
      const noRole = !!roleFilter && !roster.some((m) => m.job_title === roleFilter);
      const teamLevel = !roleFilter;
      const pmScope = roleFilter === "PM";
      const hasReport = !!latestShare(t.teamId);
      const results = {} as Record<HealthCheck, CheckStatus>;
      for (const c of CHECK_KEYS) {
        const applicable =
          !noRole &&
          (c !== "gaps" || teamLevel || pmScope) &&
          (c !== "meetings" || ((teamLevel || pmScope) && week >= 3)) &&
          (c !== "reports" || (teamLevel && hasReport));
        results[c] = !applicable ? "skipped" : worst.has(`${t.teamId}:${c}`) ? "flagged" : "pass";
      }
      return {
        teamId: t.teamId,
        teamLabel: label,
        section: t.section,
        observations: observationsByTeam.get(t.teamId) ?? [],
        research: researchByTeam.get(t.teamId),
        comparison: roleFilter ? undefined : (() => {
          const share = latestShare(t.teamId);
          if (!share) return { sharedAt: null, source: "No verified shared baseline", changes: [] };
          const payload = share.payload as { exceptions?: HealthException[]; team?: TeamCheckResult };
          return { sharedAt: share.shared_at, source: share.source, streaks: Object.fromEntries(streaksByTeam.get(t.teamId) ?? []), changes: compareConcerns((payload.exceptions ?? []).filter(e => !PARFUNKEL.test(e.person ?? "")), out.filter(e => e.teamId === t.teamId), observationsByTeam.get(t.teamId) ?? [], payload.team?.observations ?? []) };
        })(),
        peopleChecked: (roleFilter ? roster.filter((m) => m.job_title === roleFilter) : roster).length,
        results,
        passNotes: passNotesByTeam.get(t.teamId) ?? { gaps: [], readiness: [], meetings: [], activity: [], vault: [], reports: [] },
      };
    });

    // Per-person ranking for role scope: cleanest first, most problems last.
    const ranking: PersonRank[] = [];
    if (roleFilter) {
      for (const t of sorted) {
        const label = teamLineLabel({ name: t.teamRecordName, display_name: t.teamName !== t.teamRecordName ? t.teamName : null, section: t.section });
        const holders = (members ?? []).filter((mm) => mm.team_id === t.teamId && mm.job_title === roleFilter && !PARFUNKEL.test(nameOf(mm.user_id)));
        for (const h of holders) {
          const mine = out.filter((e) => e.userId === h.user_id);
          const red = mine.filter((e) => e.level === "red").length;
          const yellow = mine.length - red;
          ranking.push({ userId: h.user_id, name: nameOf(h.user_id), teamLabel: label, red, yellow, total: mine.length });
        }
      }
      ranking.sort((a, b) => a.red - b.red || a.yellow - b.yellow || a.name.localeCompare(b.name));
    }

    const result = {
      generatedAt,
      week,
      progress,
      teamsChecked: sorted.length,
      peopleChecked: people,
      teamResults,
      exceptions: out,
      ranking,
      reportId: null as string | null,
    };

    return result;
}
