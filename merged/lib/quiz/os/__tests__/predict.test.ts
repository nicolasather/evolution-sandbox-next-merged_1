/** @jest-environment node */
import { Predictor } from '../predict';
import { applyBatch, newBody, type Ctx } from '../physics';
import { courseFor } from '../course';
import type { Input } from '../domain';

const idx = courseFor('chalkyard_circuit', 'predict', false).idx;
const ctx: Ctx = { idx, role: 'trailblazer', perks: {}, pulses: [], limits: [Infinity], chapterTicks: 1e9, seatId: 'seat-1' };
const script = (n: number): Input[] => Array.from({ length: n }, (_, i) => ({ dx: i % 40 < 30 ? 1 : 0, dy: i % 40 >= 30 ? 1 : 0, hop: i % 23 === 0, ability: i === 50 ? true : undefined }));

describe('Predictor', () => {
  it('matches the server exactly when the same inputs are sent in batches', () => {
    const p = new Predictor(newBody(idx), ctx); const inputs = script(300); let i = 0; let server = newBody(idx);
    while (p.tick < 300) {
      p.catchUp(Math.min(300, p.tick + 17), () => inputs[i++ % inputs.length] ?? { dx: 0, dy: 0, hop: false }, 17);
      const b = p.batch(48)!; const r = applyBatch(server, b.fromTick, b.samples, ctx, 10_000);
      expect(r.ok).toBe(true); if (!r.ok) return; server = r.state.body; p.ack(server.tick);
    }
    expect(server).toEqual(p.body);
  });
  it('rebase replays unacknowledged inputs on top of the authoritative body', () => {
    const p = new Predictor(newBody(idx), ctx); p.catchUp(40, () => ({ dx: 1, dy: 0, hop: false }));
    const first = p.batch(20)!; const r = applyBatch(newBody(idx), first.fromTick, first.samples, ctx, 10_000); if (!r.ok) throw new Error('x');
    const before = { ...p.body }; p.rebase(r.state.body, ctx);
    expect(p.body).toEqual(before); expect(p.acked).toBe(20); expect(p.batch()!.fromTick).toBe(21);
  });
  it('drops stale inputs when the server idled the seat forward', () => {
    const p = new Predictor(newBody(idx), ctx); p.catchUp(10, () => ({ dx: 1, dy: 0, hop: false }));
    const ahead = { ...newBody(idx), tick: 200 }; p.rebase(ahead, ctx);
    expect(p.tick).toBe(200); expect(p.batch()).toBeNull();
  });
  it('never offers a batch with a gap', () => {
    const p = new Predictor(newBody(idx), ctx); p.catchUp(5, () => ({ dx: 0, dy: 1, hop: false })); p.ack(2);
    expect(p.batch()!.fromTick).toBe(3);
  });
});
