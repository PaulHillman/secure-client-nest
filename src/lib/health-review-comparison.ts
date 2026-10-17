export type Concern = { check: string; level: "red" | "yellow"; reason: string; person?: string | null; userId?: string | null; ruleId?: string };
export type Observation = { ruleId: string; evidence: string; remaining?: number; verified: boolean };
export type Change = { status: "Resolved" | "Partially improved" | "Still outstanding" | "Unable to verify" | "New concern" | "Reporting correction"; previous: string | null; current: string; person: string | null };
export type Comparison = { sharedAt: string | null; source: string; changes: Change[] };
const LEGACY: Record<string, string> = {
 "No selection rationale recorded": "readiness:no_rationale", "Group Norms are not posted": "readiness:no_norms",
 "PM verification is missing": "readiness:pm_verification", "Company size was not provided": "readiness:no_size",
 "Company location was not provided": "readiness:no_location", "Client industry was not provided": "readiness:no_industry",
 "No manager contact recorded for the client": "readiness:no_manager", "Meeting time has not been entered": "readiness:meeting_time",
 "Meeting place has not been entered": "readiness:meeting_location", "Team name is missing": "readiness:team_name",
 "No Project Manager assigned": "readiness:no_pm", "The same role is held by more than one member": "readiness:duplicate_roles",
 "Client selection was sent back and has not been resubmitted": "readiness:client_sent_back",
 "Client location needs your review": "readiness:location_review",
};
export function concernKey(c: Concern): string | undefined {
 if (c.ruleId) return c.ruleId;
 if (c.check === "readiness") {
  const norms = /^Group Norms need clearer (communication|deadlines|accountability) detail$/.exec(c.reason);
  return norms ? `readiness:norms_${norms[1]}` : LEGACY[c.reason];
 }
 if (c.check === "gaps" && c.reason === "No weekly meeting consensus yet.") return "gaps:meeting";
 if (c.check === "meetings" && c.reason === "No weekly meetings logged this semester.") return "meetings:logged";
 return undefined;
}
export function compareConcerns(previous: Concern[], current: Concern[], observations: Observation[], previousObservations: Observation[] = []): Change[] {
 const changes: Change[] = []; const matched = new Set<Concern>();
 for (const old of previous) {
  if (/Group Norms.*not signed.*locked/i.test(old.reason)) {
   changes.push({ status: "Reporting correction", previous: old.reason, current: "The older report relied on a lock flag rather than current-version signatures. This is a reporting correction, not student-earned progress.", person: old.person ?? null }); continue;
  }
  const key = concernKey(old);
  const candidates = current.filter(c => key ? concernKey(c) === key : c.check === old.check && c.reason === old.reason && c.person === old.person);
  const next = candidates.length === 1 ? candidates[0] : undefined;
  const fact = key ? observations.find(o => o.ruleId === key) : undefined;
  const before = key ? previousObservations.find(o => o.ruleId === key) : undefined;
  if (next) {
   matched.add(next);
   const improved = fact?.verified && (old.level === "red" && next.level === "yellow" || typeof fact.remaining === "number" && typeof before?.remaining === "number" && fact.remaining < before.remaining);
   changes.push({ status: improved ? "Partially improved" : "Still outstanding", previous: old.reason, current: next.reason + (improved ? " Progress is evident; please finish the remaining work." : ""), person: next.person ?? old.person ?? null });
  } else if (fact?.verified && fact.remaining === 0) {
   changes.push({ status: "Resolved", previous: old.reason, current: `${fact.evidence} Thank you for addressing this deficiency—good follow-through.`, person: old.person ?? null });
  } else changes.push({ status: "Unable to verify", previous: old.reason, current: "The previous concern is not reproduced, but a reliable item-level match or supporting evidence is unavailable. Instructor review required; no improvement credited.", person: old.person ?? null });
 }
 for (const c of current) if (!matched.has(c)) changes.push({ status: concernKey(c) ? "New concern" : "Unable to verify", previous: null, current: c.reason, person: c.person ?? null });
 return changes;
}
export const RESEARCH_NOTE = "The four-file expectation represents company history/information, industry information, competitors, and the client's job description. These topics may be combined in one document; file count alone does not establish missing research.";
export const RESEARCH_TOPICS = ["Company history/information", "Industry information", "Competitors", "Client job description"] as const;
const patterns = [/\b(company history|history of|founded|established|company overview|company profile)\b/i, /\b(industry|sector|market trends)\b/i, /\b(competitors?|competition|competitive landscape)\b/i, /\b(job description|job responsibilities|duties|responsibilities of|client role)\b/i];
export function researchCoverage(documents: { fileName: string; text: string | null }[]) {
 return RESEARCH_TOPICS.map((topic, i) => ({ topic, evidence: documents.flatMap(d => {
  if (!d.text) return [];
  const match = patterns[i].exec(d.text); if (!match) return [];
  return [{ fileName: d.fileName, excerpt: d.text.slice(Math.max(0, match.index - 80), match.index + 220).replace(/\s+/g, " ") }];
 }) }));
}
