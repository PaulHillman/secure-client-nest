export type LoginPeriod = "all" | "last_week" | "today" | "yesterday";
export type StudentLogin = {
  user_id: string; student_name: string; email: string | null; section: string | null;
  teams: string; roles: string[]; last_login_at: string | null; recent_logins: string[];
  last_visit_at?: string | null; recent_visits?: string[];
};

export function detroitDate(value: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Detroit", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const part = (name: string) => parts.find(p => p.type === name)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function shiftDate(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function loginPeriodRange(period: LoginPeriod, now: string) {
  const today = detroitDate(now);
  if (period === "today") return { start: today, end: today };
  if (period === "yesterday") return { start: shiftDate(today, -1), end: shiftDate(today, -1) };
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const monday = shiftDate(today, -((weekday + 6) % 7));
  return { start: shiftDate(monday, -7), end: shiftDate(monday, -1) };
}

export function filterStudentLogins(students: StudentLogin[], mode: "recent" | "inactive", period: LoginPeriod, days: number, now: string, basis: "signin" | "visit" = "signin") {
  const range = loginPeriodRange(period, now);
  const cutoff = Date.parse(now) - days * 86400000;
  return students.filter(student => {
    const latest = basis === "visit" ? student.last_visit_at ?? null : student.last_login_at;
    if (mode === "inactive") return latest === null || Date.parse(latest) <= cutoff;
    if (period === "all") return latest !== null;
    return (basis === "visit" ? student.recent_visits ?? [] : student.recent_logins).some(login => {
      const day = detroitDate(login);
      return Date.parse(login) <= Date.parse(now) && day >= range.start && day <= range.end;
    });
  }).sort((a, b) => {
    const aDate = basis === "visit" ? a.last_visit_at : a.last_login_at;
    const bDate = basis === "visit" ? b.last_visit_at : b.last_login_at;
    return (bDate ? Date.parse(bDate) : -Infinity) - (aDate ? Date.parse(aDate) : -Infinity) || a.student_name.localeCompare(b.student_name);
  });
}

export function daysSinceLogin(student: StudentLogin, now: string, basis: "signin" | "visit" = "signin") {
  const date = basis === "visit" ? student.last_visit_at : student.last_login_at;
  return date ? Math.max(0, Math.floor((Date.parse(now) - Date.parse(date)) / 86400000)) : null;
}