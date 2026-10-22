/** Client-side prediction. The browser runs the SAME fixed-tick physics the server runs, so movement feels instant and is never "approximately" right:
 *  inputs are sampled once per tick, kept until the server acknowledges them, and replayed on top of every authoritative body that arrives.
 *  Pure and deterministic (no clocks, no randomness): it is unit-tested against the server's applyBatch. */
import type { Body, Input, Pulse } from './domain';
import { MAX_BATCH, PULSE_TICKS } from './balance';
import { stepInPlace, type Ctx, type Ev, type StepOut } from './physics';

export const IDLE_INPUT: Input = { dx: 0, dy: 0, hop: false };
export class Predictor {
  body: Body; ctx: Ctx; pending: { tick: number; input: Input }[] = []; acked: number; private extra: Pulse[] = [];
  constructor(body: Body, ctx: Ctx) { this.body = { ...body }; this.ctx = ctx; this.acked = body.tick; }
  get tick() { return this.body.tick; }
  /** One tick of the local body. Returns the events it produced (hit, shield, checkpoint, …) for feedback. */
  step(input: Input): Ev[] {
    const out: StepOut = { events: [], effects: [], denied: { hop: 0, ability: 0 } };
    stepInPlace(this.body, input, { ...this.ctx, pulses: [...this.ctx.pulses, ...this.extra] }, out);
    this.pending.push({ tick: this.body.tick, input: { dx: input.dx, dy: input.dy, hop: input.hop, ...(input.ability ? { ability: true } : {}) } });
    // the squad's pulse starts locally at once; the server's copy replaces it on the next authoritative read
    for (const e of out.effects) this.extra.push({ kind: e.kind, from: e.tick, to: e.tick + PULSE_TICKS[e.kind], seatId: this.ctx.seatId, at: e.at });
    return out.events;
  }
  /** Run up to `max` ticks to reach `target`, sampling input for each. Never runs ahead of the target. */
  catchUp(target: number, read: () => Input, max = 60): Ev[] {
    const ev: Ev[] = []; let n = 0;
    while (this.body.tick < target && n++ < max) ev.push(...this.step(read()));
    return ev;
  }
  /** The next batch to send: every unacknowledged tick, in order, starting right after the last acknowledged one. */
  batch(max = MAX_BATCH): { fromTick: number; samples: Input[] } | null {
    const list = this.pending.filter((p) => p.tick > this.acked).slice(0, max);
    if (!list.length || list[0].tick !== this.acked + 1) return null;
    return { fromTick: list[0].tick, samples: list.map((p) => p.input) };
  }
  ack(tick: number) { this.acked = Math.max(this.acked, tick); this.pending = this.pending.filter((p) => p.tick > this.acked); }
  /** An authoritative body arrived: adopt it and replay whatever the server has not seen yet. */
  rebase(server: Body, ctx: Ctx) {
    this.ctx = ctx; this.acked = server.tick; this.extra = this.extra.filter((p) => p.to > server.tick);
    const keep = this.pending.filter((p) => p.tick > server.tick); this.body = { ...server }; this.pending = [];
    if (keep.length && keep[0].tick !== server.tick + 1) return; // the server idled this seat forward: the old inputs no longer apply
    for (const p of keep) this.step(p.input);
  }
}
