/* Ticket 088 — which picture does an item get?  Order is fixed and explained:
     1. curated hand art (data/art.json)            — the game's own drawing, always wins
     2. reviewed + published generated asset         — only if the manifest lists it AND the owner turned the UI flag on
     3. Phase 1 procedural reconstruction            — deterministic, offline
     4. glyph                                        — always available
   A draft, unreviewed, failed or unknown asset can never be returned. A missing file falls back one step, never to nothing. */

export type VisualKind = 'curated' | 'generated' | 'procedural' | 'glyph';
export interface PublishedAsset { itemId: string; sha256: string; mediaType: 'model/gltf-binary' | 'image/webp' | 'image/png'; url: string; status: 'published' }
export interface AssetManifest { schemaVersion: 1; assets: PublishedAsset[] }

export interface Visual { kind: VisualKind; asset?: PublishedAsset }

const SHA = /^[a-f0-9]{64}$/;
/** relative paths under our own origin, or https URLs on a host the owner explicitly allowed */
export function safeAssetUrl(url: string, allowedHosts: readonly string[]): boolean {
  if (/^\/assets\/[A-Za-z0-9._\/-]{1,200}\.(glb|webp|png)$/.test(url) && !url.includes('..')) return true;
  try { const u = new URL(url); return u.protocol === 'https:' && allowedHosts.includes(u.host) && /\.(glb|webp|png)$/.test(u.pathname) && !u.username && !u.password; } catch { return false; }
}

export function resolveVisual(a: {
  itemId: string; hasCuratedArt: boolean; hasProcedural: boolean; manifest: AssetManifest | null;
  assetUiEnabled: boolean; allowedHosts?: readonly string[]; failedHashes?: ReadonlySet<string>;
}): Visual {
  if (a.hasCuratedArt) return { kind: 'curated' };
  if (a.assetUiEnabled && a.manifest?.schemaVersion === 1) {
    const hit = a.manifest.assets.find(x => x.itemId === a.itemId && x.status === 'published' && x.mediaType === 'model/gltf-binary'
      && SHA.test(x.sha256) && safeAssetUrl(x.url, a.allowedHosts ?? []) && !a.failedHashes?.has(x.sha256));
    if (hit) return { kind: 'generated', asset: hit };
  }
  return a.hasProcedural ? { kind: 'procedural' } : { kind: 'glyph' };
}
