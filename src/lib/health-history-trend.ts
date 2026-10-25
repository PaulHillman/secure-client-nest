export type HistoryScore = {
  id: string; report_id: string; team_id: string; team_label: string;
  section: string | null; good: number; yellow: number; red: number; created_at: string;
};

// Monday-based Detroit calendar weeks keep repeated saves from posing as different weeks.
export function healthHistoryWeek(date: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Detroit", year: "numeric", month: "numeric", day: "numeric",
  }).formatToParts(new Date(date));
  const value = (key: string) => Number(parts.find(p => p.type === key)?.value);
  const day = Date.UTC(value("year"), value("month") - 1, value("day"));
  return day - ((new Date(day).getUTCDay() + 6) % 7) * 86400000;
}

export function threeWeekHistory(scores: HistoryScore[], teamId: string) {
  const sorted = scores.filter(s => s.team_id === teamId)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id.localeCompare(a.id));
  const seen = new Set<number>();
  return sorted.filter(s => {
    const week = healthHistoryWeek(s.created_at);
    if (seen.has(week)) return false;
    seen.add(week);
    return true;
  }).slice(0, 3);
}

export function assessHistoryTrend(reports: HistoryScore[]) {
  const latest = reports[0];
  const middle = reports[1];
  const oldest = reports[2];
  if (!latest || !middle || !oldest) return { direction: "sideways" as const, label: "Not enough history", detail: `${reports.length} of 3 weekly reports available.` };
  if (healthHistoryWeek(latest.created_at) - healthHistoryWeek(middle.created_at) !== 7 * 86400000 ||
      healthHistoryWeek(middle.created_at) - healthHistoryWeek(oldest.created_at) !== 7 * 86400000) {
    return { direction: "sideways" as const, label: "Missing weekly report", detail: "The latest three reports do not cover three consecutive weeks." };
  }
  // Red concerns take priority; yellow concerns break a red-count tie. No invented grade.
  const compare = (a: HistoryScore, b: HistoryScore) => Math.sign(a.red - b.red || a.yellow - b.yellow);
  const first = compare(middle, oldest);
  const second = compare(latest, middle);
  const detail = `Bad: ${oldest.red} → ${middle.red} → ${latest.red}; Fair: ${oldest.yellow} → ${middle.yellow} → ${latest.yellow} (oldest to newest).`;
  if (first <= 0 && second <= 0 && (first < 0 || second < 0)) return { direction: "up" as const, label: "Improving", detail };
  if (first >= 0 && second >= 0 && (first > 0 || second > 0)) return { direction: "down" as const, label: "Worsening", detail };
  return { direction: "sideways" as const, label: first === 0 && second === 0 ? "Steady" : "Mixed trend", detail };
}