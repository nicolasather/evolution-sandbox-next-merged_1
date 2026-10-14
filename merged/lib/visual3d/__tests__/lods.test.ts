import { chooseQuality, PARTICLE_BUDGET } from '../lods';

const base = { webgl: true, reducedMotion: false };
describe('quality tiers (package 048)', () => {
  it('falls back to SVG without WebGL, with reduced motion, data saver or ≤1 GB', () => {
    for (const env of [{ webgl: false, reducedMotion: false }, { ...base, reducedMotion: true }, { ...base, saveData: true }, { ...base, deviceMemoryGb: 1 }]) {
      const q = chooseQuality(env);
      expect(q.render).toBe('svg');
      expect(q.particleBudget).toBe(0);
      expect(q.spin).toBe(false);
    }
  });
  it('desktop = high/LOD0, mobile = medium/LOD1, weak phone = low/LOD2', () => {
    expect(chooseQuality({ ...base, deviceMemoryGb: 8 })).toMatchObject({ tier: 'high', lod: 0, render: 'webgl' });
    expect(chooseQuality({ ...base, narrow: true, hardwareConcurrency: 8 })).toMatchObject({ tier: 'medium', lod: 1 });
    expect(chooseQuality({ ...base, narrow: true, hardwareConcurrency: 4 })).toMatchObject({ tier: 'low', lod: 2 });
    expect(chooseQuality({ ...base, deviceMemoryGb: 2 })).toMatchObject({ tier: 'low' });
  });
  it('budgets only shrink as tiers get weaker', () => {
    expect(PARTICLE_BUDGET.high).toBeGreaterThan(PARTICLE_BUDGET.medium);
    expect(PARTICLE_BUDGET.medium).toBeGreaterThan(PARTICLE_BUDGET.low);
    expect(PARTICLE_BUDGET.low).toBeGreaterThan(PARTICLE_BUDGET.svg);
  });
});
