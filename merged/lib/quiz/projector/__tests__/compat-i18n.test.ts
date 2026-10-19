import { allowedModifiers, assertProjectorModifiers, modifierRule } from '../compat';
import { GAME_KEYS } from '../types';
import { MODES, MODE_LIST } from '../modes';
import { STR } from '../../../../components/quiz/projector/i18n';
import { MODIFIERS } from '../../types';

describe('modifier compatibility', () => {
  it('every game explains every modifier in English', () => {
    for (const g of GAME_KEYS) for (const m of MODIFIERS) { const r = modifierRule(g, m); expect(r.reason.en.length).toBeGreaterThan(3);  }
  });
  it('no classic modifier is silently accepted by a projector game', () => {
    for (const g of GAME_KEYS) { expect(allowedModifiers(g)).toEqual([]); if (MODIFIERS.length) expect(() => assertProjectorModifiers(g, [MODIFIERS[0]!])).toThrow(); }
  });
});
describe('localisation coverage', () => {
  it('every UI string has English text', () => {
    for (const [k, v] of Object.entries(STR)) { expect((v as { en: string }).en.trim()).not.toBe('');  void k; }
  });
  it('every game has full registry text and art', () => {
    expect(MODE_LIST).toHaveLength(10);
    for (const g of GAME_KEYS) { const m = MODES[g]; for (const f of [m.name, m.tagline, m.objective, m.style, m.skillRule]) { expect(f.en).toBeTruthy(); } expect(m.art).toBeTruthy(); }
  });
});
