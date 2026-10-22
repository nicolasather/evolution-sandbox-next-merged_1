/** A closed-loop reference runner. It plays the REAL physics (`stepInPlace`) tick by tick, so "the map is solvable" is checked against the same code
 *  the server runs — not against a simplified model. Used by the 1000-seed sweep, the fairness tests and the offline practice demo. */
import type { Body, Cell, Input, Pulse, Role } from './domain';
import { SPEED, TILE } from './balance';
import { centerOf, ck, clearBetween, crossTicks, isDamaging, solve, tileOf, type CourseIndex } from './course';
import { newBody, OPEN, stepInPlace, type Ctx, type PerkCount, type StepOut } from './physics';

export type RunResult = { reached: boolean; ticks: number; hits: number; body: Body; trace?: Input[] };
const sign = (n: number): -1 | 0 | 1 => (n > 0 ? 1 : n < 0 ? -1 : 0);

export function runBot(idx: CourseIndex, role: Role, o: { startTick?: number; maxTicks?: number; perks?: PerkCount; pulses?: readonly Pulse[]; from?: Cell; record?: boolean } = {}): RunResult {
  const speed = SPEED[role]; const t0 = o.startTick ?? 0; const max = o.maxTicks ?? 3000;
  const plan = solve(idx, { speed, startTick: t0, from: o.from, allowSockets: false });
  const ctx: Ctx = { idx, role, perks: o.perks ?? {}, pulses: o.pulses ?? [], ...OPEN, seatId: 'bot' };
  const b = newBody(idx); b.tick = t0;
  if (o.from) { b.x = centerOf(o.from[0]); b.y = centerOf(o.from[1]); b.safeX = b.x; b.safeY = b.y; }
  const trace: Input[] = []; const out: StepOut = { events: [], effects: [], denied: { hop: 0, ability: 0 } };
  if (!plan) return { reached: false, ticks: 0, hits: 0, body: b };
  const path = plan.cells; let i = 0;
  for (let n = 0; n < max; n++) {
    const tx = tileOf(b.x), ty = tileOf(b.y);
    while (i + 1 < path.length && ck(path[i + 1][0], path[i + 1][1]) === ck(tx, ty)) i++;
    if (ck(tx, ty) === idx.goalKey) break;
    const next = path[Math.min(i + 1, path.length - 1)]; const cx = centerOf(next[0]), cy = centerOf(next[1]);
    const nk = ck(next[0], next[1]); const hi = idx.hazardAt.get(nk); const hz = hi !== undefined && isDamaging(idx.course.hazards[hi]) ? idx.course.hazards[hi] : null;
    let go = true;
    if (hz) {
      // ticks until our centre line reaches the tile boundary, at this role's speed; wait on the (safe) current tile until the whole crossing is clear
      const here = ck(tx, ty); const dBoundary = Math.max(1, Math.abs(next[0] - tx) * Math.abs(cx - b.x) + Math.abs(next[1] - ty) * Math.abs(cy - b.y) - TILE / 2);
      const arrive = b.tick + 1 + Math.ceil(dBoundary / speed); const Tv = crossTicks(speed, nk, idx);
      go = clearBetween(hz, arrive - 3, arrive + Tv + 3);
      if (!go && here !== ck(tx, ty)) go = true;
    }
    let dx: -1 | 0 | 1 = 0, dy: -1 | 0 | 1 = 0;
    if (go) {
      // move along the axis that leaves the current tile; keep the other axis on the centre line
      dx = Math.abs(cx - b.x) > speed / 2 ? sign(cx - b.x) : 0; dy = Math.abs(cy - b.y) > speed / 2 ? sign(cy - b.y) : 0;
      if (dx !== 0 && dy !== 0) { // never cut a corner: finish the axis that crosses the boundary first
        if (next[0] !== tx) dy = Math.abs(cy - b.y) > TILE / 4 ? dy : 0; else dx = Math.abs(cx - b.x) > TILE / 4 ? dx : 0;
      }
    } else {
      const hx = centerOf(tx), hy = centerOf(ty); dx = Math.abs(hx - b.x) > speed / 2 ? sign(hx - b.x) : 0; dy = Math.abs(hy - b.y) > speed / 2 ? sign(hy - b.y) : 0;
    }
    const inp: Input = { dx, dy, hop: false }; if (o.record) trace.push(inp);
    stepInPlace(b, inp, ctx, out);
  }
  return { reached: b.goalTick !== null, ticks: b.tick - t0, hits: b.hits, body: b, ...(o.record ? { trace } : {}) };
}
