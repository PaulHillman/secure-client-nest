export function criteriaReminderDue(now: Date, monthDay: string, reviewedYear: number | null) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Detroit', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const year = Number(today.slice(0, 4));
  return reviewedYear !== year && today.slice(5) >= monthDay;
}

export function validReminderMonthDay(value: string) {
  if (!/^\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`2000-${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(5, 10) === value;
}