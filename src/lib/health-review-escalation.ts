import { concernKey, type Concern } from "@/lib/health-review-comparison";

/**
 * Per-concern escalation across consecutive shared reports.
 * Each warning is tracked independently by its stable concern key: addressing
 * one warning resets only that warning; others keep escalating on their own.
 *
 * Streak counts consecutive shared reports the concern has appeared on,
 * including the current run:
 *   streak 1 -> first appearance, severity unchanged
 *   streak 2 -> upgraded to RED with a repeated-warning notice
 *   streak 3+ -> stays RED and adds a grade-deduction notice
 */

export type EscalationResult<T extends Concern> = {
  concern: T;
  /** Consecutive shared reports (including the current run) this concern has appeared on. */
  streak: number;
};

const SECOND_WARNING =
  "This was flagged on last week's report and is still outstanding — it is now a red warning.";
const GRADE_NOTICE =
  "This is the third consecutive report with this issue unresolved — points will begin being deducted from the team's final grade if it is not addressed.";

/** Keys whose streaks are meaningful per person (report openings, relative activity, absences). */
function keyFor(c: Concern): string | undefined {
  return concernKey(c) ?? c.ruleId;
}

/**
 * @param current  Concerns from the current run for one team.
 * @param priorPayloads  Exceptions arrays from that team's shared reports, newest first.
 */
export function escalateConcerns<T extends Concern>(
  current: T[],
  priorPayloads: Concern[][],
): EscalationResult<T>[] {
  return current.map((concern) => {
    const key = keyFor(concern);
    if (!key) return { concern, streak: 1 };

    let streak = 1;
    for (const prior of priorPayloads) {
      if (prior.some((p) => keyFor(p) === key)) streak++;
      else break; // consecutive only — a clean report in between resets the count
    }

    if (streak < 2) return { concern, streak };

    const escalated: T = {
      ...concern,
      level: "red",
      reason: `${concern.reason} ${streak === 2 ? SECOND_WARNING : GRADE_NOTICE}`,
    };
    return { concern: escalated, streak };
  });
}
