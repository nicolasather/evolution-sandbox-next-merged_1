import { parseGlb } from '@/lib/visual3d/glb';
import type { Mesh } from '@/lib/visual3d/types';
import { assetManifest, assetUiEnabled, allowedAssetHosts } from './manifest';
import { resolveVisual, type AssetManifest } from './resolver';

/* Ticket 088/091 — client loader for an APPROVED generated model. It downloads only what the shipped manifest lists,
   checks the SHA-256 of the bytes against the manifest, then parses with the strict GLB reader. Any failure is
   remembered for the session and the caller falls back to the procedural reconstruction. */

const failed = new Set<string>();
const memo = new Map<string, Promise<Mesh | null>>();

export function wantedAsset(itemId: string, manifest: AssetManifest | null = assetManifest, enabled = assetUiEnabled()) {
  const v = resolveVisual({ itemId, hasCuratedArt: false, hasProcedural: true, manifest, assetUiEnabled: enabled, allowedHosts: allowedAssetHosts(), failedHashes: failed });
  return v.kind === 'generated' ? v.asset! : null;
}

const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join('');

export function loadApprovedMesh(itemId: string, o: { manifest?: AssetManifest | null; enabled?: boolean; fetchImpl?: typeof fetch; digest?: (b: ArrayBuffer) => Promise<string> } = {}): Promise<Mesh | null> {
  const a = wantedAsset(itemId, o.manifest ?? assetManifest, o.enabled ?? assetUiEnabled());
  if (!a) return Promise.resolve(null);
  const hit = memo.get(a.sha256);
  if (hit) return hit;
  const p = (async () => {
    try {
      const res = await (o.fetchImpl ?? fetch)(a.url, { credentials: 'omit', cache: 'force-cache' });
      if (!res.ok) throw new Error('http');
      const buf = await res.arrayBuffer();
      const digest = o.digest ?? (async (b: ArrayBuffer) => hex(await crypto.subtle.digest('SHA-256', b)));
      if (await digest(buf) !== a.sha256) throw new Error('hash');
      const g = parseGlb(buf);
      if (!g.ok) throw new Error(g.reason);
      return g.mesh;
    } catch { failed.add(a.sha256); return null; }
  })();
  memo.set(a.sha256, p);
  return p;
}
export const __resetApprovedMesh = () => { failed.clear(); memo.clear(); };
