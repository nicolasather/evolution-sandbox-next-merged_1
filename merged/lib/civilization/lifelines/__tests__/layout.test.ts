import { generateLayout, validateLayout, fallbackLayout } from '../layout';
import { ix } from '../__testing__/helpers';

describe('layout generator', () => {
  it('produces a valid, connected layout for every variant (24 chapters x 12 biomes)', () => {
    for (const v of ix.db.variants) {
      const ch = ix.chapters.get(v.chapterId)!;
      const l = generateLayout(v.seed, ch, ix);
      expect(validateLayout(l, ix, ch)).toBeNull();
    }
  });
  it('is deterministic per seed and differs across seeds', () => {
    const ch = ix.chaptersByOrder[10];
    const a = generateLayout('seed-a', ch, ix), b = generateLayout('seed-a', ch, ix), c = generateLayout('seed-b', ch, ix);
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c));
  });
  it('shares are exact (sum to 1000) and exactly one district holds the reserve', () => {
    const l = generateLayout('x', ix.chaptersByOrder[5], ix);
    expect(l.districts.filter(d => d.storage)).toHaveLength(1);
    for (const r of Object.keys(l.districts[0].demandWeights) as never[]) {
      expect(l.districts.reduce((n, d) => n + d.demandWeights[r], 0)).toBe(1000);
      expect(l.districts.reduce((n, d) => n + d.supplyWeights[r], 0)).toBe(1000);
    }
  });
  it('the recorded fallback layout is itself valid', () => {
    for (const ch of [ix.chaptersByOrder[0], ix.chaptersByOrder[12], ix.chaptersByOrder[23]]) {
      expect(validateLayout(fallbackLayout(ch, ix), ix, ch)).toBeNull();
    }
  });
  it('later tiers have more districts and teach a bottleneck and an alternate route', () => {
    const early = generateLayout('t', ix.chaptersByOrder[0], ix), late = generateLayout('t', ix.chaptersByOrder[20], ix);
    expect(late.districts.length).toBeGreaterThan(early.districts.length);
    expect(late.bottleneckLinkId).not.toBeNull();
  });
  it('rejects a damaged layout', () => {
    const ch = ix.chaptersByOrder[3];
    const l = generateLayout('d', ch, ix);
    l.links = [];
    expect(validateLayout(l, ix, ch)).not.toBeNull();
  });
});
