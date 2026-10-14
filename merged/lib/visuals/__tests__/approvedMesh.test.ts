/** @jest-environment node */
import { buildGlb, mockGeometry } from '@/lib/visual3d/glb';
import { loadApprovedMesh, __resetApprovedMesh, wantedAsset } from '../approvedMesh';
import type { AssetManifest } from '../resolver';

const g = mockGeometry(2);
const glb = buildGlb(g.positions, g.indices);
const ab = glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength) as ArrayBuffer;
const SHA = 'c'.repeat(64);
const man: AssetManifest = { schemaVersion: 1, assets: [{ itemId: 'flint_x', sha256: SHA, mediaType: 'model/gltf-binary', url: '/assets/flint_x.glb', status: 'published' }] };
const fetchOk = (async () => new Response(ab)) as unknown as typeof fetch;
beforeEach(() => __resetApprovedMesh());

describe('088 approved model loader', () => {
  it('flag off or no manifest entry => null without any request', async () => {
    const f = jest.fn(); 
    expect(await loadApprovedMesh('flint_x', { manifest: man, enabled: false, fetchImpl: f as never })).toBeNull();
    expect(await loadApprovedMesh('other', { manifest: man, enabled: true, fetchImpl: f as never })).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });
  it('downloads, verifies the SHA-256 against the manifest, parses and returns a mesh', async () => {
    const m = await loadApprovedMesh('flint_x', { manifest: man, enabled: true, fetchImpl: fetchOk, digest: async () => SHA });
    expect(m?.positions.length).toBeGreaterThan(0);
  });
  it('wrong hash, HTTP error, malformed bytes, network failure => null and the asset is not retried this session', async () => {
    for (const impl of [fetchOk, (async () => new Response('x', { status: 404 })) as never, (async () => new Response(new Uint8Array(40))) as never, (async () => { throw new TypeError('offline'); }) as never]) {
      __resetApprovedMesh();
      const digest = impl === fetchOk ? async () => 'd'.repeat(64) : async () => SHA;
      expect(await loadApprovedMesh('flint_x', { manifest: man, enabled: true, fetchImpl: impl, digest })).toBeNull();
      expect(wantedAsset('flint_x', man, true)).toBeNull();
    }
  });
});
