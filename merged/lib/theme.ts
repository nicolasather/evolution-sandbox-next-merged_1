/* Light / dark / system, plus six accent themes (neon blue, ember, verdant,
   glacier, bronze, dusk). The preference is stored per browser; the resolved
   theme lives on <html data-theme="light|dark|neon|ember|verdant|glacier|bronze|dusk">,
   set by an inline script before first paint so there is no flash. Everything
   visual — CSS tokens, the graph canvas, the strata — reads from that attribute. */

/** The concrete, always-selectable palettes. 'light' and 'dark' are the base
 *  identities; everything after 'neon' is an accent skin layered the same way
 *  neon always was (see app/_theme-neon.css and app/_theme-variants.css). */
export const THEMES = ['light', 'dark', 'neon', 'ember', 'verdant', 'glacier', 'bronze', 'dusk'] as const;
export type Theme = (typeof THEMES)[number];
export type ThemePref = 'system' | Theme;

function isTheme(v: string): v is Theme {
  return (THEMES as readonly string[]).includes(v);
}

/** Browser-chrome colour per theme (the <meta name="theme-color">) — each is that
 *  theme's own --ink-0. */
const CHROME: Record<Theme, string> = {
  light: '#f2eee6',
  dark: '#0a0a0b',
  neon: '#03060d',
  ember: '#0d0604',
  verdant: '#06100a',
  glacier: '#060a0f',
  bronze: '#0b0806',
  dusk: '#08060f',
};

export const THEME_KEY = 'evo.theme';
export const THEME_EVENT = 'evo:theme';

export function readPref(): ThemePref {
  try {
    const v = window.localStorage.getItem(THEME_KEY);
    if (v === 'system' || (v && isTheme(v))) return v as ThemePref;
  } catch { /* storage blocked */ }
  return 'system';
}

export function resolve(pref: ThemePref): Theme {
  if (pref !== 'system') return pref;
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function applyTheme(pref: ThemePref) {
  const t = resolve(pref);
  const el = document.documentElement;
  el.dataset.theme = t;
  el.dataset.themePref = pref;
  // every accent theme is a dark scheme as far as form controls and scrollbars are concerned
  el.style.colorScheme = t === 'light' ? 'light' : 'dark';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', CHROME[t]);
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: t }));
}

export function savePref(pref: ThemePref) {
  try { window.localStorage.setItem(THEME_KEY, pref); } catch { /* storage blocked */ }
  applyTheme(pref);
}

/** Runs inline in <head> before paint. Kept tiny and dependency-free — built from
 *  THEMES so a new theme only ever needs adding to that one array. */
const VALID_JS = THEMES.map(t => `p!=='${t}'`).join('&&');
export const THEME_BOOT = `(function(){try{var p=localStorage.getItem('${THEME_KEY}');if(${VALID_JS})p='system';var t=p==='system'?(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):p;var d=document.documentElement;d.dataset.theme=t;d.dataset.themePref=p;d.style.colorScheme=t==='light'?'light':'dark';}catch(e){document.documentElement.dataset.theme='dark';}})();`;

/** Read a CSS custom property from :root (for canvas drawing). */
export function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}
