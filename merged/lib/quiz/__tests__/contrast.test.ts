/** @jest-environment node */
import { checkTheme, contrastRatio } from '../contrast';
import { THEMES, themeInfo } from '../settings';

describe('contrast', () => {
  it('matches the WCAG reference values', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBe(21);
    expect(contrastRatio('#777777', '#FFFFFF')).toBeCloseTo(4.48, 1);
    expect(contrastRatio('#fff', '#fff')).toBe(1);
  });
  it('every shipped theme passes AA for text, panels and button text', () => {
    for (const id of THEMES) {
      const bad = checkTheme(themeInfo[id].vars).filter((c) => !c.pass);
      expect({ id, bad: bad.map((b) => `${b.label} ${b.ratio}`) }).toEqual({ id, bad: [] });
    }
  });
});
