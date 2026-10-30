export function nextDetroitCalendarCheck(now: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Detroit', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const value = (name: string) => Number(parts.find(p => p.type === name)?.value);
  const tomorrow = new Date(Date.UTC(value('year'), value('month') - 1, value('day') + 1));
  // At 1 a.m. Detroit is UTC-4 or UTC-5; choose the first occurrence on fall-back day.
  for (const hour of [5, 6]) {
    const candidate = new Date(tomorrow.getTime() + hour * 3600000);
    const localHour = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Detroit', hour: 'numeric', hourCycle: 'h23' }).format(candidate);
    if (Number(localHour) === 1) return candidate;
  }
  throw new Error('Unable to determine the next Detroit calendar check');
}