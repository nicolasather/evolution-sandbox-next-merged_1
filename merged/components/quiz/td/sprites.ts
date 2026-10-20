'use client';
/** Sprite cache: every SVG from lib/quiz/td/art.ts is decoded once into an Image (data URI, no network, no CDN) and drawn on the canvas.
 *  Until an image has decoded, the renderer draws a plain geometric fallback, so the board never shows a broken image. */
import { bossSVG, coreSVG, enemySVG, propSVG, spawnSVG, towerSVG } from '@/lib/quiz/td/art';
import { boardSVG } from '@/lib/quiz/td/boardart';
import type { TDBossId, TDEnemyKind, TDMapId, TDTowerKind } from '@/lib/quiz/td/domain';

const cache = new Map<string, HTMLImageElement>();
const listeners = new Set<() => void>();
/** Called whenever an image finishes decoding, so a board can redraw its static layer at once instead of waiting for the next timer. */
export const onSpriteLoad = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
function img(key: string, make: () => string): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;
  let i = cache.get(key);
  if (!i) { i = new Image(); i.decoding = 'async'; i.onload = () => listeners.forEach((cb) => cb()); i.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(make())}`; cache.set(key, i); }
  return i.complete && i.naturalWidth > 0 ? i : null;
}
/** The whole static battlefield (ground, lane, props, gate, fort) for a map, 1280×768. */
export const boardImg = (id: TDMapId) => img(`board:${id}`, () => boardSVG(id));
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
