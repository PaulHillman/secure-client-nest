import type { TeamAssessment } from "@/lib/team-readiness-assessment";
import { WEST_MICHIGAN } from "@/lib/team-readiness-assessment";
import { ReadinessStatusBadge } from "@/components/readiness-status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

function when(value: string | null) {
  if (!value) return "Not recorded";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

function Field({
  label,
  value,
  note,
  highlight,
}: {
  label: string;
  value: string | null;
  note?: string | null;
  highlight?: "red" | "yellow";
}) {
  const tone =
    highlight === "red"
      ? `text-rose-700 ${HIGHLIGHT_RED}`
      : highlight === "yellow"
        ? `text-amber-800 ${HIGHLIGHT_YELLOW}`
        : undefined;
  return (
    <div className={`break-inside-avoid ${tone ?? ""}`}>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={value ? "text-sm" : "text-sm italic text-muted-foreground"}>
        {value ?? "Not provided"}
        {note && <span className="block text-xs text-muted-foreground not-italic">{note}</span>}
      </dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="break-inside-avoid print:border print:shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

const CHECK_ICON = {
  found: CheckCircle2,
  missing: XCircle,
  needs_clarification: XCircle,
} as const;

const CHECK_TONE = {
  found: "text-emerald-400",
  missing: "text-rose-400",
  needs_clarification: "text-rose-400",
} as const;

const CHECK_LABEL = {
  found: "Found",
  missing: "Missing",
  needs_clarification: "Too vague",
} as const;

/* Highlighter treatments so flagged items keep drawing the eye on paper. */
const HIGHLIGHT_RED =
  "rounded-md border-l-4 border-rose-600 bg-rose-100 px-3 py-2 print:bg-rose-100 print:border-rose-600";
const HIGHLIGHT_YELLOW =
  "rounded-md border-l-4 border-amber-500 bg-amber-100 px-3 py-2 print:bg-amber-100 print:border-amber-500";

/* Inline marker-pen treatments used inside the posted document itself. */
const MARK_RED =
  "rounded-sm bg-rose-200 px-0.5 font-medium text-rose-900 decoration-rose-500 underline decoration-2 print:bg-rose-200";
const MARK_YELLOW = "rounded-sm bg-amber-200 px-0.5 text-amber-950 print:bg-amber-200";

type Mark = { start: number; end: number; tone: "red" | "yellow"; reason: string };

/** Every place `needle` occurs in `hay`, case-insensitively. */
function occurrences(hay: string, needle: string): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = [];
  if (!needle.trim()) return out;
  const h = hay.toLowerCase();
  const n = needle.toLowerCase();
  let from = 0;
  for (;;) {
    const i = h.indexOf(n, from);
    if (i === -1) break;
    out.push({ start: i, end: i + n.length });
    from = i + n.length;
  }
  return out;
}

/**
 * Highlights the exact wording that produced a flag, in place, without
 * rewriting a single character of what the team wrote. Red wins over yellow
 * where they overlap; anything that no longer matches is simply not marked and
 * stays in the list of findings below.
 */
function MarkedText({ text, marks }: { text: string; marks: Mark[] }) {
  const sorted = [...marks].sort((a, b) => (a.start - b.start) || (b.end - a.end));
  const kept: Mark[] = [];
  for (const m of sorted) {
    const clash = kept.find((k) => m.start < k.end && k.start < m.end);
    if (!clash) {
      kept.push(m);
      continue;
    }
    // A red phrase inside a yellow sentence replaces the yellow band.
    if (m.tone === "red" && clash.tone === "yellow") {
      kept.splice(kept.indexOf(clash), 1, m);
    }
  }
  kept.sort((a, b) => a.start - b.start);

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  kept.forEach((m, i) => {
    if (m.start > cursor) parts.push(text.slice(cursor, m.start));
    parts.push(
      <mark key={i} className={m.tone === "red" ? MARK_RED : MARK_YELLOW} title={m.reason}>
        {text.slice(m.start, m.end)}
      </mark>,
    );
    cursor = m.end;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

/**
 * The one report body. The online page and the print/PDF page both render this,
 * so what is on screen is exactly what prints.
 */
export function TeamReadinessReport({ a }: { a: TeamAssessment }) {
  const proofPct = a.proofsRequired ? Math.round((a.proofsCompleted / a.proofsRequired) * 100) : 0;

  return (
    <div className="space-y-4 print:space-y-3 print:text-[11pt]">
      {/* 1. Overview */}
      <Section title="Team overview">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-display text-2xl">{a.teamName}</span>
          <ReadinessStatusBadge color={a.color} />
          {a.isTest && <span className="text-xs text-muted-foreground">Test fixture — excluded from totals</span>}
        </div>
        <dl className="grid gap-3 sm:grid-cols-3">
          <Field label="Team record name" value={a.teamRecordName} />
          <Field label="Team number" value={a.teamNumber !== null ? String(a.teamNumber) : null} />
          <Field label="Section" value={a.section ? `Section ${a.section}` : null} />
          <Field
            label="Proof completion"
            value={`${a.proofsCompleted} of ${a.proofsRequired} submitted (${proofPct}%)`}
            note="Participation completion only."
          />
          <Field label="Status" value={a.colorLabel} />
          <Field label="Last refreshed" value={when(a.generatedAt)} />
        </dl>

        <div>
          <h3 className="text-sm font-medium">Action required</h3>
          {a.blockers.length === 0 ? (
            <p className="text-sm text-muted-foreground">None.</p>
          ) : (
            <ul className="mt-1 space-y-1 text-sm">
              {a.blockers.map((b, i) => (
                <li key={`${b.key}-${i}`} className="flex gap-2">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" aria-hidden />
                  <span>
                    <span className="font-medium">{b.reason}</span>
                    {b.detail && <span className="text-muted-foreground"> — {b.detail}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="text-sm font-medium">Warnings</h3>
          {a.warnings.length === 0 ? (
            <p className="text-sm text-muted-foreground">None.</p>
          ) : (
            <ul className="mt-1 space-y-1 text-sm">
              {a.warnings.map((w, i) => (
                <li key={`${w.key}-${i}`} className="flex gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
                  <span>
                    <span className="font-medium">{w.reason}</span>
                    {w.detail && <span className="text-muted-foreground"> — {w.detail}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="text-sm font-medium">Recommended discussion priorities</h3>
          {a.priorities.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing outstanding before the kickoff meeting.
            </p>
          ) : (
            <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">
              {a.priorities.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ol>
          )}
        </div>
      </Section>

      {/* 2. Team setup */}
      <Section title="Team setup">
        <dl className="grid gap-3 sm:grid-cols-3">
          <Field label="Team name" value={a.setup.teamNameState === "complete" ? a.teamName : null} />
          <Field label="Meeting day" value={a.setup.meetingDay} />
          <Field label="Meeting time" value={a.setup.meetingTime} />
          <Field label="Meeting place" value={a.setup.meetingLocation} />
          <Field label="Communication / meeting method" value={a.setup.communicationMethod} />
          <Field
            label="Members"
            value={a.members.length ? `${a.members.length} on the roster` : null}
          />
        </dl>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-1 pr-2">Member</th>
              <th className="py-1 pr-2">Assigned role</th>
              <th className="py-1 pr-2">Meeting agreed</th>
              <th className="py-1">Norms agreed</th>
            </tr>
          </thead>
          <tbody>
            {a.members.map((m) => (
              <tr key={m.userId} className="border-b border-border/50 break-inside-avoid">
                <td className="py-1 pr-2">{m.name}</td>
                <td className="py-1 pr-2">
                  {m.hasRole ? m.role : <span className="text-rose-400">No role assigned</span>}
                </td>
                <td className="py-1 pr-2">{m.agreedToMeeting ? "Yes" : "No"}</td>
                <td className="py-1">{m.agreedToNorms ? "Yes" : "No"}</td>
              </tr>
            ))}
            {a.members.length === 0 && (
              <tr>
                <td colSpan={4} className="py-2 text-muted-foreground">
                  No members on this team.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {a.setup.duplicateRoles.length > 0 && (
          <p className="text-sm text-rose-400">
            Duplicate role assignments: {a.setup.duplicateRoles.join("; ")}
          </p>
        )}
        {a.setup.missingRoles.length > 0 && (
          <p className="text-sm text-amber-400">Roles not filled: {a.setup.missingRoles.join(", ")}</p>
        )}
        {a.setup.missingFields.length > 0 ? (
          <p className="text-sm text-amber-400">
            Missing team setup fields: {a.setup.missingFields.join(", ")}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Every team setup field is recorded.</p>
        )}
      </Section>

      {/* 3. Member readiness table */}
      <Section title="Member readiness">
        <p className="text-xs text-muted-foreground">
          No formal quality judgment recorded; completion status and available feedback are shown.
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-1 pr-2">Member</th>
              <th className="py-1 pr-2">Role</th>
              <th className="py-1 pr-2">Required</th>
              <th className="py-1 pr-2">Completed</th>
              <th className="py-1 pr-2">Missing</th>
              <th className="py-1 pr-2">Status</th>
              <th className="py-1 pr-2">Feedback</th>
              <th className="py-1">Follow-up</th>
            </tr>
          </thead>
          <tbody>
            {a.members.map((m) => {
              const fb = m.proofs.filter((p) => p.feedback && p.feedback.trim()).length;
              return (
                <tr key={m.userId} className="border-b border-border/50 break-inside-avoid align-top">
                  <td className="py-1 pr-2">{m.name}</td>
                  <td className="py-1 pr-2">{m.hasRole ? m.role : "No role"}</td>
                  <td className="py-1 pr-2">{m.requiredProofs}</td>
                  <td className="py-1 pr-2">{m.completedProofs}</td>
                  <td className="py-1 pr-2">{m.missingProofs}</td>
                  <td className="py-1 pr-2">{m.statusLabel}</td>
                  <td className="py-1 pr-2">
                    {m.completedProofs === 0 ? "Not applicable" : fb ? `${fb} available` : "Pending"}
                  </td>
                  <td className="py-1 max-w-[16rem] whitespace-normal">{m.followUp ?? "—"}</td>
                </tr>
              );
            })}
            {a.members.length === 0 && (
              <tr>
                <td colSpan={8} className="py-2 text-muted-foreground">
                  No members on this team.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Section>

      {/* 4. Client information */}
      <Section title="Client information">
        {!a.client.present ? (
          <p className="text-base font-medium text-rose-400">No client selected.</p>
        ) : (
          <>
            <dl className="grid gap-3 sm:grid-cols-3">
              <Field label="Company" value={a.client.companyName} />
              <Field label="Industry" value={a.client.industry} />
              <Field label="Manager name" value={a.client.managerName} />
              <Field label="Manager title" value={a.client.managerTitle} />
              <Field label="Manager email" value={a.client.email} />
              <Field label="Website" value={a.client.website} />
              <Field label="Company size" value={a.client.companySize} />
              <Field label="Company location" value={a.client.location} note={a.client.locationNote} />
              <Field label="Submitted by" value={a.client.submittedBy} />
              <Field label="Submission date" value={when(a.client.submittedAt)} />
              <Field label="Proposal status" value={a.client.proposalStatus} />
              <Field label="Professor decision" value={a.client.professorDecision} />
            </dl>
            <Field label="Selection rationale" value={a.client.rationale} />
            {a.client.locationVerdict === "outside" && (
              <p className="text-sm text-amber-400">
                This location reads as outside {WEST_MICHIGAN.label}. Warning only — it does not by
                itself require action.
              </p>
            )}
            {a.client.locationVerdict === "review" && (
              <p className="text-sm text-amber-400">
                The location is not on the configured {WEST_MICHIGAN.label} list — shown for your review
                rather than guessed.
              </p>
            )}
          </>
        )}
      </Section>

      {/* 5. Member cards */}
      <Section title="Member cards">
        <div className="grid gap-3 sm:grid-cols-2 print:grid-cols-2">
          {a.members.map((m) => {
            const scored = m.proofs.filter((p) => p.score != null && p.maxScore);
            // Per activity: how much of the expected coverage was missed.
            const points: number[] = scored.map((p) => {
              const missedRatio = ((p.maxScore ?? 0) - (p.score ?? 0)) / (p.maxScore ?? 1);
              return missedRatio <= 0.4 ? 2 : missedRatio <= 0.6 ? 1 : 0;
            });
            const avg = points.length ? points.reduce((t, n) => t + n, 0) / points.length : null;
            const band = avg == null ? null : avg >= 1.5 ? "green" : avg >= 0.75 ? "yellow" : "red";
            const dot =
              band == null
                ? "bg-muted-foreground/40"
                : band === "green"
                  ? "bg-emerald-500"
                  : band === "yellow"
                    ? "bg-amber-400"
                    : "bg-rose-500";
            const gradeLabel =
              band == null
                ? "Overall: not measured"
                : band === "green"
                  ? "Overall: green — little or nothing missed"
                  : band === "yellow"
                    ? "Overall: yellow — some gaps"
                    : "Overall: red — a lot missed";
            return (
            <div key={m.userId} className="break-inside-avoid rounded-lg border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-medium">
                  <span
                    className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${dot}`}
                    aria-hidden="true"
                  />
                  {m.name}
                </span>
                <span className="text-xs text-muted-foreground">{m.hasRole ? m.role : "No role assigned"}</span>
              </div>
              <p className="mt-1 text-xs font-medium">
                <span className="sr-only">{m.name}: </span>
                {gradeLabel}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {m.completedProofs}/{m.requiredProofs} activities submitted · {m.statusLabel}
              </p>

              <ul className="mt-2 space-y-2">
                {m.proofs.map((p) => (
                  <li key={p.key} className="rounded border border-border/60 p-2">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="font-medium">{p.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {p.submitted ? "Submitted" : "Not submitted"} ·{" "}
                        {p.feedbackState === "not_applicable"
                          ? "Feedback not applicable"
                          : p.feedbackState === "available"
                            ? "Feedback available"
                            : p.feedbackState === "pending"
                              ? "Feedback pending"
                              : "Feedback unavailable"}
                      </span>
                    </div>
                    {p.score != null && p.maxScore ? (
                      (() => {
                        const missedRatio = (p.maxScore - p.score) / p.maxScore;
                        const b = missedRatio <= 0.4 ? "green" : missedRatio <= 0.6 ? "yellow" : "red";
                        return (
                          <p className="mt-1 flex items-center gap-1.5 text-xs font-medium">
                            <span
                              className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                                b === "green"
                                  ? "bg-emerald-500"
                                  : b === "yellow"
                                    ? "bg-amber-400"
                                    : "bg-rose-500"
                              }`}
                              aria-hidden="true"
                            />
                            Coverage:{" "}
                            {b === "green"
                              ? "green — little or nothing missed"
                              : b === "yellow"
                                ? "yellow — some gaps"
                                : "red — a lot missed"}
                          </p>
                        );
                      })()
                    ) : p.submitted ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Coverage: not measured yet
                      </p>
                    ) : null}
                    {p.feedback && p.feedback.trim() ? (
                      <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{p.feedback}</p>
                    ) : null}
                    {p.reviewStatus === "needs_revision" || p.reviewStatus === "sent_back" ? (
                      <p className="mt-1 text-xs text-amber-400">This activity was sent back for revision.</p>
                    ) : null}
                  </li>
                ))}
                {m.proofs.length === 0 && (
                  <li className="text-xs text-muted-foreground">
                    No practice activities apply until a role is assigned.
                  </li>
                )}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">{m.feedbackSummary}</p>
              <p className="mt-2 text-xs">
                <span className="font-medium">Question to ask:</span> {m.suggestedQuestion}
              </p>
              <p className="text-xs">
                <span className="font-medium">Next action:</span> {m.nextAction}
              </p>
            </div>
            );
          })}

        </div>
      </Section>

      {/* 6. Group Norms */}
      <Section title="Group Norms assessment">
        {!a.norms.posted ? (
          <p className="text-base font-medium text-rose-400">Group Norms are not posted.</p>
        ) : (
          <>
            <dl className="grid gap-3 sm:grid-cols-3">
              <Field label="Current version" value={a.norms.version !== null ? `v${a.norms.version}` : null} />
              <Field label="Date posted / last saved" value={when(a.norms.postedAt)} />
              <Field
                label="PM verification"
                value={a.norms.pmVerified ? "Complete" : "Missing"}
                note={a.norms.pmVerificationNote}
                highlight={a.norms.pmVerified ? undefined : "red"}
              />
              <Field
                label="Agreed to current version"
                value={a.norms.agreed.length ? a.norms.agreed.join(", ") : null}
              />
              <Field
                label="Not yet agreed"
                value={a.norms.notAgreed.length ? a.norms.notAgreed.join(", ") : "Everyone has agreed"}
                highlight={a.norms.notAgreed.length > 0 ? "yellow" : undefined}
              />
              <Field
                label="Renewed agreement needed"
                value={a.norms.newerVersionNeedsAgreement ? "Yes — the norms changed after some members agreed" : "No"}
                highlight={a.norms.newerVersionNeedsAgreement ? "yellow" : undefined}
              />
            </dl>

            {a.norms.document.length > 0 && (
              <div className="break-inside-avoid">
                <h3 className="text-sm font-medium">The posted document</h3>
                <div className="mt-1 max-h-48 overflow-y-auto rounded-md border bg-muted/30 p-3 print:max-h-none print:overflow-visible">
                  {a.norms.document.map((d) => (
                    <div key={d.label} className="mb-3 last:mb-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {d.label}
                      </p>
                      <p className="whitespace-pre-wrap text-sm leading-6">{d.text}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-1 text-xs text-muted-foreground print:hidden">
                  Scroll to read the whole document. It prints in full.
                </p>
              </div>
            )}

            {a.norms.missingSections.length > 0 && (
              <p className={`text-sm text-rose-700 ${HIGHLIGHT_RED}`}>
                Blank sections: {a.norms.missingSections.join(", ")}
              </p>
            )}

            {a.norms.categories.map((cat) => {
              const flagged = cat.items.filter((item) => item.status !== "found");
              if (flagged.length === 0) return null;
              return (
                <div key={cat.key} className="break-inside-avoid">
                  <h3 className="text-sm font-medium">{cat.title}</h3>
                  <ul className="mt-1 space-y-2">
                    {flagged.map((item) => {
                      const Icon = CHECK_ICON[item.status];
                      return (
                        <li
                          key={item.key}
                          className={`flex gap-2 text-sm break-inside-avoid ${HIGHLIGHT_RED}`}
                        >
                          <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${CHECK_TONE[item.status]}`} aria-hidden />
                          <span>
                            <span className="font-medium">{item.label}</span>{" "}
                            <span className={CHECK_TONE[item.status]}>({CHECK_LABEL[item.status]})</span>
                            {item.evidence && (
                              <span className="block text-xs italic text-rose-900/80">
                                From {item.source}: “{item.evidence}”
                              </span>
                            )}
                            {item.note && <span className="block text-xs text-rose-900/80">{item.note}</span>}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}

            {a.norms.categories.every((cat) => cat.items.every((i) => i.status === "found")) && (
              <p className="text-sm text-muted-foreground">
                No norms issues to report — only problems are listed here.
              </p>
            )}

            <div className="break-inside-avoid">
              <h3 className="text-sm font-medium">Vague wording flagged</h3>
              {a.norms.vague.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing flagged.</p>
              ) : (
                <ul className="mt-1 space-y-1 text-sm">
                  {a.norms.vague.map((v, i) => (
                    <li key={i} className={`break-inside-avoid ${HIGHLIGHT_RED}`}>
                      <span className="font-medium">{v.label}:</span> “{v.phrase}” —{" "}
                      <span className="text-rose-900/80">{v.reason}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                The actual wording is shown as written; nothing has been rewritten.
              </p>
            </div>
          </>
        )}
      </Section>

      {/* 7. Meeting questions + follow-up space */}
      <Section title="Suggested meeting questions">
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          {a.blockers.slice(0, 3).map((b, i) => (
            <li key={`b-${i}`}>What is your plan to resolve: {b.reason.toLowerCase()}?</li>
          ))}
          {a.members
            .filter((m) => m.status !== "complete")
            .slice(0, 5)
            .map((m) => (
              <li key={m.userId}>
                {m.name}: {m.suggestedQuestion}
              </li>
            ))}
          {a.color === "green" && (
            <li>Everything required is in place — what is your first client contact step?</li>
          )}
        </ol>
        <div className="mt-2">
          <h3 className="text-sm font-medium">Follow-up notes</h3>
          <div className="mt-1 h-28 rounded border border-dashed border-border print:h-32" aria-hidden />
        </div>
      </Section>
    </div>
  );
}
