import { healthHistoryWeek } from "@/lib/health-history-trend";

export type StudentHealthReport = {
  id: string; team_id: string; team_label: string; generated_at: string; shared_at: string;
  good: number; fair: number; bad: number; vault_file_id: string | null; vault_version_id: string | null;
};

export function newestHealthReports(reports: StudentHealthReport[]) {
  return [...reports].sort((a, b) => Date.parse(b.generated_at) - Date.parse(a.generated_at)
    || Date.parse(b.shared_at) - Date.parse(a.shared_at) || b.id.localeCompare(a.id));
}

export function isCurrentHealthWeek(report: StudentHealthReport, now: string) {
  return healthHistoryWeek(report.generated_at) === healthHistoryWeek(now);
}