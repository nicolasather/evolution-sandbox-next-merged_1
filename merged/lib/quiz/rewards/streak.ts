/** Flexible learning streak. Counts DAYS WITH REAL LEARNING (never logins); one automatic rest day per week; school breaks are skipped, not punished; a lapse halves the streak rather than erasing it. Pure. */
import { isDay } from './coins';
export type DateRange = { from: string; to: string };
export type Streak = { current: number; best: number; lastDay: string | null; lastRestDay: string | null; hidden: boolean };
export const emptyStreak = (): Streak => ({ current: 0, best: 0, lastDay: null, lastRestDay: null, hidden: false });
const MS = 86_400_000;
const dayNum = (d: string) => Math.floor(Date.parse(`${d}T00:00:00Z`) / MS);
const addDays = (d: string, n: number) => new Date((dayNum(d) + n) * MS).toISOString().slice(0, 10);
const inBreak = (d: string, breaks: readonly DateRange[]) => breaks.some((b) => isDay(b.from) && isDay(b.to) && d >= b.from && d <= b.to);

export function recordLearningDay(s: Streak, day: string, breaks: readonly DateRange[] = []): Streak {
  if (!isDay(day)) return s;
  if (s.lastDay && day <= s.lastDay) return s; // same day again, or an old event arriving late: no change
  let current = s.current; let lastRestDay = s.lastRestDay;
  if (!s.lastDay) current = 1;
  else {
    const missed: string[] = []; for (let d = addDays(s.lastDay, 1); d < day; d = addDays(d, 1)) if (!inBreak(d, breaks)) missed.push(d);
    if (missed.length === 0) current += 1;
    else if (missed.length === 1 && (!lastRestDay || dayNum(missed[0]!) - dayNum(lastRestDay) >= 7)) { current += 1; lastRestDay = missed[0]!; }
    else current = Math.floor(current / 2) + 1; // gentle recovery
  }
  return { ...s, current, best: Math.max(s.best, current), lastDay: day, lastRestDay };
}
/** What to show today: a streak that has quietly lapsed is described as resting, never as lost. */
export function describe(s: Streak, today: string, breaks: readonly DateRange[] = []): string {
  if (s.hidden) return ''; if (!s.lastDay) return 'Your learning days will appear here.';
  const gap = dayNum(today) - dayNum(s.lastDay) - 1; const live = gap <= 0 || inBreak(today, breaks);
  return live ? `${s.current} learning day${s.current === 1 ? '' : 's'} in a rhythm` : `Resting at ${s.current} — any learning today keeps it going`;
}
