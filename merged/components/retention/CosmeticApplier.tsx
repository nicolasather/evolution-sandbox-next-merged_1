'use client';
import { useEffect } from 'react';
import { applyTheme } from '@/lib/retention/themes';
import { loadArt } from '@/lib/retention/art/loader';
import { SHOP_BY_ID } from '@/lib/retention/catalog';
import { useHubUi, useRetention } from './hooks';

/** Turns what the player equipped into the real page: the theme's palette on <html>, the skin plate behind every piece
 *  on the bench. (The decoration and icon are drawn by RetentionLayer; the effect plays on discoveries in Workbench.)
 *  Purely visual; with nothing equipped the page is exactly the original. */
export function CosmeticApplier() {
  const r = useRetention();
  const ui = useHubUi();
  const themeId = ui.previewTheme ?? r.equipped.theme ?? null;
  const skinId = r.equipped.skin ?? null;

  useEffect(() => {
    applyTheme(themeId && SHOP_BY_ID[themeId] ? themeId : null);
    return () => applyTheme(null);
  }, [themeId]);

  useEffect(() => {
    const root = document.documentElement;
    if (!skinId || !SHOP_BY_ID[skinId]) { root.removeAttribute('data-rskin'); root.style.removeProperty('--rskin-img'); return; }
    let live = true;
    loadArt('skins').then(b => {
      const art = b[skinId]; if (!live || !art) return;
      const cs = getComputedStyle(root);
      const col = (cs.getPropertyValue('--bone-2') || cs.getPropertyValue('--bone') || '#cfc8b8').trim();
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='none' stroke='${col}' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'>${art.b}</svg>`;
      root.style.setProperty('--rskin-img', `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
      root.setAttribute('data-rskin', skinId);
    }).catch(() => {});
    return () => { live = false; };
  }, [skinId, themeId]);
  return null;
}
