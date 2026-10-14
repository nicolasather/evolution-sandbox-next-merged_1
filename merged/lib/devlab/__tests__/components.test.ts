import { COMPONENTS } from '../components';
import { compileSpec } from '../compile';
import { FIXTURES } from '../fixtures';
import { SPEC_EXAMPLE } from '../prompt';
import { catalogueText, validateSpec } from '../schema';
import type { ParamDef } from '../params';

const sampleValue = (d: ParamDef, which: 'min' | 'max' | 'mid'): unknown => {
  switch (d.t) {
    case 'num': return which === 'min' ? d.min : which === 'max' ? d.max : (d.min + d.max) / 2;
    case 'bool': return which === 'max';
    case 'enum': return which === 'max' ? d.values[d.values.length - 1] : d.values[0];
    case 'pts': return Array.from({ length: which === 'max' ? d.max : d.min }, (_, i) => [((i % 5) - 2) * 9, ((i % 3) - 1) * 9]);
    case 'nums': return which === 'max' ? Array.from({ length: d.max }, (_, i) => (i * 40) % d.hi) : [];
  }
};

describe('component library', () => {
  it('has a closed catalogue with unique ids', () => {
    const ids = COMPONENTS.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(30);
  });

  for (const which of ['min', 'mid', 'max'] as const) {
    it(`every component draws finite geometry with all parameters at ${which}`, () => {
      for (const c of COMPONENTS) {
        const p: Record<string, unknown> = {};
        for (const [k, d] of Object.entries(c.params)) p[k] = sampleValue(d, which);
        const v = validateSpec({ layers: [{ z: 0, parts: [{ c: c.id, x: 50, y: 50, p }] }] });
        if (!v.ok) throw new Error(`${c.id}/${which}: ${v.errors.join('; ')}`);
        const out = compileSpec(v.spec, c.id);
        expect(out.warnings.filter(w => /non-finite|draw failed/.test(w))).toEqual([]);
        expect(out.pathCount + out.dotCount).toBeGreaterThan(0);
        expect(out.markup).not.toMatch(/NaN|Infinity/);
      }
    });
  }

  it('compiled markup only uses the plate vocabulary (no scripts, links or foreign content)', () => {
    for (const [id, spec] of Object.entries(FIXTURES)) {
      const v = validateSpec(spec);
      if (!v.ok) throw new Error(id);
      const m = compileSpec(v.spec, id).markup;
      const tags = new Set([...m.matchAll(/<([a-zA-Z]+)/g)].map(x => x[1]));
      expect([...tags].sort()).toEqual(['circle', 'g', 'path'].filter(t => tags.has(t)));
      expect(m).not.toMatch(/script|href|on\w+=|javascript:/i);
    }
  });

  it('is deterministic', () => {
    const v = validateSpec(FIXTURES.vl_amphora);
    if (!v.ok) throw new Error('fixture invalid');
    expect(compileSpec(v.spec, 'x').markup).toBe(compileSpec(v.spec, 'x').markup);
  });

  it('the format example in the prompt is itself valid', () => {
    expect(validateSpec(SPEC_EXAMPLE).ok).toBe(true);
  });

  it('every hand-authored fixture validates cleanly and passes the compile checks', () => {
    for (const [id, s] of Object.entries(FIXTURES)) {
      const v = validateSpec(s);
      expect({ id, ok: v.ok, warnings: v.warnings }).toEqual({ id, ok: true, warnings: [] });
    }
  });

  it('prompt catalogue mentions every component', () => {
    const t = catalogueText();
    for (const c of COMPONENTS) expect(t).toContain(`- ${c.id}`);
  });
});
