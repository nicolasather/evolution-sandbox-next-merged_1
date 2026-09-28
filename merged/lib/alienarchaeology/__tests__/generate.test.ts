import { generateSite } from '@/lib/alienarchaeology/generate';
import { template } from '@/lib/alienarchaeology/catalog';

describe('generateSite', () => {
  it('is deterministic for the same seed', () => {
    const a = generateSite('repeat-check');
    const b = generateSite('repeat-check');
    expect(a).toEqual(b);
  });

  it('produces a different site for a different seed', () => {
    const a = generateSite('seed-a');
    const b = generateSite('seed-b');
    expect(a.truth).not.toEqual(b.truth);
  });

  it('selects 8 distinct specimens, each a real catalog template, all unrevealed', () => {
    const s = generateSite('specimen-check');
    expect(s.specimens).toHaveLength(8);
    expect(new Set(s.specimens.map(x => x.templateId)).size).toBe(8);
    for (const spec of s.specimens) {
      expect(() => template(spec.templateId)).not.toThrow();
      expect(spec.revealed).toBe(false);
    }
  });

  it('leans the specimen selection toward templates that support the site\'s own truth, on average', () => {
    // Statistical, not exhaustive — ambiguity is the deliberate point, so
    // this only checks the selection is meaningfully biased, not perfect.
    let totalRelevantHits = 0;
    let totalSpecimens = 0;
    for (let i = 0; i < 30; i++) {
      const s = generateSite(`bias-check-${i}`);
      totalSpecimens += s.specimens.length;
      for (const spec of s.specimens) {
        const t = template(spec.templateId);
        const hit = (t.evidence.limbCount?.[s.truth.limbCount] ?? 0)
          + (t.evidence.social?.[s.truth.social] ?? 0)
          + (t.evidence.purpose?.[s.truth.purpose] ?? 0);
        if (hit > 0) totalRelevantHits++;
      }
    }
    // With 12 templates and only 3 independent truth values to match, a
    // uniform-random pick would still hit fairly often — the real claim
    // is that the bias makes it hit MOST of the time.
    expect(totalRelevantHits / totalSpecimens).toBeGreaterThan(0.7);
  });
});
