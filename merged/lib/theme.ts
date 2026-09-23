/* Light / dark / system theme.
   The preference is stored per browser; the resolved theme lives on
   <html data-theme="light|dark">, set by an inline script before first paint so
   there is no flash. Everything visual — CSS tokens, the graph canvas, the
   strata — reads from that attribute. */

export type ThemePref = 'system' | 'light' | 'dark';
export type Theme = 'light' | 'dark';

export const THEME_KEY = 'evo.theme';
export const THEME_EVENT = 'evo:theme';

export function readPref(): ThemePref {
  try {
    const v = window.localStorage.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
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
  el.style.colorScheme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'light' ? '#f2eee6' : '#0a0a0b');
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: t }));
}

export function savePref(pref: ThemePref) {
  try { window.localStorage.setItem(THEME_KEY, pref); } catch { /* storage blocked */ }
  applyTheme(pref);
}

/** Runs inline in <head> before paint. Kept tiny and dependency-free. */
export const THEME_BOOT = `(function(){try{var p=localStorage.getItem('${THEME_KEY}');if(p!=='light'&&p!=='dark')p='system';var t=p==='system'?(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):p;var d=document.documentElement;d.dataset.theme=t;d.dataset.themePref=p;d.style.colorScheme=t;}catch(e){document.documentElement.dataset.theme='dark';}})();`;

/** Read a CSS custom property from :root (for canvas drawing). */
export function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}
