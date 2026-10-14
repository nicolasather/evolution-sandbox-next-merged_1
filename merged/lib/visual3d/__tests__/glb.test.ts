/** @jest-environment node */
import { buildGlb, mockGeometry, parseGlb, GLB_LIMITS } from '../glb';

const good = () => { const g = mockGeometry(3); return buildGlb(g.positions, g.indices); };

describe('091 GLB validation', () => {
  it('accepts a well-formed embedded GLB and normalises into the ±1 box with local normals', () => {
    const r = parseGlb(good());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.stats.triangles).toBeGreaterThan(4);
    const p = r.mesh.positions; let m = 0; for (const v of p) m = Math.max(m, Math.abs(v));
    expect(m).toBeLessThanOrEqual(1.0001);
    expect(r.mesh.normals.length).toBe(p.length);
    expect(r.mesh.indices instanceof Uint16Array).toBe(true);
  });
  it.each([
    ['external buffer uri', (j: Record<string, unknown>) => { (j.buffers as { uri?: string }[])[0].uri = 'https://evil.example/x.bin'; }, 'buffer_not_embedded'],
    ['images', (j: Record<string, unknown>) => { j.images = [{ uri: 'a.png' }]; }, 'forbidden_images'],
    ['textures', (j: Record<string, unknown>) => { j.textures = []; }, 'forbidden_textures'],
    ['animations', (j: Record<string, unknown>) => { j.animations = []; }, 'forbidden_animations'],
    ['extensions', (j: Record<string, unknown>) => { j.extensionsRequired = ['KHR_draco_mesh_compression']; }, 'forbidden_extensionsRequired'],
    ['two meshes', (j: Record<string, unknown>) => { (j.meshes as unknown[]).push((j.meshes as unknown[])[0]); }, 'need_exactly_one_mesh'],
    ['points mode', (j: Record<string, unknown>) => { ((j.meshes as { primitives: { mode: number }[] }[])[0].primitives[0]).mode = 0; }, 'triangles_only'],
    ['uv attribute', (j: Record<string, unknown>) => { ((j.meshes as { primitives: { attributes: Record<string, number> }[] }[])[0].primitives[0]).attributes.TEXCOORD_0 = 0; }, 'unsupported_attribute'],
    ['sparse accessor', (j: Record<string, unknown>) => { (j.accessors as { sparse?: unknown }[])[0].sparse = {}; }, 'accessor_invalid'],
    ['count past buffer', (j: Record<string, unknown>) => { (j.accessors as { count: number }[])[0].count = 99999; }, 'accessor_out_of_range'],
    ['wrong version', (j: Record<string, unknown>) => { (j.asset as { version: string }).version = '1.0'; }, 'not_gltf2'],
    ['too many nodes', (j: Record<string, unknown>) => { j.nodes = Array.from({ length: 20 }, () => ({})); }, 'too_many_nodes'],
  ])('refuses %s', (_n, tweak, reason) => {
    const g = mockGeometry(1);
    const r = parseGlb(buildGlb(g.positions, g.indices, tweak as never));
    expect(r).toEqual({ ok: false, reason });
  });
  it('refuses bad magic, truncated, wrong declared length, oversize, empty, random bytes, NaN positions, out-of-range indices', () => {
    const f = good();
    const m = f.slice(); m[0] = 0; expect(parseGlb(m)).toEqual({ ok: false, reason: 'bad_magic' });
    expect(parseGlb(f.slice(0, f.length - 4))).toEqual({ ok: false, reason: 'length_mismatch' });
    expect(parseGlb(new Uint8Array(0)).ok).toBe(false);
    expect(parseGlb(new Uint8Array(GLB_LIMITS.maxBytes + 1)).ok).toBe(false);
    const rnd = new Uint8Array(500).map((_, i) => (i * 37 + 11) & 255); expect(parseGlb(rnd).ok).toBe(false);
    const g = mockGeometry(2); g.positions[3] = NaN;
    expect(parseGlb(buildGlb(g.positions, g.indices))).toEqual({ ok: false, reason: 'non_finite_position' });
    const h = mockGeometry(2); h.indices[0] = 500;
    expect(parseGlb(buildGlb(h.positions, h.indices))).toEqual({ ok: false, reason: 'index_out_of_range' });
  });
  it('fuzz: 300 random corruptions of a valid file never throw', () => {
    const base = good(); let s = 7; const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
    for (let i = 0; i < 300; i++) {
      const c = base.slice();
      for (let k = 0; k < 1 + Math.floor(r() * 6); k++) c[Math.floor(r() * c.length)] = Math.floor(r() * 256);
      expect(() => parseGlb(c)).not.toThrow();
    }
  });
});
