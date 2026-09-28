import { generateSite } from '@/lib/archaeology/generate';
import { template } from '@/lib/archaeology/catalog';

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

  it('builds a full grid with every square carrying three stratigraphic contexts', () => {
    const s = generateSite('grid-check');
    expect(s.squares).toHaveLength(s.gridSize);
    for (const row of s.squares) {
      expect(row).toHaveLength(s.gridSize);
      for (const sq of row) {
        expect(sq.contexts).toHaveLength(3);
        expect(sq.contexts.map(c => c.phase)).toEqual(['late-occupation', 'peak-occupation', 'early-occupation']);
        expect(sq.dugContexts).toBe(0);
        expect(sq.surveyHint).toBe('unsurveyed');
      }
    }
  });

  it('every embedded find references a real catalog template and a real grid position', () => {
    const s = generateSite('finds-check');
    expect(s.finds.length).toBeGreaterThan(0);
    for (const f of s.finds) {
      expect(() => template(f.templateId)).not.toThrow();
      const sq = s.squares[f.squareY][f.squareX];
      expect(sq.contexts[f.contextIndex].findIds).toContain(f.id);
      expect(f.analyzed).toBe(false);
    }
  });

  it('places more finds in the site\'s own primary phase than in either other phase', () => {
    // Statistically true across many seeds, not guaranteed for one — check the aggregate.
    let primary = 0;
    let other = 0;
    for (let i = 0; i < 30; i++) {
      const s = generateSite(`phase-density-${i}`);
      for (const f of s.finds) {
        if (f.phase === s.truth.primaryPhase) primary++; else other++;
      }
    }
    // Two non-primary phases share the smaller chance, so normalise per phase.
    expect(primary).toBeGreaterThan(other / 2);
  });
});
