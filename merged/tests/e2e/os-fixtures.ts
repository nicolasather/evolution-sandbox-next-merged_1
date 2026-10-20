/** Engine-built snapshots for the Obstacle Survival UI tests. They come from the REAL pure engine (createSession → advance → project), so the screens are
 *  exercised against exactly the objects the server would send — but no server, database or network is involved (see docs/obstacle-survival/QA_EVIDENCE.md). */
import { addSeat, advance, reduceHost, reduceSeat, worldTick } from '@/lib/quiz/os/engine';
import { project } from '@/lib/quiz/os/public';
import { courseFor, centerOf } from '@/lib/quiz/os/course';
import { newBody } from '@/lib/quiz/os/physics';
import { cfgOf, poolOf } from '@/lib/quiz/os/testkit';
import { planMatch } from '@/lib/quiz/os/plan';
import { createSession } from '@/lib/quiz/os/engine';
import { PRACTICE } from '@/lib/quiz/td/practice-bank';
import { publicPayload } from '@/lib/quiz/public';
import type { Body, OSConfig, OSState, OSView, Role } from '@/lib/quiz/os/domain';
import { KINDS } from '@/lib/quiz/os/testkit';

export const T0 = 5_000_000;
export const ROOM = '11111111-2222-4333-8444-555555555555';
export type Scene = 'lobby' | 'preview' | 'traversing' | 'barrier' | 'reveal' | 'build_choice' | 'countdown' | 'finished';
const ID = (n: number) => `seat${n}`.padEnd(8, 'x');
export const SEAT = ID(0);

export function build(o: { format?: OSConfig['format']; squads?: number; players?: number; map?: OSConfig['mapId']; low?: boolean } = {}) {
  const squads = o.format === 'relay_race' ? o.squads ?? 2 : 1; const cfg = cfgOf({ format: o.format ?? 'cooperative_escape', teamCount: squads, mapId: o.map ?? 'chalkyard_circuit', lowPressure: !!o.low, courseSeed: 'ui-seed' });
  const { idx } = courseFor(cfg.mapId, cfg.courseSeed, cfg.lowPressure); const kinds = Array.from({ length: 6 }, (_, i) => KINDS[i % 5]); const plan = planMatch(cfg, kinds, idx);
  let s: OSState = createSession(cfg, plan, poolOf(6), ['sq1', 'sq2', 'sq3', 'sq4'].slice(0, squads), T0);
  const roles: Role[] = ['trailblazer', 'shieldbearer', 'bridgewright', 'pathfinder', 'medic'];
  for (let i = 0; i < (o.players ?? 4); i++) { const r = addSeat(s, ID(i), ['Ada', 'Ben', 'Cy', 'Dee', 'Eli', 'Fay', 'Gus', 'Hal'][i], T0, null); if (r.ok) s = r.state; const q = reduceSeat(s, ID(i), { kind: 'role', role: roles[i % 5] }); if (q.ok) s = q.state; }
  return { cfg, idx, plan, state: s, pool: poolOf(6) };
}
type Built = ReturnType<typeof build>;
export function at(b: Built, scene: Scene): { state: OSState; now: number } {
  let s = b.state; if (scene === 'lobby') return { state: s, now: T0 };
  const r = reduceHost(s, { kind: 'start' }, T0); if (!r.result.ok) throw new Error(r.result.message); s = r.result.state; let now = T0;
  const step = (stop: (x: OSState) => boolean) => { for (let i = 0; i < 4000 && !stop(s); i++) { now += 250; const bodies = Object.fromEntries(s.seats.map((x) => [x.id, { ...newBody(b.idx), maxDist: 20 }])); s = advance(s, { now, pool: b.pool, answers: [], bodies, seedKey: 'ui' }).state; } };
  if (scene === 'preview') return { state: s, now: T0 + 2000 };
  if (scene === 'traversing') { step((x) => x.phase === 'traversing'); return { state: s, now: now + 60 * 50 }; }
  if (scene === 'barrier') { step((x) => x.phase === 'barrier'); return { state: s, now: now + 4000 }; }
  if (scene === 'reveal') { step((x) => x.phase === 'reveal'); return { state: s, now: now + 2000 }; }
  if (scene === 'build_choice') { step((x) => x.phase === 'build_choice'); s = { ...s, teams: s.teams.map((t) => ({ ...t, points: 210, earned: 210, perks: ['safety_rail'] })) }; return { state: s, now: now + 2000 }; }
  if (scene === 'countdown') { step((x) => x.phase === 'countdown'); return { state: s, now: now + 1000 }; }
  step((x) => x.phase === 'finished'); return { state: s, now };
}
/** The snapshot the server would send to this viewer at that scene. `serverNow` is the scene's own clock; the client offsets itself from it. */
export function snapshot(b: Built, scene: Scene, view: OSView, seatId: string | null = SEAT, extra: { progress?: number } = {}) {
  const { state, now } = at(b, scene); const bodies: Record<string, Body> = {};
  state.seats.forEach((x, i) => { const base = newBody(b.idx); const k = Math.min(b.idx.course.expandedSafePath.length - 1, Math.round((extra.progress ?? 0.2) * b.idx.course.expandedSafePath.length) + i * 2); const c = b.idx.course.expandedSafePath[Math.max(0, k)]; bodies[x.id] = { ...base, x: centerOf(c[0]), y: centerOf(c[1]), tick: scene === 'lobby' ? 0 : worldTick(state, now), maxDist: b.idx.dist.get(c[0] + c[1] * 128) ?? 0 }; });
  const answered = new Set<string>(scene === 'barrier' ? [ID(0), ID(1)] : []);
  const pub = project(state, view, view === 'student' ? seatId : null, now, scene === 'lobby' ? {} : bodies, answered);
  const q = PRACTICE[2]; const showQ = scene === 'barrier' || scene === 'reveal';
  const question = showQ ? { id: q.id, position: q.position, kind: q.kind, prompt: q.prompt, base_points: 100, payload: publicPayload(q.kind, q.payload, `${q.id}:ui`), ...(scene === 'reveal' ? { answerKey: q.answerKey } : {}) } : null;
  const me = seatId ? state.seats.find((x) => x.id === seatId) : null; const team = me && state.teams.find((t) => t.id === me.teamId); const perks: Record<string, number> = {}; for (const p of team?.perks ?? []) perks[p] = (perks[p] ?? 0) + 1;
  return { ...pub, revision: 1 + ['lobby', 'preview', 'traversing', 'barrier', 'reveal', 'build_choice', 'countdown', 'finished'].indexOf(scene), room: { id: ROOM, code: 'QZ4K7P', status: scene === 'finished' ? 'ended' : 'active' }, course: { mapId: b.cfg.mapId, courseSeed: b.cfg.courseSeed, lowPressure: b.cfg.lowPressure }, question, body: me ? bodies[me.id] ?? newBody(b.idx) : null, tip: null, mine: scene === 'reveal' ? 1000 : null, award: scene === 'reveal' ? 40 : null, ...(me ? { perks } : {}) };
}
