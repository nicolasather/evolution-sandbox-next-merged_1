import { FAMILIES } from '../families';
import { cacheKey, MeshCache, specHash } from '../cache';
import { LOD_SEGMENTS, meshFor, parseSpec, planFor } from '../plan';
import { silhouette, silhouetteDistance } from '../silhouette';
import { triangleCount } from '../geometry';
import { ARCHETYPES } from '../types';
import { webglAvailable } from '../renderer';

const spec = (a: string, fam = 'stone', id = `t_${a}`) => planFor({ itemId: id, archetype: a, family: fam });

describe('procedural 3D', () => {
  it('has at least 12 archetype families, each with real geometry', () => {
    expect(ARCHETYPES.length).toBeGreaterThanOrEqual(12);
    for (const a of ARCHETYPES) {
      expect(FAMILIES[a]).toBeDefined();
      const m = meshFor(spec(a));
      expect(m.positions.length).toBeGreaterThan(30);
      expect(m.indices.length % 3).toBe(0);
      expect(m.normals.length).toBe(m.positions.length);
      for (const v of m.positions) expect(Number.isFinite(v)).toBe(true);
      for (const i of m.indices) expect(i).toBeLessThan(m.positions.length / 3);
      for (let k = 0; k < m.normals.length; k += 3) expect(Math.hypot(m.normals[k], m.normals[k + 1], m.normals[k + 2])).toBeGreaterThan(0.99);
    }
  });

  it('is deterministic: same input ⇒ identical mesh bytes', () => {
    const a = meshFor(spec('vessel', 'ceramic', 'x1')), b = meshFor(spec('vessel', 'ceramic', 'x1'));
    expect(Buffer.from(a.positions.buffer).equals(Buffer.from(b.positions.buffer))).toBe(true);
    expect(Buffer.from(a.indices.buffer).equals(Buffer.from(b.indices.buffer))).toBe(true);
  });

  it('blade, stone, vessel and wheel are materially different silhouettes', () => {
    const s = Object.fromEntries(['blade', 'polished_stone', 'vessel', 'wheel'].map(a => [a, silhouette(meshFor(spec(a)))]));
    const names = Object.keys(s);
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
      expect(silhouetteDistance(s[names[i]], s[names[j]])).toBeGreaterThan(0.12);
    }
  });

  it('every pair of the 16 families differs by more than a sliver', () => {
    const sils = ARCHETYPES.map(a => [a, silhouette(meshFor(spec(a)))] as const);
    let tooClose = 0;
    for (let i = 0; i < sils.length; i++) for (let j = i + 1; j < sils.length; j++) {
      if (silhouetteDistance(sils[i][1], sils[j][1]) < 0.05) tooClose++;
    }
    expect(tooClose).toBe(0);
  });

  it('LODs reduce triangles and stay under budget', () => {
    for (const a of ARCHETYPES) {
      const t0 = triangleCount(meshFor(spec(a), 0)), t2 = triangleCount(meshFor(spec(a), 2));
      expect(t2).toBeLessThanOrEqual(t0);
      expect(t0).toBeLessThan(20_000);
    }
    expect(LOD_SEGMENTS[0]).toBeGreaterThan(LOD_SEGMENTS[2]);
  });

  it('parseSpec rejects anything that is not enumerated data', () => {
    const ok = spec('blade');
    expect(parseSpec(ok).ok).toBe(true);
    const bad = (patch: object) => parseSpec({ ...ok, ...patch });
    expect(bad({ archetype: 'dragon' }).ok).toBe(false);
    expect(bad({ material: 'unobtainium' }).ok).toBe(false);
    expect(bad({ html: '<script>alert(1)</script>' }).ok).toBe(false);
    expect(bad({ textureUrl: 'https://evil.example/x.png' }).ok).toBe(false);
    expect(bad({ stylized: false }).ok).toBe(false);
    expect(bad({ params: { ...ok.params, length: 9 } }).ok).toBe(false);
    expect(bad({ params: { ...ok.params, length: NaN } }).ok).toBe(false);
    expect(parseSpec(null).ok).toBe(false);
    expect(parseSpec([]).ok).toBe(false);
  });

  it('unknown archetype in a verified brief falls back safely, never throws', () => {
    const s = planFor({ itemId: 'weird', archetype: 'no_such', family: 'no_such_family' });
    expect(s.archetype).toBe('abstract_diagram');
    expect(s.material).toBe('stone');
    expect(meshFor(s).indices.length).toBeGreaterThan(0);
  });

  it('cache identity covers item, spec, style and format; LRU is bounded', () => {
    const s = spec('blade');
    expect(cacheKey('a', s, 'mesh')).not.toBe(cacheKey('a', s, 'svg'));
    expect(cacheKey('a', s, 'mesh')).not.toBe(cacheKey('b', s, 'mesh'));
    expect(cacheKey('a', s, 'mesh', 'exhibit-2')).not.toBe(cacheKey('a', s, 'mesh'));
    expect(specHash(s)).toBe(specHash(spec('blade')));
    const c = new MeshCache<number>(3);
    ['a', 'b', 'c', 'd'].forEach((k, i) => c.set(k, i));
    expect(c.size).toBe(3);
    expect(c.get('a')).toBeUndefined();
  });

  it('SVG fallback exists and carries no script', () => {
    const svg = silhouette(meshFor(spec('axe'))).svg;
    expect(svg).toMatch(/^<svg /);
    expect(svg).not.toMatch(/<script|onload|href=/i);
  });

  it('no WebGL in the test environment ⇒ renderer is skipped, not crashed', () => {
    expect(webglAvailable()).toBe(false);
  });
});
