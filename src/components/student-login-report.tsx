import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getStudentLogins } from "@/lib/student-logins.functions";
import { daysSinceLogin, filterStudentLogins, loginPeriodRange, type LoginPeriod } from "@/lib/student-logins";

export function StudentLoginReport() {
  const [mode, setMode] = useState<"recent" | "inactive">("recent");
  const [period, setPeriod] = useState<LoginPeriod>("today");
  const [days, setDays] = useState("7");
  const [role, setRole] = useState("all");
  const [basis, setBasis] = useState<"visit" | "signin">("visit");
  const { data, isPending, error, refetch, isFetching } = useQuery({ queryKey: ["admin-student-access"], queryFn: () => getStudentLogins(), staleTime: 0, refetchInterval: 60000 });
  const students = data?.students ?? [];
  const roles = useMemo(() => [...new Set(students.flatMap(s => s.roles))].sort(), [students]);
  const validDays = /^\d+$/.test(days) && Number(days) > 0 && Number.isSafeInteger(Number(days));
  const now = data?.asOf ?? new Date().toISOString();
  const rows = filterStudentLogins(students, mode, period, validDays ? Number(days) : 7, now, basis).filter(s => role === "all" || s.roles.includes(role));
  const range = loginPeriodRange(period, now);
  const formatDate = (value: string) => new Date(value).toLocaleString("en-US", { timeZone: "America/Detroit", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

  return <section className="space-y-4" aria-label="Student login report">
    <div className="flex items-center justify-between gap-3"><h2 className="font-display text-2xl">Student access & sign-ins</h2><Button variant="outline" size="icon" aria-label="Refresh login report" title="Refresh login report" disabled={isFetching} onClick={() => void refetch()}><RefreshCw className="h-4 w-4" /></Button></div>
    <p className="text-sm text-muted-foreground">Students can return without signing in again. Recorded visits show that return; fresh sign-ins show when they authenticated.</p>
    <div className="space-y-1"><label className="text-sm" htmlFor="access-basis">Check</label><Select value={basis} onValueChange={value => setBasis(value === "signin" ? "signin" : "visit")}><SelectTrigger id="access-basis" className="w-64"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="signin">Fresh sign-ins</SelectItem><SelectItem value="visit">Recorded visits</SelectItem></SelectContent></Select></div>
    <Tabs value={mode} onValueChange={value => setMode(value === "inactive" ? "inactive" : "recent")}><TabsList><TabsTrigger value="inactive">{basis === "visit" ? "No recent visit" : "No recent sign-in"}</TabsTrigger><TabsTrigger value="recent">{basis === "visit" ? "Recent visits" : "Recent sign-ins"}</TabsTrigger></TabsList></Tabs>
    <div className="flex flex-wrap items-end gap-4">
      {mode === "recent" ? <div className="space-y-1"><label className="text-sm" htmlFor="login-period">Period</label><Select value={period} onValueChange={value => setPeriod(value as LoginPeriod)}><SelectTrigger id="login-period" className="w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All students</SelectItem><SelectItem value="last_week">Last week</SelectItem><SelectItem value="today">Today</SelectItem><SelectItem value="yesterday">Yesterday</SelectItem></SelectContent></Select></div> : <div className="space-y-2"><label className="text-sm" htmlFor="inactive-days">No {basis === "visit" ? "recorded visit" : "fresh sign-in"} for at least (days)</label><div className="flex flex-wrap gap-2">{[7, 14, 21].map(n => <Button size="sm" key={n} variant={days === String(n) ? "default" : "outline"} onClick={() => setDays(String(n))}>{n} days</Button>)}<Input id="inactive-days" aria-label="Custom inactivity days" type="number" min="1" step="1" value={days} onChange={e => setDays(e.target.value)} className="w-24" /></div>{!validDays && <p className="text-sm text-destructive">Enter a whole number greater than zero.</p>}</div>}
      <div className="space-y-1"><label className="text-sm" htmlFor="login-role">Team role</label><Select value={role} onValueChange={setRole}><SelectTrigger id="login-role" className="w-64 max-w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All roles</SelectItem>{roles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select></div>
    </div>
    <p className="text-sm text-muted-foreground">{mode === "recent" ? period === "all" ? "Latest recorded dates for each student." : `${range.start} through ${range.end}${period === "last_week" ? " · Monday–Sunday" : ""}.` : "Students without a recorded date are included as unknown."} All dates and times: Detroit.</p>
    <p className="text-xs text-muted-foreground">Admins, test-team students, and Parfunkel Hillman are excluded.</p>
    {isPending ? <p>Loading logins…</p> : error ? <div className="space-y-2"><p className="text-destructive">Login history could not be loaded.</p><Button variant="outline" onClick={() => void refetch()}>Try again</Button></div> : mode === "inactive" && !validDays ? null : <>
      <p className="text-sm font-medium">{rows.length} {rows.length === 1 ? "student" : "students"}{mode === "inactive" ? ` · no ${basis === "visit" ? "recorded visit" : "fresh sign-in"} for at least ${days} days` : ""}</p>
      <div className="overflow-x-auto border-y"><table className="w-full min-w-[800px] text-sm"><thead className="text-left text-muted-foreground"><tr><th className="py-3 pr-4">Student</th><th className="pr-4">Team / Section</th><th className="pr-4">Last recorded visit</th><th className="pr-4">Last fresh sign-in</th><th>Days since {basis === "visit" ? "visit" : "sign-in"}</th></tr></thead><tbody>{rows.map(student => <tr key={student.user_id} className="border-t"><td className="py-3 pr-4 align-top"><p className="font-medium">{student.student_name || "Unnamed student"}</p><p className="text-xs text-muted-foreground">{student.roles.join(", ")}</p></td><td className="py-3 pr-4 align-top">{student.teams}{student.teams === "No team" && student.section ? ` · Section ${student.section}` : ""}</td><td className="py-3 pr-4 align-top whitespace-nowrap">{student.last_visit_at ? formatDate(student.last_visit_at) : "No recorded visit"}</td><td className="py-3 pr-4 align-top whitespace-nowrap">{student.last_login_at ? formatDate(student.last_login_at) : "No recorded sign-in"}</td><td className="py-3 align-top tabular-nums">{daysSinceLogin(student, now, basis) ?? "—"}</td></tr>)}</tbody></table>{!rows.length && <p className="py-6 text-sm text-muted-foreground">No students match this filter.</p>}</div>
      <p className="text-xs text-muted-foreground">Updated {formatDate(now)} · Visits include recorded page openings, clicks, report openings and fresh sign-ins, not background refreshes. Earlier visit history may be incomplete.</p>
    </>}
  </section>;
}