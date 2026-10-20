'use client';
/** Sprite cache: every SVG from lib/quiz/td/art.ts is decoded once into an Image (data URI, no network, no CDN) and drawn on the canvas.
 *  Until an image has decoded, the renderer draws a plain geometric fallback, so the board never shows a broken image. */
import { bossSVG, coreSVG, enemySVG, propSVG, spawnSVG, towerSVG } from '@/lib/quiz/td/art';
import type { TDBossId, TDEnemyKind, TDTowerKind } from '@/lib/quiz/td/domain';

const cache = new Map<string, HTMLImageElement>();
function img(key: string, make: () => string): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;
  let i = cache.get(key);
  if (!i) { i = new Image(); i.decoding = 'async'; i.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(make())}`; cache.set(key, i); }
  return i.complete && i.naturalWidth > 0 ? i : null;
}
export const towerImg = (k: TDTowerKind, lv: 1 | 2 | 3, fire: boolean) => img(`t:${k}:${lv}:${fire}`, () => towerSVG(k, lv, fire));
export const enemyImg = (k: TDEnemyKind, pose: 'idle' | 'move' | 'hit') => img(`e:${k}:${pose}`, () => enemySVG(k, pose));
export const bossImg = (b: TDBossId, final: boolean) => img(`b:${b}:${final}`, () => bossSVG(b, final));
export const propImg = (kind: string, pal: { prop: string; propInk: string }) => img(`p:${kind}:${pal.prop}`, () => propSVG(kind, pal));
export const coreImg = () => img('core', coreSVG);
export const spawnImg = () => img('spawn', spawnSVG);
/** Warm the cache (call once on mount); resolves when everything has decoded or after 2 s. */
export function preload(keys: (() => HTMLImageElement | null)[]): Promise<void> {
  keys.forEach((k) => k());
  return new Promise((resolve) => {
    const t0 = Date.now();
    const check = () => { if ([...cache.values()].every((i) => i.complete) || Date.now() - t0 > 2000) resolve(); else setTimeout(check, 50); };
    check();
  });
}
