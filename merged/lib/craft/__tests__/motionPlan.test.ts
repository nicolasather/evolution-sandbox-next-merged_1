import { playDb } from '../../processing';
import { deriveSpec } from '../specs';
import { MAX_PARTICLES, MAX_TOTAL_MS, MOTION_FAMILIES, motionPlanFor, planFromMaterials } from '../motionPlan';
import type { Discovery } from '../../types';

const byId = new Map(playDb.nodes.map(n => [n.id, n]));
const eraIdx = new Map(playDb.eras.map((e, i) => [e.id, i]));

describe('motion plans', () => {
  it('stone + stone moves unlike fibre + wood', () => {
    const a = planFromMaterials(['stone', 'stone'], ['impact', 'separate']);
    const b = planFromMaterials(['fibre', 'wood'], ['align', 'wrap']);
    expect(a.family).toBe('percussive');
    expect(b.family).toBe('binding');
    expect(a.phases).not.toEqual(b.phases);
    expect(a.particles.count).toBeGreaterThan(b.particles.count * 2);
    expect(a.shake).toBeGreaterThan(b.shake);
    expect(a.sounds).not.toEqual(b.sounds);
  });

  it('has a plan for every real recipe with no per-item code, within budgets', () => {
    const fams = new Set<string>();
    let n = 0;
    for (const node of playDb.nodes) {
      const rec = node.rec?.[0];
      if (!rec || rec.length !== 2) continue;
      const [a, b] = rec.map(i => byId.get(i)).filter(Boolean) as Discovery[];
      if (!a || !b) continue;
      const spec = deriveSpec(a, b, node, { eraIndex: eraIdx.get(node.era) ?? 0 });
      const plan = motionPlanFor([a, b], spec);
      fams.add(plan.family);
      expect(plan.particles.count).toBeLessThanOrEqual(MAX_PARTICLES);
      expect(plan.phases.reduce((t, p) => t + p.ms, 0)).toBeLessThanOrEqual(MAX_TOTAL_MS);
      expect(plan.reduced.particles).toBe(0);
      expect(plan.reduced.shake).toBe(0);
      expect(plan.reduced.phases.reduce((t, p) => t + p.ms, 0)).toBeLessThan(500);
      for (const p of plan.phases) expect(p.amplitude).toBeLessThanOrEqual(1.3);
      n++;
    }
    expect(n).toBeGreaterThan(850);
    expect(fams.size).toBeGreaterThanOrEqual(7);
  });

  it('a brand-new item with no authored entry still gets a body and a plan', () => {
    const fresh = { id: 'brand_new_xyz', cat: 'technology', era: 'origins' } as Pick<Discovery, 'id' | 'cat' | 'era'>;
    const plan = planFromMaterials(['stone', 'bone'], ['grind']);
    expect(plan.family).toBe('abrasive');
    expect(motionPlanFor([fresh, fresh], { steps: [{ kind: 'touch' }] }).phases.length).toBe(5);
  });

  it('is deterministic', () => {
    expect(planFromMaterials(['earth', 'fire'], ['heat'])).toEqual(planFromMaterials(['earth', 'fire'], ['heat']));
  });

  it('every family definition is sane', () => {
    for (const f of Object.values(MOTION_FAMILIES)) {
      expect(f.phases).toHaveLength(5);
      expect(f.particles.count).toBeLessThanOrEqual(MAX_PARTICLES);
    }
  });
});
