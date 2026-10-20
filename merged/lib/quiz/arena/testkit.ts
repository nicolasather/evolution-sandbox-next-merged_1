/** Headless full-match harness: real engine, scripted classmates, synthetic (clearly labelled) answers. Used by tests and by the Practice mode. */
import type { QuestionKind } from '../types';
import type { ArenaConfig, ArenaState, CommittedAnswer, Format, IntentEntry, MapId, PoolEntry, Role } from './domain';
import { ROLES } from './domain';
import { HELPER_COST } from './balance';
import { botIntent, botPassTarget, botWantsAbility } from './bot';
import { advance, createSession, reduceHost, reduceSeat, addSeat, worldTarget } from './engine';
import { planMatch } from './plan';
import type { Timelines } from './sim';

export type MatchOpts = {
  format: Format; mapId?: MapId; sizes: number[]; accuracy?: number[]; roles?: (Role | null)[][]; minutes?: number; lowPressure?: boolean; seed?: string; questions?: number; useAbilities?: boolean; buy?: boolean; idleSeats?: string[];
  weighting?: ArenaConfig['weighting']; onTick?: (s: ArenaState, now: number) => void; maxMs?: number;
};
export const cfgOf = (o: Pick<MatchOpts, 'format' | 'mapId' | 'sizes' | 'minutes' | 'lowPressure' | 'seed' | 'weighting'>): ArenaConfig => ({ schemaVersion: 1, format: o.format, mapId: o.mapId ?? 'meadow_mosaic', seed: o.seed ?? 'seed0000seed0000', durationMinutes: o.minutes ?? 15, teamCount: o.sizes.length, teamNames: o.sizes.map((_, i) => `Team ${i + 1}`), teamSizeCap: 5, weighting: o.weighting ?? 'balanced', lowPressure: !!o.lowPressure, readAloud: false, hideNames: false, allowReviewCycle: false, helpers: ['trail_speed', 'capture_marker', 'route_reveal', 'deposit_guidance'] });
export const poolOf = (n: number): PoolEntry[] => Array.from({ length: n }, (_, i) => ({ position: i, id: `q${i}`, kind: 'multiple_choice', repeat: false }));
export function newMatch(o: MatchOpts) {
  const cfg = cfgOf(o); const n = o.questions ?? 12; const pool = poolOf(n); const kinds = pool.map(() => 'multiple_choice' as QuestionKind); const plan = planMatch(cfg, kinds);
  let s = createSession(cfg, plan, pool, ['t1', 't2', 't3', 't4'].slice(0, o.sizes.length), 0); let id = 0;
  o.sizes.forEach((size, ti) => { for (let k = 0; k < size; k++) { const r = addSeat(s, `p${ti}-${k}`, `Student ${++id}`, 0, `t${ti + 1}`); if (!r.ok) throw new Error(r.message); s = r.state; const role = o.roles?.[ti]?.[k]; if (role) { const seat = s.seats.find((x) => x.id === `p${ti}-${k}`)!; seat.role = role; } } });
  return { cfg, pool, s, plan };
}
/** Play to the end (or `maxMs`). Answers come from `accuracy[team]` (fraction 0..1 for everyone on the team). */
export function playMatch(o: MatchOpts) {
  const { pool, s: s0 } = newMatch(o); let s = s0; const lines: Timelines = {}; let seq = 0; const accuracy = o.accuracy ?? o.sizes.map(() => 0.7);
  const start = reduceHost(s, { kind: 'start' }, 0, pool); if (!start.result.ok) throw new Error(start.result.message); s = start.result.state; let now = 0; const maxMs = o.maxMs ?? 3 * 3600_000;
  const answered = new Map<string, CommittedAnswer[]>();
  while (s.phase !== 'finished' && now < maxMs) {
    now += 100;
    if (s.phase === 'question_open' && s.question) {
      const key = `${s.cycle}`; if (!answered.has(key)) answered.set(key, Object.entries(s.question.eligible).flatMap(([tid, ids]) => ids.map((id, i) => ({ id: `${key}-${id}`, seatId: id, roomQuestionId: s.question!.questionId ?? 'x', correct: false, awardedFraction: Math.round((accuracy[s.teams.findIndex((t) => t.id === tid)] ?? 0.7) * 1000) * (i >= 0 ? 1 : 0) }))));
    }
    if (s.phase === 'arena_live') {
      const t = worldTarget(s, now);
      for (const seat of s.seats) { if (seat.revoked || o.idleSeats?.includes(seat.id)) continue; const v = botIntent(s, seat.id); const e: IntentEntry = { tick: t + 1, x: v.x, y: v.y, seq: ++seq }; lines[seat.id] = [...(lines[seat.id] ?? []).slice(-6), e]; }
    }
    const out = advance(s, { now, pool, answers: s.phase === 'question_open' ? answered.get(`${s.cycle}`) ?? [] : [], timelines: lines }); s = out.state;
    if (s.phase === 'planning' && o.buy) for (const t of s.teams) if (!t.boughtInPlanning && t.wallet >= HELPER_COST.trail_speed) { const seat = s.seats.find((x) => !x.revoked && x.teamId === t.id); if (seat) { const r = reduceSeat(s, seat.id, { kind: 'buy', helper: 'trail_speed' }); if (r.ok) s = r.state; } }
    if (s.phase === 'arena_live' && o.useAbilities) for (const seat of s.seats) { if (seat.revoked) continue; if (botPassTarget(s, seat.id)) { const r = reduceSeat(s, seat.id, { kind: 'pass' }); if (r.ok) s = r.state; } if (botWantsAbility(s, seat.id)) { const r = reduceSeat(s, seat.id, { kind: 'ability' }); if (r.ok) s = r.state; } }
    o.onTick?.(s, now);
  }
  return { state: s, ms: now };
}
export { ROLES };
