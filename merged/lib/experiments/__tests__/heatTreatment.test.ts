import { runHeatTreatment } from '@/lib/experiments/heatTreatment';

describe('runHeatTreatment', () => {
  it('is deterministic — same inputs, same outcome, every time', () => {
    const a = runHeatTreatment({ intensity: 55, duration: 55 });
    const b = runHeatTreatment({ intensity: 55, duration: 55 });
    expect(a).toEqual(b);
  });

  it('high intensity brought up quickly causes thermal shock', () => {
    expect(runHeatTreatment({ intensity: 90, duration: 10 }).outcome).toBe('thermal-shock');
  });

  it('very high intensity overheats regardless of duration', () => {
    expect(runHeatTreatment({ intensity: 95, duration: 90 }).outcome).toBe('overheated');
  });

  it('too little heat, sustained a long time, still underfires', () => {
    expect(runHeatTreatment({ intensity: 10, duration: 80 }).outcome).toBe('underfired');
  });

  it('a moderate heat held for too short a time underfires (distinct from a fast, high-heat shock)', () => {
    expect(runHeatTreatment({ intensity: 50, duration: 5 }).outcome).toBe('underfired');
  });

  it('a moderate, sustained heat succeeds', () => {
    expect(runHeatTreatment({ intensity: 55, duration: 55 }).outcome).toBe('success');
  });

  it('every outcome has a non-empty physical description and an insight line', () => {
    for (const [intensity, duration] of [[90, 10], [95, 90], [10, 80], [55, 55]]) {
      const r = runHeatTreatment({ intensity, duration });
      expect(r.description.length).toBeGreaterThan(10);
      expect(r.insight.length).toBeGreaterThan(10);
    }
  });

  it('clamps out-of-range inputs instead of behaving strangely', () => {
    expect(() => runHeatTreatment({ intensity: 500, duration: -50 })).not.toThrow();
    const r = runHeatTreatment({ intensity: 500, duration: -50 });
    expect(['thermal-shock', 'overheated', 'underfired', 'success']).toContain(r.outcome);
  });
});
