/* ============================================================================
   30 BACKGROUND THEMES. Each is a full colour set for the game's existing design tokens
   (--ink-*, --bone-*, --ochre …), applied on top of whichever base theme the player chose, plus its
   own engraved backdrop (data/retention/cosmetics/themes/<id>.svg) drawn behind the bench.
   Purely cosmetic: it changes colours, never what the game does.
   ========================================================================== */

/** ink0..ink4 (backgrounds, deepest → lightest), bone, bone2..bone4 (type), accent. */
type Pal = readonly [string, string, string, string, string, string, string, string, string, string];

export const THEME_PALETTES: Readonly<Record<string, Pal>> = {
  'theme-dawn-stone':       ['#14110e', '#1c1814', '#25201a', '#302a22', '#3e362b', '#f1e4cc', '#cdbb9b', '#a39378', '#7a6d57', '#e9a65c'],
  'theme-twilight-stone':   ['#0f0e16', '#16141f', '#1e1b29', '#292536', '#373147', '#e6dff0', '#b9afcb', '#8f84a6', '#675e7c', '#c79bff'],
  'theme-moonstone':        ['#0e1114', '#151a1f', '#1d242b', '#272f38', '#343e49', '#e8eef2', '#b8c4cc', '#8e9ba5', '#667480', '#a9d4e6'],
  'theme-river-slate':      ['#0d1214', '#131a1d', '#1a2326', '#232e32', '#2f3d42', '#dfeaea', '#acc0c1', '#82989a', '#5d7173', '#6cc2b4'],
  'theme-sandstorm':        ['#18120a', '#211a0f', '#2b2214', '#382d1b', '#493b25', '#f6e7c4', '#d2bd8c', '#a8946a', '#7f6e4e', '#f0b84a'],
  'theme-ash-night':        ['#0b0b0c', '#121213', '#19191b', '#222224', '#2d2d30', '#e4e2de', '#b3b0aa', '#8a8780', '#625f59', '#d8793f'],
  'theme-ember-glow':       ['#120805', '#1a0d08', '#24130b', '#311a0f', '#422314', '#f7e1cc', '#d3a98a', '#a8806a', '#7f5c4b', '#ff7a33'],
  'theme-forest-dusk':      ['#0a110c', '#101a12', '#17241a', '#203224', '#2c4232', '#e2ecd9', '#b1c4a4', '#879b7c', '#627558', '#8fd16f'],
  'theme-copper-dusk':      ['#150d0a', '#1d120d', '#281911', '#35211a', '#472d22', '#f3dccb', '#d2ab94', '#a7806b', '#7d5e4d', '#d9835a'],
  'theme-obsidian':         ['#050506', '#0b0b0d', '#111114', '#18181c', '#222227', '#e9e9ef', '#b4b4c0', '#8a8a98', '#62626f', '#9aa4ff'],
  'theme-bronze-archive':   ['#15100a', '#1d160d', '#271e12', '#342818', '#463620', '#f1e2c0', '#cdb98c', '#a3906a', '#7a6a4b', '#d6a53a'],
  'theme-terracotta':       ['#170c08', '#20110b', '#2b180f', '#392115', '#4d2e1d', '#f5dfd0', '#d4ac96', '#a9806b', '#7f5d4d', '#e0714a'],
  'theme-paper-ivory':      ['#f3ecda', '#ebe2cc', '#e2d7bd', '#d6c9ab', '#c7b894', '#2a241a', '#4a4132', '#6e6350', '#8f836b', '#a8641c'],
  'theme-library-shadow':   ['#0c0a0a', '#141010', '#1c1616', '#271e1e', '#352929', '#ecdcd2', '#c0a99b', '#957f72', '#6d5b51', '#c7714a'],
  'theme-ancient-ink':      ['#07080b', '#0e1015', '#15181f', '#1e222b', '#2a2f3a', '#e9e6dc', '#b9b5a8', '#8f8b7f', '#676459', '#d7c077'],
  'theme-mint-copper':      ['#0a1210', '#101b18', '#172520', '#20332c', '#2c463c', '#dcf0e6', '#a9cdbd', '#7fa392', '#5b7a6b', '#4fd1a5'],
  'theme-frosted-steel':    ['#0e1319', '#151c25', '#1d2733', '#273444', '#344557', '#e8f0f8', '#b7c6d6', '#8d9eb0', '#667789', '#7cc7ff'],
  'theme-midnight-iron':    ['#07090e', '#0d1118', '#141a24', '#1c2431', '#27313f', '#dde6f2', '#a9b6c7', '#7f8d9f', '#5b6877', '#6e9bff'],
  'theme-lens-light':       ['#0d1117', '#141a22', '#1c242e', '#262f3b', '#333e4d', '#f5f1e6', '#cbc7ba', '#a09d92', '#777469', '#ffd76a'],
  'theme-indigo-sky':       ['#080a1a', '#0e1226', '#151a35', '#1e2547', '#2a3360', '#e4e8fb', '#b2b9df', '#8890bd', '#626994', '#8fa2ff'],
  'theme-monochrome-flint': ['#0a0a0a', '#111111', '#181818', '#212121', '#2c2c2c', '#ededed', '#b8b8b8', '#8c8c8c', '#636363', '#d9d9d9'],
  'theme-blueprint':        ['#0a1b3a', '#0e2447', '#132e57', '#1a3b6b', '#244c85', '#e6f1ff', '#aecbf0', '#85a8d8', '#5f82b3', '#ffe27a'],
  'theme-amber-glass':      ['#150f05', '#1e1608', '#291e0b', '#37280f', '#4a3715', '#fbe9b8', '#dcc080', '#b09a5e', '#857344', '#ffb52e'],
  'theme-cobalt-signal':    ['#050b18', '#0a1426', '#101d38', '#18294d', '#223a6a', '#e3edff', '#a9bfe8', '#8099c4', '#5a7099', '#3d8bff'],
  'theme-old-photograph':   ['#1a1612', '#221d17', '#2c261e', '#383027', '#4a4033', '#e9dcc3', '#c0b196', '#978970', '#6f644f', '#b9915a'],
  'theme-night-telegraph':  ['#0a0c0b', '#101311', '#171b19', '#202522', '#2c332f', '#e1e8dd', '#b0baa9', '#869080', '#5f695a', '#d4c06a'],
  'theme-pixel-noir':       ['#08060a', '#100c14', '#18121e', '#221a2b', '#2f2540', '#efe6f7', '#bdb0cc', '#9487a3', '#6c617b', '#ff4fa3'],
  'theme-neon-circuit':     ['#040a0a', '#081212', '#0d1c1b', '#142a29', '#1d3d3b', '#dffff8', '#9fe0d2', '#6fb3a7', '#4a857b', '#18ffd0'],
  'theme-synthetic-dawn':   ['#110818', '#1a0d26', '#25133a', '#331a50', '#46246d', '#ffe6f3', '#f0b0d8', '#c27fb0', '#945a86', '#ff9a4d'],
  'theme-deep-space':       ['#030409', '#080a14', '#0e111f', '#161a2e', '#212745', '#e6e9ff', '#aab1dd', '#7e87b8', '#5a6290', '#b894ff'],
};

const hex = (h: string): [number, number, number] => { const n = parseInt(h.slice(1, 7), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgba = (h: string, a: number) => { const [r, g, b] = hex(h); return `rgba(${r},${g},${b},${a})`; };
const lum = (h: string) => { const [r, g, b] = hex(h).map(v => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };

/** WCAG contrast of body type on the base ground — checked for every theme by the retention tests. */
export function contrast(a: string, b: string) { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); }

export function themeVars(id: string): Record<string, string> | null {
  const p = THEME_PALETTES[id];
  if (!p) return null;
  const [i0, i1, i2, i3, i4, b1, b2, b3, b4, ac] = p;
  const light = lum(i0) > 0.4;
  return {
    '--ink-0': i0, '--ink-1': i1, '--ink-2': i2, '--ink-3': i3, '--ink-4': i4,
    '--bone': b1, '--bone-2': b2, '--bone-3': b3, '--bone-4': b4,
    '--line': rgba(b1, 0.12), '--line-2': rgba(b1, 0.22), '--line-3': rgba(b1, 0.38),
    '--ochre': ac, '--ochre-lo': rgba(ac, 0.14), '--ochre-mid': rgba(ac, 0.46),
    '--glass-top': rgba(i0, 0.86), '--glass-rail-a': rgba(i2, 0.6), '--glass-rail-b': rgba(i0, 0.22),
    '--hover': rgba(b1, 0.07), '--slot-bg': rgba(i2, 0.35), '--slot-full': rgba(i3, 0.62), '--glass-trail': rgba(i0, 0.6),
    '--glass-panel-a': rgba(i2, 0.7), '--glass-panel-b': rgba(i0, 0.3), '--shadow': light ? 'rgba(40,30,10,.28)' : 'rgba(0,0,0,.6)',
    '--plate-a': rgba(i4, 0.55), '--plate-b': rgba(i0, 0.6), '--glass-sticky': rgba(i0, 0.94), '--scrim': rgba(i0, 0.78),
    '--glass-nav': rgba(i0, 0.96), '--on-ochre': light ? '#fff8ea' : i0,
    '--plate-line': b2, '--plate-spark': ac,
  };
}

export const THEME_KEYS = Object.keys(themeVars('theme-dawn-stone') ?? {});

/** Apply (or, with null, clear) a theme on the page. Re-applying is harmless. */
export function applyTheme(id: string | null) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  for (const k of THEME_KEYS) root.style.removeProperty(k);
  const vars = id ? themeVars(id) : null;
  if (!vars) { root.removeAttribute('data-rtheme'); return; }
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  root.setAttribute('data-rtheme', id as string);
}
