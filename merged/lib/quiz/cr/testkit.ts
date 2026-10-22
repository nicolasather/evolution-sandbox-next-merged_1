/** Headless full-match harness: real engine, scripted classmates, synthetic (clearly labelled) answers. Used by tests and by the Practice mode. */
import type { QuestionKind } from '../types';
import type { CommittedAnswer, CRConfig, CRState, Format, IntentEntry, MapId, PoolEntry, Role } from './domain';
import { botAction, botIntent } from './bot';
import { addSeat, advance, createSession, reduceHost, reduceSeat, worldTarget } from './engine';
import { planMatch } from './plan';
import type { Timelines } from './sim';

export type MatchOpts = {
  format: Format; mapId?: MapId; sizes: number[]; accuracy?: number[]; roles?: (Role | null)[][]; minutes?: number; lowPressure?: boolean; seed?: string; questions?: number; useActions?: boolean; idleSeats?: string[];
  difficulty?: CRConfig['difficulty']; onTick?: (s: CRState, now: number) => void; maxMs?: number;
};
export const cfgOf = (o: Pick<MatchOpts, 'format' | 'mapId' | 'sizes' | 'minutes' | 'lowPressure' | 'seed' | 'difficulty'>): CRConfig => ({ schemaVersion: 1, format: o.format, mapId: o.mapId ?? 'sunleaf_passage', seed: o.seed ?? 'seed0000seed0000', durationMinutes: o.minutes ?? 15, teamCount: o.sizes.length, teamNames: o.sizes.map((_, i) => `Team ${i + 1}`), teamSizeCap: 5, lowPressure: !!o.lowPressure, readAloud: false, hideNames: false, allowReviewCycle: false, perks: ['route_lamp', 'fast_map', 'extra_signal', 'scout_echo'], difficulty: o.difficulty ?? 'normal' });
export const poolOf = (n: number): PoolEntry[] => Array.from({ length: n }, (_, i) => ({ position: i, id: `q${i}`, kind: 'multiple_choice', repeat: false }));
export function newMatch(o: MatchOpts) {
  const cfg = cfgOf(o); const n = o.questions ?? 12; const pool = poolOf(n); const kinds = pool.map(() => 'multiple_choice' as QuestionKind); const plan = planMatch(cfg, kinds);
  let s = createSession(cfg, plan, pool, ['t1', 't2', 't3', 't4'].slice(0, o.sizes.length), 0); let id = 0;
  o.sizes.forEach((size, ti) => { for (let k = 0; k < size; k++) { const r = addSeat(s, `p${ti}-${k}`, `Student ${++id}`, k, `t${ti + 1}`); if (!r.ok) throw new Error(r.message); s = r.state; const role = o.roles?.[ti]?.[k]; if (role) s.seats.find((x) => x.id === `p${ti}-${k}`)!.role = role; } });
  return { cfg, pool, s, plan };
}
/** Play to the end (or `maxMs`). Answers come from `accuracy[team]` (fraction 0..1 for everyone on the team). */
export function playMatch(o: MatchOpts) {
  const { pool, s: s0 } = newMatch(o); let s = s0; const lines: Timelines = {}; let seq = 0; const accuracy = o.accuracy ?? o.sizes.map(() => 0.7);
  const start = reduceHost(s, { kind: 'start' }, 0, pool); if (!start.result.ok) throw new Error(start.result.message); s = start.result.state; let now = 0; const maxMs = o.maxMs ?? 3 * 3600_000;
  const answered = new Map<string, CommittedAnswer[]>(); const phases: string[] = [];
  while (s.phase !== 'finished' && now < maxMs) {
    now += 100;
    if (s.phase === 'barrier' && s.question) {
      const key = `${s.question.window}`; if (!answered.has(key)) answered.set(key, Object.entries(s.question.eligible).flatMap(([tid, ids]) => ids.map((id) => ({ id: `${key}-${id}`, seatId: id, roomQuestionId: s.question!.questionId ?? 'x', correct: false, awardedFraction: Math.round((accuracy[s.teams.findIndex((t) => t.id === tid)] ?? 0.7) * 1000) }))));
    }
    if (s.phase === 'race') {
      const t = worldTarget(s, now);
      for (const seat of s.seats) { if (seat.revoked || o.idleSeats?.includes(seat.id)) continue; const v = botIntent(s, seat.id); const e: IntentEntry = { tick: t + 1, x: v.x, y: v.y, seq: ++seq }; lines[seat.id] = [...(lines[seat.id] ?? []).slice(-6), e]; }
    }
    const before = s.phase; const out = advance(s, { now, pool, answers: s.phase === 'barrier' ? answered.get(`${s.question!.window}`) ?? [] : [], timelines: lines }); s = out.state; if (s.phase !== before) phases.push(s.phase);
    if (s.phase === 'race' && o.useActions !== false) for (const seat of s.seats) { if (seat.revoked || o.idleSeats?.includes(seat.id)) continue; const a = botAction(s, seat.id); if (a) { const r = reduceSeat(s, seat.id, a); if (r.ok) s = r.state; } }
    o.onTick?.(s, now);
  }
  return { state: s, ms: now, phases };
}
