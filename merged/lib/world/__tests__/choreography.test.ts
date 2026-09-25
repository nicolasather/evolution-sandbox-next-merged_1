import {
  buildPlan, frameAt, NEAR_ANGLE, NEUTRAL, startDelay, ZOOM, ZOOM_WORLD,
  type Anchor, type MajorPlanInput, type EraPlanInput,
} from '../choreography';
import { angleOf } from '../geo';

const site = (lat: number, lon: number): Anchor => ({ lat, lon, precision: 'site' });
const CAIRO = site(30.05, 31.23);
const LONDON = site(51.5, -0.12);
const NEAR = site(33.9, 35.5);   // Beirut, ~ 570 km from Cairo
const NEXT_DOOR = site(30.1, 31.9);   // ~ 65 km from Cairo

const major = (o: Partial<MajorPlanInput> = {}): MajorPlanInput => ({
  kind: 'major', tier: 'A', from: CAIRO, to: LONDON, motion: 'full', quality: 'high', ...o,
});
const era = (n = 5, o: Partial<EraPlanInput> = {}): EraPlanInput => ({
  kind: 'era', points: Array.from({ length: n }, (_, i) => ({ lat: 10 + i * 8, lon: 20 + i * 15 })), motion: 'full', quality: 'high', ...o,
});

describe('startDelay', () => {
  it('is the beat after the craft: short, shorter for reduced motion, a little less on weak devices', () => {
    expect(startDelay('high', false)).toBe(350);
    expect(startDelay('low', false)).toBe(250);
    expect(startDelay('high', true)).toBe(200);
    for (const q of ['high', 'medium', 'low'] as const) {
      for (const r of [false, true]) {
        expect(startDelay(q, r)).toBeGreaterThanOrEqual(200);
        expect(startDelay(q, r)).toBeLessThanOrEqual(500);
      }
    }
  });
});

describe('a major invention (tier A)', () => {
  it('runs about 3–5 s in total, with the phases in order', () => {
    const p = buildPlan(major());
    expect(p.total).toBeGreaterThanOrEqual(3000);
    expect(p.total).toBeLessThanOrEqual(5000);
    expect(p.segments.map(s => s.name)).toEqual(['enter', 'linger', 'travel', 'zoom', 'reveal', 'exit']);
    // contiguous, no gaps
    p.segments.forEach((s, i) => { if (i) expect(s.start).toBe(p.segments[i - 1].end); });
    expect(p.segments[0].start).toBe(0);
    expect(p.segments[p.segments.length - 1].end).toBe(p.total);
  });

  it('keeps the spin and the zoom inside the brief (spin 1–2 s at most, zoom 0.7–1.1 s)', () => {
    const p = buildPlan(major({ to: site(-33.9, 151.2) }));
    const dur = (n: string) => { const s = p.segments.find(x => x.name === n)!; return s.end - s.start; };
    expect(dur('travel')).toBeGreaterThanOrEqual(650); expect(dur('travel')).toBeLessThanOrEqual(2000);
    expect(dur('zoom')).toBeGreaterThanOrEqual(700); expect(dur('zoom')).toBeLessThanOrEqual(1100);
  });

  it('opens the skip window after 1.5 s (never earlier than the brief allows)', () => {
    const p = buildPlan(major());
    expect(p.skipAfter).toBeGreaterThanOrEqual(1500);
    expect(p.skipAfter).toBeLessThan(p.total);
  });

  it('starts at the previous major and ends on the new one', () => {
    const p = buildPlan(major());
    expect(p.camStart.lat).toBeCloseTo(CAIRO.lat, 6); expect(p.camStart.lon).toBeCloseTo(CAIRO.lon, 6);
    expect(p.camEnd.lat).toBeCloseTo(LONDON.lat, 6); expect(p.camEnd.lon).toBeCloseTo(LONDON.lon, 6);
    expect(p.move).toBe('journey');
    expect(p.arcOn).toBe(true);
    const f0 = frameAt(p, 0);
    expect(f0.cam.lat).toBeCloseTo(CAIRO.lat, 4);
    const fEnd = frameAt(p, p.total - 1);
    expect(fEnd.cam.lat).toBeCloseTo(LONDON.lat, 1);
  });

  it('is on the new place, zoomed in by its precision, once it settles', () => {
    const p = buildPlan(major());
    expect(p.camEnd.zoom).toBe(ZOOM.site);
    const rev = p.segments.find(s => s.name === 'reveal')!;
    const f = frameAt(p, rev.start + 200);
    expect(f.cam.zoom).toBeCloseTo(ZOOM.site, 4);
    expect(f.pulse).toBeGreaterThanOrEqual(0);
  });

  it('keeps a lifted centre so the card has room beneath the globe (more on a narrow screen)', () => {
    expect(buildPlan(major()).camEnd.shift).toBeCloseTo(0.07);
    expect(buildPlan(major({ narrow: true })).camEnd.shift).toBeCloseTo(0.13);
  });

  it('pulls the camera back on a long journey', () => {
    const p = buildPlan(major({ to: site(-33.9, 151.2) }));
    const tr = p.segments.find(s => s.name === 'travel')!;
    const mid = frameAt(p, (tr.start + tr.end) / 2);
    expect(mid.cam.zoom).toBeLessThan(Math.min(p.camStart.zoom, p.camEnd.zoom));
  });

  it('draws the journey arc only while travelling and fades it after', () => {
    const p = buildPlan(major());
    const tr = p.segments.find(s => s.name === 'travel')!;
    expect(frameAt(p, tr.start - 1).arc).toBe(-1);
    const mid = frameAt(p, (tr.start + tr.end) / 2);
    expect(mid.arc).toBeGreaterThan(0); expect(mid.arc).toBeLessThan(1);
    const rev = p.segments.find(s => s.name === 'reveal')!;
    expect(frameAt(p, rev.start + 1500).arcAlpha).toBe(0);
  });

  it('fades the globe in and out, and only the card is there at the end of the reveal', () => {
    const p = buildPlan(major());
    expect(frameAt(p, 0).veil).toBe(0);
    const rev = p.segments.find(s => s.name === 'reveal')!;
    const inReveal = frameAt(p, rev.end - 100);
    expect(inReveal.veil).toBe(1);
    expect(inReveal.card).toBeGreaterThan(0.99);
    const end = frameAt(p, p.total);
    expect(end.veil).toBeCloseTo(0, 5);
    expect(end.card).toBeCloseTo(0, 5);
    expect(end.done).toBe(true);
    expect(frameAt(p, p.total - 1).done).toBe(false);
  });

  it('clamps time outside the plan', () => {
    const p = buildPlan(major());
    expect(frameAt(p, -500).t).toBe(0);
    expect(frameAt(p, p.total + 5000).t).toBe(p.total);
  });
});

describe('the first major ever', () => {
  it('starts from a neutral view of the whole world and takes the full journey', () => {
    const p = buildPlan(major({ from: null }));
    expect(p.camStart.zoom).toBe(ZOOM_WORLD);
    expect(p.camStart.lat).toBe(NEUTRAL.lat);
    expect(p.move).toBe('journey');
    expect(p.segments.find(s => s.name === 'linger')).toBeUndefined();
    expect(p.total).toBeGreaterThanOrEqual(3000);
  });
});

describe('tier B', () => {
  it('is clearly shorter than tier A for the same journey', () => {
    const a = buildPlan(major()), b = buildPlan(major({ tier: 'B' }));
    expect(b.total).toBeLessThan(a.total);
    expect(b.total).toBeGreaterThanOrEqual(2500);
    expect(b.skipAfter).toBeLessThanOrEqual(a.skipAfter);
  });
});

describe('places that are close', () => {
  it('shift regionally instead of making a journey', () => {
    expect(angleOf(CAIRO, NEAR)).toBeLessThan(NEAR_ANGLE);
    const p = buildPlan(major({ to: NEAR }));
    expect(p.move).toBe('shift');
    expect(p.arcOn).toBe(false);
    const j = buildPlan(major());
    const dur = (pl: typeof p) => { const s = pl.segments.find(x => x.name === 'travel')!; return s.end - s.start; };
    expect(dur(p)).toBeLessThan(dur(j));
  });

  it('do not move at all when it is the very same place, or next door', () => {
    for (const to of [CAIRO, NEXT_DOOR]) {
      const p = buildPlan(major({ to }));
      expect(p.move).toBe('none');
      expect(p.segments.find(s => s.name === 'travel')).toBeUndefined();
    }
  });
});

describe('reduced motion', () => {
  it('never travels or zooms: the globe fades up already on the place', () => {
    const p = buildPlan(major({ motion: 'reduced' }));
    expect(p.move).toBe('none');
    expect(p.arcOn).toBe(false);
    expect(p.segments.map(s => s.name)).toEqual(['enter', 'reveal', 'exit']);
    for (const t of [0, 400, 1200, p.total - 10]) {
      const f = frameAt(p, t);
      expect(f.cam.lat).toBeCloseTo(LONDON.lat, 6);
      expect(f.cam.lon).toBeCloseTo(LONDON.lon, 6);
      expect(f.cam.zoom).toBeCloseTo(ZOOM.site, 6);
    }
    expect(p.total).toBeLessThan(5000);
  });
});

describe('a place with no single location', () => {
  it('rests on the whole world, without a pin or an arc', () => {
    const p = buildPlan(major({ to: { lat: 0, lon: 0, precision: 'unlocated' } }));
    expect(p.unlocated).toBe(true);
    expect(p.arcOn).toBe(false);
    expect(p.camEnd.zoom).toBe(ZOOM_WORLD);
    expect(p.camEnd.shift).toBe(0);
  });

  it('starts from a neutral view when the previous major had none either', () => {
    const p = buildPlan(major({ from: { lat: 0, lon: 0, precision: 'unlocated' }, to: LONDON }));
    expect(p.camStart.lat).toBe(NEUTRAL.lat);
  });
});

describe('zoom by precision: never more exact than the evidence', () => {
  it('zooms less for a broader claim', () => {
    expect(ZOOM.site).toBeGreaterThan(ZOOM.area);
    expect(ZOOM.area).toBeGreaterThan(ZOOM.region);
    expect(ZOOM.region).toBeGreaterThan(ZOOM.broad);
    expect(ZOOM.broad).toBeGreaterThan(ZOOM.unlocated);
    const area = buildPlan(major({ to: { ...LONDON, precision: 'area' } }));
    const region = buildPlan(major({ to: { ...LONDON, precision: 'region' } }));
    expect(area.camEnd.zoom).toBeGreaterThan(region.camEnd.zoom);
  });
});

describe('inspect (looking again from the archive)', () => {
  it('is the light version: no arc, a shorter stay', () => {
    const full = buildPlan(major());
    const p = buildPlan(major({ inspect: true }));
    expect(p.arcOn).toBe(false);
    expect(p.total).toBeLessThan(full.total);
  });
});

describe('several early centres', () => {
  it('pulls back and leans toward them so they are in the picture', () => {
    const to = site(33.4, 44.4);    // Mesopotamia
    const alone = buildPlan(major({ to, from: null }));
    const withOthers = buildPlan(major({ to, from: null, others: [{ lat: 34.5, lon: 110 }, { lat: 17, lon: -95 }] }));
    expect(withOthers.camEnd.zoom).toBeLessThan(alone.camEnd.zoom);
    expect(withOthers.camEnd.zoom).toBeGreaterThanOrEqual(0.86);
    expect(withOthers.camEnd.lon).not.toBeCloseTo(alone.camEnd.lon, 1);
  });

  it('ignores a centre so close it is already in the picture', () => {
    const to = site(33.4, 44.4);
    const alone = buildPlan(major({ to, from: null }));
    const withNear = buildPlan(major({ to, from: null, others: [{ lat: 33.5, lon: 44.6 }] }));
    expect(withNear.camEnd.zoom).toBe(alone.camEnd.zoom);
  });

  it('ignores a centre on the far side of the world (it could not be shown anyway)', () => {
    const to = site(33.4, 44.4);
    const alone = buildPlan(major({ to, from: null }));
    const far = buildPlan(major({ to, from: null, others: [{ lat: -33.4, lon: -135.6 }] }));
    expect(far.camEnd.zoom).toBe(alone.camEnd.zoom);
  });
});

describe('an era completing', () => {
  it('has the phases: zoom out, light every marker, the title, then out', () => {
    const p = buildPlan(era());
    expect(p.kind).toBe('era');
    expect(p.segments.map(s => s.name)).toEqual(['enter', 'era_zoomout', 'era_light', 'era_title', 'exit']);
    expect(p.total).toBeGreaterThanOrEqual(3000);
    expect(p.total).toBeLessThanOrEqual(6000);
  });

  it('lights the markers one by one and has them all lit when the title arrives', () => {
    const inp = era(6);
    const p = buildPlan(inp);
    const light = p.segments.find(s => s.name === 'era_light')!;
    const title = p.segments.find(s => s.name === 'era_title')!;
    const early = frameAt(p, light.start + p.lightEach * 2).light;
    expect(early).toBeGreaterThan(0); expect(early).toBeLessThan(6);
    expect(frameAt(p, title.start + 10).light).toBe(6);
    expect(frameAt(p, light.start - 1).title).toBe(0);
    expect(frameAt(p, title.start + 800).title).toBeGreaterThan(0.99);
  });

  it('copes with an era that has no place to light', () => {
    const p = buildPlan(era(0));
    expect(Number.isFinite(p.total)).toBe(true);
    const f = frameAt(p, p.total / 2);
    expect(Number.isFinite(f.cam.lat + f.cam.lon + f.cam.zoom)).toBe(true);
  });

  it('with reduced motion is a still image with the title', () => {
    const p = buildPlan(era(5, { motion: 'reduced' }));
    expect(p.segments.map(s => s.name)).toEqual(['enter', 'era_title', 'exit']);
    const f = frameAt(p, 600);
    expect(f.light).toBe(5);
    expect(f.cam.zoom).toBeCloseTo(ZOOM_WORLD, 6);
  });
});
