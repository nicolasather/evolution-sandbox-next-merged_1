import { resolveVisual, safeAssetUrl, type AssetManifest } from '../resolver';
import { assetManifest } from '../manifest';

const sha = 'a'.repeat(64);
const asset = (o: Record<string, unknown> = {}) => ({ itemId: 'flint_x', sha256: sha, mediaType: 'model/gltf-binary', url: '/assets/flint_x.glb', status: 'published', ...o });
const man = (...a: unknown[]): AssetManifest => ({ schemaVersion: 1, assets: a as never });
const base = { itemId: 'flint_x', hasCuratedArt: false, hasProcedural: true, assetUiEnabled: true };

describe('088 visual resolver', () => {
  it('shipped manifest is empty: every item renders offline with no generated asset', () => {
    expect(assetManifest.assets).toEqual([]);
    expect(resolveVisual({ ...base, manifest: assetManifest }).kind).toBe('procedural');
  });
  it('curated art beats everything; a published asset beats procedural; procedural beats glyph', () => {
    expect(resolveVisual({ ...base, hasCuratedArt: true, manifest: man(asset()) }).kind).toBe('curated');
    expect(resolveVisual({ ...base, manifest: man(asset()) }).kind).toBe('generated');
    expect(resolveVisual({ ...base, manifest: null }).kind).toBe('procedural');
    expect(resolveVisual({ ...base, hasProcedural: false, manifest: null }).kind).toBe('glyph');
  });
  it('draft/unreviewed/rejected, wrong item, wrong media type, bad hash or bad url are never shown', () => {
    for (const bad of [asset({ status: 'draft' }), asset({ status: 'approved' }), asset({ status: 'rejected' }), asset({ itemId: 'other' }), asset({ mediaType: 'image/png' }), asset({ sha256: 'xyz' }), asset({ url: 'http://x.example/a.glb' }), asset({ url: '/assets/../secret.glb' }), asset({ url: 'javascript:alert(1)' })]) {
      expect(resolveVisual({ ...base, manifest: man(bad) }).kind).toBe('procedural');
    }
  });
  it('flag off => never generated; a hash that failed to load falls back (missing file is graceful)', () => {
    expect(resolveVisual({ ...base, assetUiEnabled: false, manifest: man(asset()) }).kind).toBe('procedural');
    expect(resolveVisual({ ...base, manifest: man(asset()), failedHashes: new Set([sha]) }).kind).toBe('procedural');
  });
  it('remote URLs need an explicitly allowed https host and no credentials', () => {
    expect(safeAssetUrl('https://blob.example/x/a.glb', ['blob.example'])).toBe(true);
    expect(safeAssetUrl('https://blob.example/x/a.glb', [])).toBe(false);
    expect(safeAssetUrl('https://u:p@blob.example/a.glb', ['blob.example'])).toBe(false);
    expect(safeAssetUrl('https://blob.example/a.html', ['blob.example'])).toBe(false);
  });
});
