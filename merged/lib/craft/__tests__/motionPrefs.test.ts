import { planFromMaterials } from '../motionPlan';
import { resolveMotion } from '../motionPrefs';

const plan = planFromMaterials(['stone', 'stone'], []);
describe('motion preferences (package 055)', () => {
  it('reduced motion: instant, <0.5 s, no particles, no shake, no vibration', () => {
    const r = resolveMotion(plan, { reducedMotion: true, audio: true, vibration: true });
    expect(r.instant).toBe(true);
    expect(r.totalMs).toBeLessThan(500);
    expect(r.particles).toBe(0);
    expect(r.shake).toBe(0);
    expect(r.vibrate).toBe(false);
  });
  it('audio off never yields a sound, whatever else is set', () => {
    for (const reducedMotion of [true, false]) expect(resolveMotion(plan, { reducedMotion, audio: false }).sounds).toEqual([]);
  });
  it('normal motion keeps the family plan; vibration is opt-in', () => {
    const r = resolveMotion(plan, { reducedMotion: false, audio: true });
    expect(r.particles).toBe(plan.particles.count);
    expect(r.sounds.length).toBeGreaterThan(0);
    expect(r.vibrate).toBe(false);
    expect(resolveMotion(plan, { reducedMotion: false, audio: true, vibration: true }).vibrate).toBe(true);
  });
});
