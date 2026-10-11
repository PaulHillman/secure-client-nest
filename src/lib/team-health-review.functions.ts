import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildAssessments } from "@/lib/team-readiness-assessment.functions";
import { teamLineLabel, compareTeamsBySectionThenNumber } from "@/lib/team-label";
import { subsectionMatches } from "@/lib/vault-structure";

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
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");

    const { assessments, generatedAt } = await buildAssessments(data.scope === "team" ? data.teamId : undefined);
    let teams = assessments.filter((a) => data.scope === "team" || !a.isTest);
    if (data.scope === "section") teams = teams.filter((a) => a.section === data.section);
    const roleFilter = data.scope === "role" ? data.role! : null;
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
    const [{ data: members }, { data: logs }, { data: files }, { data: norms }, { data: profiles }, { data: reportViews }] = await Promise.all([
      db.from("team_members").select("team_id, user_id, job_title").in("team_id", ids),
      db.from("meeting_logs").select("team_id, meeting_date, attendance, minutes_posted").in("team_id", ids),
      db.from("files").select("team_id, section, subsection, file_name, uploaded_by, is_template, is_locked").in("team_id", ids),
      db.from("group_norms").select("team_id, version, group_norms_signatures(user_id, version)").in("team_id", ids),
      db.from("profiles").select("id, name, first_name, last_name, email"),
      db.from("health_report_views").select("user_id, team_id, view_count, clicked_at, last_viewed_at").in("team_id", ids),
    ]);
    const userIds = [...new Set((members ?? []).map((m) => m.user_id))];
    const [{ data: auths }, { data: usage }, { data: versions }, { data: sessions }] = await Promise.all([
      db.from("auth_audit_log").select("user_id, created_at").in("user_id", userIds).gte("created_at", since),
      db.from("usage_events").select("user_id, created_at").eq("event", "page_view").in("user_id", userIds).gte("created_at", since).limit(20000),
      db.from("file_versions").select("uploaded_by, uploaded_at").in("uploaded_by", userIds).gte("uploaded_at", since),
      // Authoritative sign-in/session activity straight from the auth system (admin-only function).
      context.supabase.rpc("auth_activity_since", { _since: since }),
    ]);

    const nameOf = (id: string) => {
      const p = (profiles ?? []).find((x) => x.id === id);
      return (p?.first_name && p?.last_name ? `${p.first_name} ${p.last_name}` : p?.name || p?.email) || "Unknown student";
    };
    const days = new Map<string, Set<string>>();
    const sessionRows = (sessions ?? []).map((s) => ({ user_id: s.user_id, created_at: s.active_at }));
    for (const r of [...(auths ?? []), ...(usage ?? []), ...sessionRows]) {
      if (!r.user_id || !r.created_at) continue;
      if (!days.has(r.user_id)) days.set(r.user_id, new Set());
      days.get(r.user_id)!.add(String(r.created_at).slice(0, 10));
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
      const push = (check: HealthCheck, level: "red" | "yellow", reason: string, person: string | null = null, role: string | null = null, userId: string | null = null) =>
        out.push({ check, level, teamId: t.teamId, teamLabel: label, section: t.section, person, role, userId, reason });
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
          if (!gn) push("gaps", "yellow", "Group Norms not written yet.");
          else if (missing.length) push("gaps", "yellow", `Group Norms version ${gn.version} not signed by: ${missing.map(nameOf).join(", ")}.`);
          else notes.gaps.push(`Group Norms version ${gn.version} signed by all ${roster.length} members.`);
        }
        if (t.setup.meetingState !== "complete") push("gaps", "yellow", "No weekly meeting consensus yet.");
        else notes.gaps.push("Weekly meeting time agreed by the team.");
      }

      // 2. Team Readiness
      if (isTeamLevel) {
        for (const b of t.blockers) push("readiness", "red", b.reason);
        for (const w of t.warnings) push("readiness", "yellow", w.reason);
        if (!t.blockers.length && !t.warnings.length) notes.readiness.push("No readiness concerns — all readiness checks came back clean.");
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

      // 3. Weekly Meetings — itemized sub-checks: (a) meetings logged, (b) recency, (c) minutes per meeting, (d) reason per absence
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
        const noMinutes = teamLogs.filter((l) => !l.minutes_posted).length;
        if (noMinutes) { failed += noMinutes; push("meetings", "yellow", `${noMinutes} of ${teamLogs.length} logged meeting${teamLogs.length === 1 ? " has" : "s have"} no minutes posted.`); }
        if (teamLogs.length - noMinutes > 0) { passed += teamLogs.length - noMinutes; notes.meetings.push(`Minutes posted for ${teamLogs.length - noMinutes} of ${teamLogs.length} logged meeting${teamLogs.length === 1 ? "" : "s"}.`); }
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
        notes.meetings.unshift(`Weekly Meetings sub-checks: ${passed} passed, ${failed} flagged (meetings logged, recency vs. 7-day limit, minutes per meeting, reason per absence).`);
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
      }

      // 5. Semester-aware File Vault requirements
      const expectedMinutes = Math.max(0, week - 3);
      if ((isTeamLevel || pmScope) && expectedMinutes > 0) {
        const mins = count("Minutes");
        if (mins < expectedMinutes) push("vault", mins < expectedMinutes / 2 ? "red" : "yellow", `Minutes: ${mins} posted, ${expectedMinutes} expected by week ${week}.`);
        else notes.vault.push(`Minutes on file: ${mins} (${expectedMinutes} expected by week ${week}).`);
        const ag = count("Agendas");
        if (ag < expectedMinutes) push("vault", ag < expectedMinutes / 2 ? "red" : "yellow", `Agendas: ${ag} posted, ${expectedMinutes} expected by week ${week}.`);
        else notes.vault.push(`Agendas on file: ${ag} (${expectedMinutes} expected by week ${week}).`);
      }
      if (isTeamLevel && progress >= 0.5 && count("Mid-Semester Peer Reviews") === 0)
        push("vault", "yellow", "Mid-Semester Peer Reviews not uploaded (past semester midpoint).");
      if (isTeamLevel && progress >= 0.4 && !teamFiles.some((f) => f.section === "Semester Long Project" && f.subsection === "Interview Questions"))
        push("vault", "yellow", "No Interview Questions uploaded (expected by 40% of semester).");
      if ((isTeamLevel || vidScope) && progress >= 0.6 && !teamFiles.some((f) => f.section === "Video"))
        push("vault", vidScope ? "red" : "yellow", "No Video files uploaded (expected by 60% of semester).", null, vidScope ? "Video Specialist" : null);
      if ((isTeamLevel || vidScope) && progress >= 0.9 && !teamFiles.some((f) => f.section === "Video" && f.subsection === "Final Submission"))
        push("vault", "red", "Video Final Submission not uploaded.");

      // 6. Client research: at least 2 files now, 4 expected by 10/18; misfiled research flagged to the Tech Admin
      const techScope = roleFilter === "Client Vault & Tech Administrator";
      if (isTeamLevel || techScope) {
        const researchDue = Date.parse("2026-10-18T23:59:59Z");
        const pastDue = now > researchDue;
        const inResearch = teamFiles.filter((f) => f.section === "Team Documents" && subsectionMatches(f.subsection, "Client research"));
        const looksResearch = (f: { file_name?: string }) => /research|org[ -]?chart|company (profile|analysis|overview)|history|culture|location|competitor|industry|job[ -]description/i.test(f.file_name ?? "");
        const misfiled = teamFiles.filter((f) => !subsectionMatches(f.subsection, "Client research") && looksResearch(f));
        const total = inResearch.length + misfiled.length;
        const techAdmin = tm.find((m) => m.job_title === "Client Vault & Tech Administrator");
        const taName = techAdmin ? nameOf(techAdmin.user_id) : null;
        const taId = techAdmin?.user_id ?? null;
        if (total < 2)
          push("vault", pastDue ? "red" : "yellow", `Client research: ${total} file${total === 1 ? "" : "s"} found — at least 2 expected now, 4 expected by 10/18.`);
        else if (pastDue && total < 4)
          push("vault", "red", `Client research: ${total} file${total === 1 ? "" : "s"} found — 4 expected by 10/18.`);
        else notes.vault.push(`Client research on track: ${total} file${total === 1 ? "" : "s"} found (${pastDue ? "4 expected by 10/18" : "at least 2 expected now, 4 by 10/18"}).`);
        for (const f of misfiled)
          push("vault", "yellow", `"${f.file_name}" looks like client research but is filed under ${f.subsection} — move it to Client research.`, taName, "Client Vault & Tech Administrator", taId);
        if (!misfiled.length && inResearch.length) notes.vault.push("All research files are filed in the Client research folder.");
      }

      // 7. Health Report follow-up: has each member opened their team's health review report?
      if (isTeamLevel) {
        const hasReport = teamFiles.some((f) => subsectionMatches(f.subsection, "Health Reports"));
        if (hasReport) {
          const views = (reportViews ?? []).filter((v) => v.team_id === t.teamId);
          for (const m of tm) {
            const v = views.find((x) => x.user_id === m.user_id);
            const nm = nameOf(m.user_id);
            if (v && (v.view_count > 0 || v.clicked_at)) {
              notes.reports.push(`${nm}: opened the team health report${v.view_count > 1 ? ` (${v.view_count} times)` : ""}${v.clicked_at ? " via the dashboard banner" : ""}.`);
            } else {
              push("reports", "yellow", "Has not opened the team's Health Review report yet.", nm, m.job_title, m.user_id);
            }
          }
        }
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
      const hasReport = (files ?? []).some((f) => f.team_id === t.teamId && !f.is_template && subsectionMatches(f.subsection, "Health Reports"));
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
  });
