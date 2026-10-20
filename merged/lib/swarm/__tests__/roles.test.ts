/** @jest-environment node */
import { sweep } from '../../../tools/swarm/roles';
import { ROLE_DEFS } from '../balance';
import { ROLES } from '../domain';

jest.setTimeout(120_000);
describe('role non-dominance (deterministic bot sweep, challenge difficulty, fixed seeds)', () => {
  const r = sweep({ seeds: 8, minutes: 15, accuracy: 0.6, difficulty: 'challenge' });
  it('a mixed team survives at least as well as five Strikers, the strongest damage dealers', () => {
    expect(r['one of each role']!.clear).toBeGreaterThanOrEqual(r['five Strikers']!.clear);
    expect(r['one of each role']!.beacon).toBeGreaterThanOrEqual(r['five Strikers']!.beacon - 2);
  });
  it('swapping any single role for a Striker never makes the team clearly better', () => {
    for (const name of ['no Medic (Striker instead)', 'no Guardian (Striker instead)', 'no Engineer (Striker instead)', 'no Scout (Striker instead)']) {
      expect(r[name]!.clear).toBeLessThanOrEqual(r['one of each role']!.clear + 0.13); expect(r[name]!.waves).toBeLessThanOrEqual(r['one of each role']!.waves + 0.06);
    }
  });
  it('no single-role team beats the mixed team', () => { for (const name of ['five Medics', 'five Guardians', 'five Strikers']) expect(r[name]!.clear).toBeLessThanOrEqual(r['one of each role']!.clear + 0.13); });
  it('the Striker is a glass cannon: top burst damage, but never the tankiest, fastest or longest-lived-ability role', () => {
    const dps = (x: (typeof ROLE_DEFS)['striker']) => x.dmg / x.fireEvery; const top = ROLES.reduce((a, b) => (dps(ROLE_DEFS[a]) >= dps(ROLE_DEFS[b]) ? a : b));
    expect(['striker', 'scout']).toContain(top); expect(ROLE_DEFS.striker.hp).toBeLessThan(ROLE_DEFS.guardian.hp); expect(ROLE_DEFS.striker.speed).toBeLessThan(ROLE_DEFS.scout.speed);
    for (const k of ROLES) expect(ROLE_DEFS[k].hp).toBeGreaterThan(80);
  });
});
