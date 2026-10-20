/** Load shape: 4 teams × 5 = 20 seats through a full match with the real engine. Pure CPU (no network): it proves the per-tick cost and that the state stays bounded. */
import { playMatch } from '../testkit';

describe('20-seat match', () => {
  it('finishes, stays bounded, and a tick costs well under the 50 ms budget on average', () => {
    const t0 = performance.now(); let ticks = 0; let maxEvents = 0;
    const { state, ms } = playMatch({ format: 'control', sizes: [5, 5, 5, 5], minutes: 5, questions: 8, useAbilities: true, buy: true, onTick: (s) => { ticks++; maxEvents = Math.max(maxEvents, s.log.length); } });
    const cpu = performance.now() - t0;
    expect(state.phase).toBe('finished'); expect(state.seats.length).toBe(20);
    expect(cpu / Math.max(1, ticks)).toBeLessThan(25);
    expect(maxEvents).toBeLessThan(2000);
    expect(ms).toBeGreaterThan(60_000);
  });
});
