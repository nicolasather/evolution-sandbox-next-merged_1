import { fit } from '../regions';
import { MAX_ACTIVE, MAX_VOICES, PER_KIND, REPEAT_MS, SceneFxEngine } from '../engine';

const VW = 1440, VH = 900, PAR = { x: 0, y: 0 };
const { s, ox, oy } = fit(VW, VH);
const scr = (u: number, v: number) => ({ x: ox + u * s, y: oy + v * s });

/** Click the ancient city's river (water), ground (dust) at scene coordinates. */
const water = (e: SceneFxEngine, u: number, v: number, now: number) => { const p = scr(u, v); return e.click('ancientcity', p.x, p.y, VW, VH, PAR, now); };

describe('SceneFxEngine', () => {
  it('answers water with water, ground with dust, and the sky with nothing', () => {
    const e = new SceneFxEngine();
    expect(water(e, 800, 700, 0)?.hit.kind).toBe('water');
    expect(water(e, 800, 850, 1000)?.hit.kind).toBe('dust');
    expect(water(e, 800, 200, 2000)).toBeNull();
    expect(e.effects.map(f => f.kind)).toEqual(['water', 'dust']);
  });

  it('water makes ripples and droplets; reduced motion makes one quiet ring', () => {
    const e = new SceneFxEngine();
    const r = water(e, 800, 700, 0)!;
    expect(r.effect.ripples.length).toBe(3);
    expect(r.effect.parts.length).toBeGreaterThanOrEqual(7);
    const calm = new SceneFxEngine();
    calm.reduced = true;
    const c = water(calm, 800, 700, 0)!;
    expect(c.effect.ripples.length).toBe(1);
    expect(c.effect.parts.length).toBe(0);
  });

  it('never keeps more than PER_KIND of one sort or MAX_ACTIVE overall', () => {
    const e = new SceneFxEngine();
    for (let i = 0; i < 12; i++) water(e, 100 + i * 120, 700, i * 500);
    expect(e.effects.filter(f => f.kind === 'water').length).toBeLessThanOrEqual(PER_KIND);
    for (let i = 0; i < 12; i++) water(e, 100 + i * 120, 850, 10000 + i * 500);
    expect(e.effects.length).toBeLessThanOrEqual(MAX_ACTIVE);
  });

  it('caps overlapping sounds and lets them free up again', () => {
    const e = new SceneFxEngine();
    const heard: boolean[] = [];
    for (let i = 0; i < 6; i++) heard.push(!!water(e, 100 + i * 200, 700, i * 20)?.sound);   // a rapid flurry
    expect(heard.filter(Boolean).length).toBeLessThanOrEqual(MAX_VOICES);
    expect(!!water(e, 900, 700, 5000)?.sound).toBe(true);                                    // long after: audible again
  });

  it('sounds vary and stay inside safe ranges', () => {
    const e = new SceneFxEngine();
    const rates = new Set<number>();
    for (let i = 0; i < 8; i++) {
      const cue = water(e, 200 + i * 150, 700, i * 3000)?.sound;
      expect(cue).toBeTruthy();
      expect(cue!.vol).toBeGreaterThan(0); expect(cue!.vol).toBeLessThanOrEqual(1);
      expect(Math.abs(cue!.pan)).toBeLessThanOrEqual(0.7);
      rates.add(cue!.rate);
    }
    expect(rates.size).toBeGreaterThan(4);
  });

  it('treats a double-fire in the same spot as one click', () => {
    const e = new SceneFxEngine();
    expect(water(e, 800, 700, 0)).not.toBeNull();
    expect(water(e, 802, 701, REPEAT_MS - 10)).toBeNull();
    expect(water(e, 802, 701, REPEAT_MS + 10)).not.toBeNull();
  });

  it('effects age out', () => {
    const e = new SceneFxEngine();
    water(e, 800, 700, 0);
    expect(e.alive).toBe(true);
    for (let i = 0; i < 200; i++) e.update(1 / 60);
    expect(e.alive).toBe(false);
  });

  it('draws without throwing on a stub context', () => {
    const e = new SceneFxEngine();
    water(e, 800, 700, 0); water(e, 800, 850, 1000);
    e.update(0.1);
    const noop = () => {};
    const g = new Proxy({}, { get: (_t, k) => (k === 'createRadialGradient' ? () => ({ addColorStop: noop }) : noop), set: () => true }) as unknown as CanvasRenderingContext2D;
    expect(() => e.draw(g, VW, VH, PAR, { bone: '#fff', bone2: '#ccc', bone3: '#999', line: '', line3: '', ochre: '#c80', ink: '#000', good: '#0f0', hot: '#f80', water: '#08f' })).not.toThrow();
  });
});
