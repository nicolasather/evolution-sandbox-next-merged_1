import { validateSpec } from '../schema';

const one = (part: Record<string, unknown>) => ({ layers: [{ z: 0, parts: [part] }] });

describe('validateSpec — AI output is untrusted data', () => {
  it('rejects non-objects, missing layers and empty specs', () => {
    expect(validateSpec(null).ok).toBe(false);
    expect(validateSpec([]).ok).toBe(false);
    expect(validateSpec({}).ok).toBe(false);
    expect(validateSpec({ layers: [] }).ok).toBe(false);
    expect(validateSpec({ layers: [{ z: 0, parts: [] }] }).ok).toBe(false);
  });

  it('rejects unknown components (nothing outside the catalogue can run)', () => {
    const r = validateSpec(one({ c: 'eval', p: {} }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/unknown component/);
    expect(validateSpec(one({ c: '__proto__', p: {} })).ok).toBe(false);
    expect(validateSpec(one({ c: 'constructor', p: {} })).ok).toBe(false);
  });

  it('requires required numbers and rejects wrong types', () => {
    expect(validateSpec(one({ c: 'ellipse', p: {} })).ok).toBe(false);
    expect(validateSpec(one({ c: 'ellipse', p: { rx: 'big' } })).ok).toBe(false);
    expect(validateSpec(one({ c: 'ellipse', p: { rx: { valueOf: 1 } } })).ok).toBe(false);
    expect(validateSpec(one({ c: 'polyline', p: { pts: [[1, 2]] } })).ok).toBe(false);
    expect(validateSpec(one({ c: 'polyline', p: { pts: [[1, 'a'], [2, 3]] } })).ok).toBe(false);
  });

  it('accepts clean numeric strings but not junk', () => {
    expect(validateSpec(one({ c: 'ellipse', p: { rx: '12' } })).ok).toBe(true);
    expect(validateSpec(one({ c: 'ellipse', p: { rx: '12px' } })).ok).toBe(false);
    expect(validateSpec(one({ c: 'ellipse', p: { rx: NaN } })).ok).toBe(false);
    expect(validateSpec(one({ c: 'ellipse', p: { rx: Infinity } })).ok).toBe(false);
  });

  it('clamps out-of-range numbers with a warning instead of trusting them', () => {
    const r = validateSpec(one({ c: 'ellipse', x: 9999, p: { rx: 5000 } }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.spec.layers[0].parts[0].p.rx).toBe(80);
      expect(r.spec.layers[0].parts[0].x).toBe(160);
      expect(r.warnings.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('rejects an enum value outside its list', () => {
    expect(validateSpec(one({ c: 'stick', p: { x1: 0, y1: 0, x2: 1, y2: 1, caps: 'javascript:alert(1)' } })).ok).toBe(false);
  });

  it('ignores unknown parameters and never copies them through', () => {
    const r = validateSpec(one({ c: 'ellipse', p: { rx: 5, onload: 'x()', __proto__: { polluted: true } } }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(Object.keys(r.spec.layers[0].parts[0].p)).not.toContain('onload');
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    }
  });

  it('bounds the size of a spec', () => {
    const parts = Array.from({ length: 200 }, () => ({ c: 'ellipse', p: { rx: 4 } }));
    const layers = Array.from({ length: 20 }, () => ({ z: 0, parts: parts.slice(0, 30) }));
    const r = validateSpec({ layers });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.spec.layers.length).toBeLessThanOrEqual(6);
      expect(r.spec.layers.reduce((a, l) => a + l.parts.length, 0)).toBeLessThanOrEqual(40);
    }
  });

  it('truncates a title and drops invalid weights', () => {
    const r = validateSpec({ title: 'x'.repeat(500), layers: [{ parts: [{ c: 'ellipse', w: 'neon', p: { rx: 4 } }] }] });
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.spec.title.length).toBe(80); expect(r.spec.layers[0].parts[0].w).toBeUndefined(); }
  });
});
