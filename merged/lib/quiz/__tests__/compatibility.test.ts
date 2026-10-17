/** @jest-environment node */
import { allowedFlows, assertCompatible, compatibleModifiers, modifierAvailability } from '../compatibility';
import { MODIFIERS } from '../types';

describe('flows per play method', () => {
  it('classroom has ONLY synchronized and round robin', () => expect(allowedFlows('classroom')).toEqual(['synchronized', 'round_robin']));
  it('online has ONLY synchronized and independent', () => expect(allowedFlows('online')).toEqual(['synchronized', 'independent']));
  it('solo is independent only', () => expect(allowedFlows('solo')).toEqual(['independent']));
});
describe('modifier compatibility (evaluated after mode + flow)', () => {
  it('solo gets only Secret Wager and Potluck', () => expect(compatibleModifiers('solo', 'independent').sort()).toEqual(['potluck', 'secret_wager']));
  it('Limited Slots needs a synchronized flow', () => {
    expect(compatibleModifiers('classroom', 'synchronized')).toContain('limited_slots');
    expect(compatibleModifiers('online', 'synchronized')).toContain('limited_slots');
    expect(compatibleModifiers('classroom', 'round_robin')).not.toContain('limited_slots');
    expect(compatibleModifiers('online', 'independent')).not.toContain('limited_slots');
  });
  it('Steal the Question is classroom round robin only', () => {
    for (const [m, f] of [['classroom', 'synchronized'], ['online', 'synchronized'], ['online', 'independent'], ['solo', 'independent']] as const) expect(compatibleModifiers(m, f)).not.toContain('steal_question');
    expect(compatibleModifiers('classroom', 'round_robin')).toContain('steal_question');
  });
  it('all nine modifiers exist and every unavailable one carries a reason', () => {
    expect(MODIFIERS).toHaveLength(9);
    for (const m of MODIFIERS) { const a = modifierAvailability('solo', 'independent', m); if (!a.ok) expect(a.reason.length).toBeGreaterThan(5); }
  });
  it('assertCompatible rejects incompatible and duplicate choices instead of silently dropping them', () => {
    expect(() => assertCompatible('solo', 'independent', ['steal_points'])).toThrow(/Incompatible/);
    expect(() => assertCompatible('online', 'independent', ['limited_slots'])).toThrow(/Incompatible/);
    expect(() => assertCompatible('classroom', 'independent', [])).toThrow(/flow/);
    expect(() => assertCompatible('online', 'synchronized', ['potluck', 'potluck'])).toThrow(/Duplicate/);
    expect(() => assertCompatible('classroom', 'round_robin', ['steal_question', 'secret_wager'])).not.toThrow();
  });
});
