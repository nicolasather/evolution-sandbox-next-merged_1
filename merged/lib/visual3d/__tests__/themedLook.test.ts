/** @jest-environment node */
import { MATERIAL_LOOK, themedLook } from '../materials';

describe('themed material looks', () => {
  it('leaves every existing theme exactly as it was', () => {
    for (const t of [undefined, null, 'dark', 'light', 'neon', 'ember']) {
      for (const id of Object.keys(MATERIAL_LOOK) as (keyof typeof MATERIAL_LOOK)[]) {
        expect(themedLook(id, t)).toBe(MATERIAL_LOOK[id]);
      }
    }
  });
  it('recolours only — never roughness, metalness or id — under the art themes', () => {
    for (const t of ['pixel', 'cartoon']) {
      for (const id of Object.keys(MATERIAL_LOOK) as (keyof typeof MATERIAL_LOOK)[]) {
        const l = themedLook(id, t);
        expect(l.id).toBe(id);
        expect(l.roughness).toBe(MATERIAL_LOOK[id].roughness);
        expect(l.metalness).toBe(MATERIAL_LOOK[id].metalness);
        expect(l.colors).toHaveLength(3);
      }
    }
    expect(themedLook('metal', 'pixel').colors[0]).toBe('#b96438');
    expect(themedLook('bone', 'cartoon')).toBe(MATERIAL_LOOK.bone);
  });
});
