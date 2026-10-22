import { courseFor } from './course';
import { addSeat, createSession } from './engine';
import type { CommittedAnswer, OSConfig, OSState, PoolEntry } from './domain';
import { planMatch } from './plan';
import type { QuestionKind } from '../types';

export const KINDS: QuestionKind[] = ['multiple_choice', 'answer_forge', 'connection_rush', 'truth_hunt', 'fill_table'];
export const poolOf = (n: number): PoolEntry[] => Array.from({ length: n }, (_, i) => ({ position: i, id: `q${i}`.padEnd(8, '0'), kind: KINDS[i % 5], repeat: false }));
export const cfgOf = (o: Partial<OSConfig> = {}): OSConfig => ({ schemaVersion: 1, format: 'cooperative_escape', mapId: 'chalkyard_circuit', courseSeed: 'seed-1', durationMinutes: 10, teamCount: 1, teamNames: ['Mint Comets', 'Coral Crew', 'Blue Orbits', 'Golden Gears'], teamSizeCap: 5, lowPressure: false, readAloud: false, hideNames: false, approvalAbove: 0, allowReviewCycle: false, ...o });
export function makeMatch(o: Partial<OSConfig> = {}, questions = 6, seed = 'seed-1', teams: string[] = ['sq1', 'sq2', 'sq3', 'sq4'], now = 1_000_000) {
  const cfg = cfgOf(o); const { idx } = courseFor(cfg.mapId, cfg.courseSeed === 'seed-1' ? seed : cfg.courseSeed, cfg.lowPressure);
  const plan = planMatch(cfg, Array.from({ length: questions }, (_, i) => KINDS[i % 5]), idx);
  const pool = poolOf(questions);
  const state = createSession(cfg, plan, pool, teams, now);
  return { cfg, idx, plan, pool, state, seed };
}
export function seatUp(s: OSState, ids: string[], team?: string): OSState {
  let cur = s; for (const id of ids) { const r = addSeat(cur, id, `P-${id}`, 1_000_000, team ?? null); if (!r.ok) throw new Error(r.message); cur = r.state; } return cur;
}
export const ans = (seatId: string, rq: string, frac: number): CommittedAnswer => ({ id: `s-${seatId}-${rq}`, seatId, roomQuestionId: rq, correct: frac === 1000, awardedFraction: frac });
