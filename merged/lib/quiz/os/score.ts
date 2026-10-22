/** Scoring: barrier points normalised by squad size, and the published relay formula. Integers only. */
import type { Body, OSState, Standing, TeamRec } from './domain';
import { MAX_POINTS } from './balance';
import { clearedOf } from './physics';
import { hashSeed } from './rng';

export type Sub = { seatId: string; fraction: number }; // fraction 0..1000 of the base points, as graded by the server
/** floor(sum of individual awards / eligible players), rounded down to a multiple of 5. Roster is frozen when the barrier opens, so absentees count as 0
 *  and a lone student can never farm a five-person economy. */
export function barrierPoints(eligible: readonly string[], subs: readonly Sub[]): number {
  if (!eligible.length) return 0;
  const seen = new Map<string, number>();
  for (const s of subs) if (eligible.includes(s.seatId) && !seen.has(s.seatId)) seen.set(s.seatId, Math.max(0, Math.min(1000, Math.round(s.fraction))));
  const sum = eligible.reduce((n, id) => n + (seen.get(id) ?? 0) / 10, 0); // 0..100 per player
  return Math.floor(Math.floor(sum / eligible.length) / 5) * 5;
}
export const masteryOf = (eligible: readonly string[], subs: readonly Sub[]) => {
  const seen = new Map<string, number>(); for (const s of subs) if (eligible.includes(s.seatId) && !seen.has(s.seatId)) seen.set(s.seatId, Math.max(0, Math.min(1000, s.fraction)));
  return eligible.reduce((n, id) => n + (seen.get(id) ?? 0), 0); // thousandths of a correct answer
};
export const addPoints = (t: TeamRec, award: number) => { const room = MAX_POINTS - t.points; const take = Math.max(0, Math.min(room, award)); t.points += take; t.earned += take; t.wasted += award - take; return take; };

export const WEIGHTS = { progress: 45, mastery: 40, teamwork: 15 } as const;
const TIE_BAND = 50; // ±5% of 1000
export function standingsOf(s: OSState, bodies: Record<string, Body>, totalDist: number, seedKey: string): Standing[] {
  const rows = s.teams.map((t) => {
    const seats = s.seats.filter((x) => x.teamId === t.id && !x.revoked); const bs = seats.map((x) => bodies[x.id]).filter(Boolean) as Body[];
    const n = Math.max(1, seats.length);
    const progress = totalDist > 0 ? Math.round(seats.reduce((a, x) => a + Math.min(1000, ((bodies[x.id]?.maxDist ?? 0) * 1000) / totalDist), 0) / n) : 0;
    const mastery = t.masteryOf > 0 ? Math.round(t.mastery / t.masteryOf) : 0; // mastery sums thousandths over eligible answers
    const rescues = bs.reduce((a, b) => a + b.rescues, 0); const assists = Math.min(t.assists + rescues, 2 * s.plan.chapters);
    const teamwork = Math.min(1000, Math.round((1000 * assists) / Math.max(1, 2 * s.plan.chapters)));
    const score = Math.round((WEIGHTS.progress * progress + WEIGHTS.mastery * mastery + WEIGHTS.teamwork * teamwork) / 100);
    const escaped = seats.filter((x) => bodies[x.id]?.goalTick != null).length;
    const goalTicks = seats.map((x) => bodies[x.id]?.goalTick).filter((v): v is number => v != null);
    const meanGoal = goalTicks.length ? goalTicks.reduce((a, b) => a + b, 0) / goalTicks.length : Infinity;
    return { t, meanGoal, st: { teamId: t.id, rank: 0, outcome: (seats.length > 0 && escaped === seats.length ? 'escaped' : 'partial') as Standing['outcome'], progress, mastery, teamwork, score, hits: bs.reduce((a, b) => a + b.hits, 0), cleared: bs.reduce((a, b) => a + clearedOf(b), 0), assists, spent: t.spent, players: seats.length, escaped } };
  });
  // deterministic order: score, then (inside the ±5% band) mastery, obstacles cleared, fewer hits, fewer assists, earlier escape, seeded draw
  const draw = (id: string) => hashSeed(`${seedKey}|${id}`);
  const cmp = (a: (typeof rows)[number], b: (typeof rows)[number]) => {
    if (Math.abs(a.st.score - b.st.score) > TIE_BAND) return b.st.score - a.st.score;
    return (b.st.mastery - a.st.mastery) || (b.st.cleared - a.st.cleared) || (a.st.hits - b.st.hits) || (a.st.assists - b.st.assists) || (a.meanGoal === b.meanGoal ? 0 : a.meanGoal < b.meanGoal ? -1 : 1) || (b.st.score - a.st.score) || (draw(a.t.id) - draw(b.t.id));
  };
  // insertion sort: stable and free of the non-transitivity a banded comparator can cause inside Array.sort
  const out: typeof rows = [];
  for (const r of rows) { let i = out.length; while (i > 0 && cmp(r, out[i - 1]) < 0) i--; out.splice(i, 0, r); }
  out.forEach((r, i) => { r.st.rank = i + 1; });
  if (s.format === 'relay_race' && out.length) out[0].st.outcome = 'winner'; else if (s.format === 'relay_race') { /* none */ }
  return out.map((r) => r.st);
}
