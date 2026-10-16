/* Lazy access to the generated engraved-art bundles. Each bundle is its own chunk, fetched the first time something
   of that kind is drawn, so the base game never pays for artwork it is not showing. */
export type ArtKind = 'npc' | 'companion' | 'stickers' | 'icons' | 'skins' | 'decoration' | 'themes';
export type Art = { l: string; b: string };
type Bundle = Readonly<Record<string, Art>>;

const LOAD: Record<ArtKind, () => Promise<{ ART: Bundle }>> = {
  npc: () => import('./npc.generated'),
  companion: () => import('./companion.generated'),
  stickers: () => import('./stickers.generated'),
  icons: () => import('./icons.generated'),
  skins: () => import('./skins.generated'),
  decoration: () => import('./decoration.generated'),
  themes: () => import('./themes.generated'),
};
const cache = new Map<ArtKind, Bundle>();
const pending = new Map<ArtKind, Promise<Bundle>>();

export function loadArt(kind: ArtKind): Promise<Bundle> {
  const hit = cache.get(kind);
  if (hit) return Promise.resolve(hit);
  let p = pending.get(kind);
  if (!p) {
    p = LOAD[kind]().then(m => { cache.set(kind, m.ART); return m.ART; });
    pending.set(kind, p);
  }
  return p;
}
export const peekArt = (kind: ArtKind, id: string): Art | undefined => cache.get(kind)?.[id];

/** Cosmetic id prefix → bundle. */
export const kindOfCosmetic = (cat: 'icon' | 'skin' | 'decoration' | 'theme'): ArtKind =>
  cat === 'icon' ? 'icons' : cat === 'skin' ? 'skins' : cat === 'decoration' ? 'decoration' : 'themes';
