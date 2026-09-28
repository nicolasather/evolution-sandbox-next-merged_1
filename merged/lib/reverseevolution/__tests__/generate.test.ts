import { TARGETS } from '@/lib/reverseevolution/catalog';
import { generateRun } from '@/lib/reverseevolution/generate';
import { playDb } from '@/lib/processing';

describe('generateRun', () => {
  it('is deterministic for the same seed', () => {
    const a = generateRun(playDb, 'repeat-check', 'smartphone');
    const b = generateRun(playDb, 'repeat-check', 'smartphone');
    expect(a).toEqual(b);
  });

  it('produces a different option order for a different seed', () => {
    const a = generateRun(playDb, 'seed-a', 'smartphone');
    const b = generateRun(playDb, 'seed-b', 'smartphone');
    expect(a.nodes.n0.optionIds).not.toEqual(b.nodes.n0.optionIds);
  });

  it('every catalog target is real, non-primitive, and has a real recipe in the actual database', () => {
    const byId = new Map(playDb.nodes.map(n => [n.id, n]));
    for (const t of TARGETS) {
      const node = byId.get(t.id);
      expect(node).toBeDefined();
      expect(node!.primitive).not.toBe(true);
      expect(node!.rec.length).toBeGreaterThan(0);
    }
  });

  it('the root question always includes both real ingredients among its options', () => {
    for (const t of TARGETS) {
      const run = generateRun(playDb, `root-check-${t.id}`, t.id);
      const target = playDb.nodes.find(n => n.id === t.id)!;
      const real = target.rec[0];
      for (const id of real) expect(run.nodes.n0.optionIds).toContain(id);
    }
  });

  it('the root question offers at least 4 distinct options, all real discovery ids', () => {
    const validIds = new Set(playDb.nodes.map(n => n.id));
    for (const t of TARGETS) {
      const run = generateRun(playDb, `option-check-${t.id}`, t.id);
      const opts = run.nodes.n0.optionIds!;
      expect(opts.length).toBeGreaterThanOrEqual(4);
      expect(new Set(opts).size).toBe(opts.length);
      for (const id of opts) expect(validIds.has(id)).toBe(true);
    }
  });

  it('throws for a target with no real recipe (nothing to decompose)', () => {
    const primitive = playDb.nodes.find(n => n.primitive)!;
    expect(() => generateRun(playDb, 'primitive-check', primitive.id)).toThrow();
  });
});
