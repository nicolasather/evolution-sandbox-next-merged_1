/** Deterministic fixed-tick seat physics. A pure function of (body, input, context): integer maths only, no clocks, no randomness, no render rate.
 *  Replay equality (same inputs ⇒ byte-identical body) is a tested invariant. */
import type { Attempt, Body, Cell, Input, Perk, Pulse, Role } from './domain';
import { DASH_FACTOR, DASH_TICKS, DIAGONAL, GUARD_TICKS, HOP_COOLDOWN_TICKS, HOP_TICKS, MAX_BATCH, PUSH, PULSE_TICKS, RECOVERY_INVULN_TICKS, ROLE_COOLDOWNS, SOFT, SPEED, STUN, DAMAGING, OUTCOME } from './balance';
import { centerOf, ck, hazardActive, tileOf, type CourseIndex } from './course';

export type PerkCount = Partial<Record<Perk, number>>;
/** `limits[k]` is the furthest walk-distance open during chapter k (a closed gate is a wall); chapter k covers ticks k·chapterTicks+1 … (k+1)·chapterTicks. */
export type Ctx = { idx: CourseIndex; role: Role; perks: PerkCount; pulses: readonly Pulse[]; limits: readonly number[]; chapterTicks: number; seatId: string };
export const OPEN: Pick<Ctx, 'limits' | 'chapterTicks'> = { limits: [Infinity], chapterTicks: 1e9 };
const limitAt = (ctx: Ctx, tick: number) => ctx.limits[Math.max(0, Math.min(ctx.limits.length - 1, Math.floor((tick - 1) / ctx.chapterTicks)))];
export type Ev = { kind: 'hit' | 'shield' | 'checkpoint' | 'goal' | 'hop' | 'ability' | 'rescued' | 'denied'; tick: number; hazard?: string; what?: string };
/** Team-wide effect created by an ability this batch; the server stores it as a Pulse in the same transaction that saves the body. */
export type TeamEffect = { kind: 'plank' | 'survey' | 'recover'; tick: number; at: Cell };
export type StepOut = { events: Ev[]; effects: TeamEffect[]; denied: { hop: number; ability: number } };

export function newBody(idx: CourseIndex): Body {
  const [sx, sy] = idx.course.start; const x = centerOf(sx), y = centerOf(sy);
  return { x, y, tick: 0, checkpoint: 0, stunUntil: 0, invincibleUntil: 0, hopUntil: 0, hopReadyTick: 0, abilityReadyTick: 0, dashUntil: 0, guardUntil: 0, shieldUsed: 0, safeX: x, safeY: y, hits: 0, crossed: 0, hitMask: 0, maxDist: 0, goalTick: null, afkTicks: 0, rescues: 0 };
}
const popcount = (n: number) => { let c = 0; for (let v = n >>> 0; v; v &= v - 1) c++; return c; };
export const clearedOf = (b: Body) => popcount(b.crossed & ~b.hitMask);

function distOf(idx: CourseIndex, k: number): number {
  const d = idx.dist.get(k); if (d !== undefined) return d;
  if (!idx.sockets.has(k)) return Infinity;
  let m = Infinity; const x = k % 128, y = Math.floor(k / 128);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = idx.dist.get(ck(x + dx, y + dy)); if (n !== undefined && n + 1 < m) m = n + 1; }
  return m;
}
function allowed(idx: CourseIndex, ctx: Ctx, tx: number, ty: number, tick: number): boolean {
  const k = ck(tx, ty);
  if (!idx.cells.has(k) && !((ctx.perks.bridge_socket ?? 0) > 0 && idx.sockets.has(k))) return false;
  return distOf(idx, k) <= limitAt(ctx, tick);
}
const near = (a: Cell, tx: number, ty: number, r: number) => Math.abs(a[0] - tx) <= r && Math.abs(a[1] - ty) <= r;
function pulseOn(ctx: Ctx, tick: number, kind: Pulse['kind']): Pulse | undefined { for (const p of ctx.pulses) if (p.kind === kind && tick >= p.from && tick < p.to) return p; return undefined; }
/** Is this hazard suppressed right now by a safe gate or a bridgewright plank? */
function suppressed(ctx: Ctx, tick: number, tx: number, ty: number): boolean {
  for (const p of ctx.pulses) {
    if (tick < p.from || tick >= p.to) continue;
    if (p.kind === 'safe') return true;
    if (p.kind === 'plank' && p.at && near(p.at, tx, ty, 3)) return true;
  }
  return false;
}

/** One tick. Mutates `b` (callers hand in a private copy). */
export function stepInPlace(b: Body, input: Input, ctx: Ctx, out: StepOut): void {
  const { idx } = ctx; const tick = b.tick + 1; const stunned = tick < b.stunUntil;
  // abilities and hops are rejected (no effect, counted) while cooling down — a held key can never stack them
  if (input.hop) {
    if (stunned) { /* ignored */ } else if (tick >= b.hopReadyTick) { b.hopUntil = tick + HOP_TICKS; b.hopReadyTick = tick + HOP_COOLDOWN_TICKS; out.events.push({ kind: 'hop', tick }); }
    else { out.denied.hop++; out.events.push({ kind: 'denied', tick, what: 'hop' }); }
  }
  if (input.ability) {
    if (tick < b.abilityReadyTick) { out.denied.ability++; out.events.push({ kind: 'denied', tick, what: 'ability' }); }
    else {
      b.abilityReadyTick = tick + ROLE_COOLDOWNS[ctx.role]; out.events.push({ kind: 'ability', tick, what: ctx.role });
      const at: Cell = [tileOf(b.x), tileOf(b.y)];
      if (ctx.role === 'trailblazer') b.dashUntil = tick + DASH_TICKS;
      else if (ctx.role === 'shieldbearer') b.guardUntil = tick + GUARD_TICKS;
      else if (ctx.role === 'bridgewright') out.effects.push({ kind: 'plank', tick, at });
      else if (ctx.role === 'pathfinder') out.effects.push({ kind: 'survey', tick, at });
      else out.effects.push({ kind: 'recover', tick, at });
    }
  }
  // speed in units/tick, all integer
  let v = SPEED[ctx.role];
  if (tick < b.dashUntil) v = Math.floor((v * DASH_FACTOR) / 1000);
  if (pulseOn(ctx, tick, 'surge')) v = Math.floor((v * 1200) / 1000);
  const pads = Math.min(2, ctx.perks.team_dash_pad ?? 0); if (pads) v = Math.floor((v * (1000 + 100 * pads)) / 1000);
  const hereKey = ck(tileOf(b.x), tileOf(b.y)); const hereIdx = idx.hazardAt.get(hereKey); const here = hereIdx !== undefined ? idx.course.hazards[hereIdx] : null;
  const hereOn = !!here && hazardActive(here, tick) && !suppressed(ctx, tick, tileOf(b.x), tileOf(b.y));
  if (here && hereOn) { if (here.kind === 'slime') v = Math.floor((v * SOFT.slime) / 1000); else if (here.kind === 'mud_chute') v = Math.floor((v * SOFT.mud_chute) / 1000); }
  if (input.dx !== 0 && input.dy !== 0) v = Math.floor((v * DIAGONAL) / 1000);
  if (stunned) v = 0;
  // axis-separated movement: a wall stops one axis and lets the other slide; nothing can be crossed
  if (v > 0) {
    if (input.dx !== 0) { const nx = b.x + v * input.dx; if (allowed(idx, ctx, tileOf(nx), tileOf(b.y), tick)) b.x = nx; }
    if (input.dy !== 0) { const ny = b.y + v * input.dy; if (allowed(idx, ctx, tileOf(b.x), tileOf(ny), tick)) b.y = ny; }
  }
  if (here && hereOn && here.kind in PUSH && !stunned) {
    const [px, py] = PUSH[here.kind as keyof typeof PUSH];
    if (px && allowed(idx, ctx, tileOf(b.x + px), tileOf(b.y), tick)) b.x += px;
    if (py && allowed(idx, ctx, tileOf(b.x), tileOf(b.y + py), tick)) b.y += py;
  }
  const tx = tileOf(b.x), ty = tileOf(b.y); const key = ck(tx, ty);
  const zi = idx.hazardAt.get(key); const z = zi !== undefined ? idx.course.hazards[zi] : null;
  // a medic's recovery window frees a stunned seat immediately
  if (b.stunUntil > tick && pulseOn(ctx, tick, 'recover')) { b.stunUntil = tick; b.invincibleUntil = Math.max(b.invincibleUntil, tick + RECOVERY_INVULN_TICKS); b.rescues++; out.events.push({ kind: 'rescued', tick }); }
  if (z) {
    b.crossed |= 1 << zi!;
    const on = hazardActive(z, tick) && !suppressed(ctx, tick, tx, ty);
    if (on && z.kind === 'bounce_pad') b.hopUntil = Math.max(b.hopUntil, tick + HOP_TICKS);
    if (on && DAMAGING.has(z.kind) && tick >= b.invincibleUntil && tick >= b.hopUntil && tick >= b.guardUntil) {
      if ((ctx.perks.safety_rail ?? 0) - b.shieldUsed > 0) { b.shieldUsed++; b.invincibleUntil = tick + RECOVERY_INVULN_TICKS; out.events.push({ kind: 'shield', tick, hazard: z.id }); }
      else {
        b.hits++; b.hitMask |= 1 << zi!; out.events.push({ kind: 'hit', tick, hazard: z.id });
        let stun: number = (STUN as Record<string, number>)[z.kind] ?? STUN.default;
        if ((ctx.perks.group_recovery ?? 0) > 0) stun = Math.ceil(stun / 2);
        b.stunUntil = tick + stun; b.invincibleUntil = tick + Math.max(stun, RECOVERY_INVULN_TICKS);
        const where = OUTCOME[z.kind];
        if (where === 'safe') { b.x = b.safeX; b.y = b.safeY; }
        else if (where === 'checkpoint') {
          const cps = idx.course.checkpoints; let i = b.checkpoint - 1 + ((ctx.perks.checkpoint_beacon ?? 0) > 0 ? 1 : 0); i = Math.min(i, cps.length - 1);
          const at = i >= 0 ? cps[i] : idx.course.start; b.x = centerOf(at[0]); b.y = centerOf(at[1]);
        }
      }
    }
  } else { b.safeX = b.x; b.safeY = b.y; }
  const nowKey = ck(tileOf(b.x), tileOf(b.y));
  for (let j = b.checkpoint; j < idx.checkpointKeys.length; j++) if (idx.checkpointKeys[j] === nowKey) { b.checkpoint = j + 1; out.events.push({ kind: 'checkpoint', tick, what: String(j) }); break; }
  const d = distOf(idx, nowKey); if (d !== Infinity && d > b.maxDist && idx.dist.has(nowKey)) b.maxDist = d;
  if (nowKey === idx.goalKey && b.goalTick === null) { b.goalTick = tick; out.events.push({ kind: 'goal', tick }); }
  b.tick = tick;
}

const AXIS = new Set([-1, 0, 1]);
export function validSample(s: unknown): s is Input {
  if (!s || typeof s !== 'object') return false; const o = s as Record<string, unknown>;
  return AXIS.has(o.dx as number) && AXIS.has(o.dy as number) && typeof o.hop === 'boolean' && (o.ability === undefined || typeof o.ability === 'boolean');
}
export type BatchOk = { body: Body; out: StepOut };
/** Replays a batch for one seat. The seat may only continue exactly where it stopped (`fromTick === body.tick + 1`) and may not run past `maxTick`. */
export function applyBatch(body: Body, fromTick: number, samples: readonly unknown[], ctx: Ctx, maxTick: number): Attempt<BatchOk> {
  if (!Number.isSafeInteger(fromTick) || fromTick < 1) return { ok: false, code: 'TICK_INVALID', message: 'Bad tick.' };
  if (!Array.isArray(samples) || samples.length < 1 || samples.length > MAX_BATCH) return { ok: false, code: 'BATCH_SIZE', message: `A batch holds 1–${MAX_BATCH} samples.` };
  if (fromTick <= body.tick) return { ok: false, code: 'OLD_TICK', message: 'Those ticks were already played.' };
  if (fromTick !== body.tick + 1) return { ok: false, code: 'TICK_GAP', message: `Expected tick ${body.tick + 1}.` };
  if (body.tick + samples.length > maxTick) return { ok: false, code: 'FUTURE_TICK', message: 'That is ahead of the game clock.' };
  for (const s of samples) if (!validSample(s)) return { ok: false, code: 'INPUT_INVALID', message: 'Bad input sample.' };
  const b: Body = { ...body }; const out: StepOut = { events: [], effects: [], denied: { hop: 0, ability: 0 } };
  for (const s of samples as Input[]) stepInPlace(b, s, ctx, out);
  return { ok: true, state: { body: b, out } };
}
const IDLE: Input = { dx: 0, dy: 0, hop: false };
/** Idle forward to `toTick` (AFK catch-up and final settlement). Deterministic and bounded. */
export function idleTo(body: Body, toTick: number, ctx: Ctx): BatchOk {
  const b: Body = { ...body }; const out: StepOut = { events: [], effects: [], denied: { hop: 0, ability: 0 } };
  const n = Math.max(0, Math.min(4000, toTick - b.tick)); for (let i = 0; i < n; i++) stepInPlace(b, IDLE, ctx, out);
  b.afkTicks += n; return { body: b, out };
}
export { PULSE_TICKS };
