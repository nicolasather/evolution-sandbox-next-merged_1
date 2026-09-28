import { generateSettlement } from '@/lib/civilization/generate';

describe('generateSettlement', () => {
  it('is deterministic for the same seed', () => {
    expect(generateSettlement('a')).toEqual(generateSettlement('a'));
  });

  it('different seeds produce different starting populations', () => {
    const pops = new Set(['s1', 's2', 's3', 's4', 's5', 's6'].map(s => generateSettlement(s).population));
    expect(pops.size).toBeGreaterThan(1);
  });

  it('starts ongoing with the water-labor pressure already present', () => {
    const s = generateSettlement('start-check');
    expect(s.ending).toBe('ongoing');
    expect(s.problems.map(p => p.kind)).toContain('water-labor');
    expect(s.milestones.irrigationComplete).toBeUndefined();
  });
});
