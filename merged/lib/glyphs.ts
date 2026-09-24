/* ============================================================================
   GLYPH SYSTEM — typed port of the vanilla shape grammar.
   Every discovery gets a drawn mark, never an emoji: ~30 primitive drawing
   functions composed by a spec table, all in one stroke language (100x100 box,
   2px stroke, currentColor) so the whole set reads as one engraved plate
   series. Anything without a spec falls back to a category-seeded procedural
   form, so no node ever renders blank.
   ========================================================================== */

/* eslint-disable @typescript-eslint/no-explicit-any */

import ART_JSON from '@/data/art.json';
import { EXTRA_ART } from './processing/art';

/** Hand-drawn plate for every discovery, keyed by node id (data/art.json).
 *  One unique line drawing per entry, in the same 100x100 / currentColor
 *  stroke language. Parts may sit on <g data-z="N"> layers — the 3D exhibit
 *  plate (components/Plate3D.tsx) reads those as depth; the flat icon ignores
 *  them. The primitive grammar below remains only as a fallback. */
const ART: Record<string, string> = ART_JSON as Record<string, string>;

/** Options bag for a primitive. Deliberately loose — each primitive reads only
 *  the keys it needs, which is what keeps the spec table compact. */
type O = Record<string, any>;

/** A composition: an ordered list of [primitive name, options]. */
type Spec = [string, O?][];

/** The minimum a node needs to be drawable. `Discovery` satisfies this. */
export interface GlyphNode { id: string; vis: string; cat: string }

export interface GlyphOpts {
  locked?: boolean;
  /** Draw registration corner ticks, as on a museum specimen plate. */
  plate?: boolean;
  class?: string;
  sw?: number;
}


// ── deterministic PRNG so a given node always draws identically ────────
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
const R = (n: number, d = 2): number => Number(n.toFixed(d));
const pt = (cx: number, cy: number, r: number, a: number): [number, number] =>
  [R(cx + r * Math.cos(a)), R(cy + r * Math.sin(a))];
const TAU = Math.PI * 2;

// ── primitives ─────────────────────────────────────────────────────────
const P: Record<string, (o?: O) => string> = {
  // irregular knapped polygon — the stone family
  knap(o: O = {}) {
    const n = o.n || 7, r = o.r || 32, rnd = rng(o.seed || 7), cx = o.cx || 50, cy = o.cy || 50;
    const d: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU - Math.PI / 2 + (rnd() - .5) * .38;
      const rr = r * (o.jag === false ? 1 : (.72 + rnd() * .46));
      d.push(pt(cx, cy, rr, a));
    }
    return `<path d="M${d.map(p => p.join(' ')).join('L')}Z" fill="${o.fill || 'none'}"/>`;
  },
  disc(o: O = {}) { return `<circle cx="${o.cx || 50}" cy="${o.cy || 50}" r="${o.r || 20}" fill="${o.fill || 'none'}"/>`; },
  ring(o: O = {}) {
    let s = '';
    const n = o.n || 1;
    for (let i = 0; i < n; i++) s += `<circle cx="${o.cx || 50}" cy="${o.cy || 50}" r="${(o.r || 30) - i * (o.gap || 9)}" fill="none"/>`;
    return s;
  },
  arcs(o: O = {}) {
    const n = o.n || 3, cx = o.cx || 50, cy = o.cy || 50;
    let s = '';
    for (let i = 0; i < n; i++) {
      const r = (o.r0 || 12) + i * (o.dr || 10);
      const a0 = o.a0 == null ? -2.5 : o.a0, a1 = o.a1 == null ? -.65 : o.a1;
      const [x0, y0] = pt(cx, cy, r, a0), [x1, y1] = pt(cx, cy, r, a1);
      s += `<path d="M${x0} ${y0}A${r} ${r} 0 0 1 ${x1} ${y1}" fill="none"/>`;
    }
    return s;
  },
  bar(o: O = {}) {
    const { x = 30, y = 44, w = 40, h = 12, rot = 0 } = o;
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${o.fill || 'none'}"${rot ? ` transform="rotate(${rot} ${x + w / 2} ${y + h / 2})"` : ''}/>`;
  },
  grid(o: O = {}) {
    const c = o.cols || 3, r = o.rows || 3, w = o.w || 44, h = o.h || 44;
    const x0 = 50 - w / 2, y0 = 50 - h / 2;
    let s = `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="none"/>`;
    for (let i = 1; i < c; i++) s += `<line x1="${R(x0 + i * w / c)}" y1="${y0}" x2="${R(x0 + i * w / c)}" y2="${y0 + h}"/>`;
    for (let j = 1; j < r; j++) s += `<line x1="${x0}" y1="${R(y0 + j * h / r)}" x2="${x0 + w}" y2="${R(y0 + j * h / r)}"/>`;
    return s;
  },
  rays(o: O = {}) {
    const n = o.n || 8, cx = o.cx || 50, cy = o.cy || 50;
    let s = '';
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + (o.a0 || 0);
      const [x0, y0] = pt(cx, cy, o.r0 || 14, a), [x1, y1] = pt(cx, cy, o.r1 || 34, a);
      s += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}"/>`;
    }
    return s;
  },
  wave(o: O = {}) {
    const n = o.n || 1, amp = o.amp || 8, freq = o.freq || 2, w = o.w || 60, gap = o.gap || 12;
    let s = '';
    for (let k = 0; k < n; k++) {
      const y = (o.y || 50) + (k - (n - 1) / 2) * gap;
      let d = `M${50 - w / 2} ${R(y)}`;
      const steps = 26;
      for (let i = 1; i <= steps; i++) {
        const x = 50 - w / 2 + (i / steps) * w;
        d += `L${R(x)} ${R(y + Math.sin((i / steps) * freq * TAU) * amp * (o.decay ? 1 - i / steps * .6 : 1))}`;
      }
      s += `<path d="${d}" fill="none"/>`;
    }
    return s;
  },
  tri(o: O = {}) {
    const r = o.r || 30, cx = o.cx || 50, cy = o.cy || 52, rot = (o.rot || 0) * Math.PI / 180;
    const p = [0, 1, 2].map(i => pt(cx, cy, r, rot - Math.PI / 2 + i * TAU / 3));
    return `<path d="M${p.map(q => q.join(' ')).join('L')}Z" fill="${o.fill || 'none'}"/>`;
  },
  hatch(o: O = {}) {
    const n = o.n || 6, w = o.w || 40, h = o.h || 40, ang = o.ang || 0;
    const x0 = 50 - w / 2, y0 = 50 - h / 2;
    let s = '';
    for (let i = 0; i < n; i++) {
      const y = y0 + (i + .5) * h / n;
      s += `<line x1="${x0}" y1="${R(y)}" x2="${x0 + w}" y2="${R(y)}"/>`;
    }
    return ang ? `<g transform="rotate(${ang} 50 50)">${s}</g>` : s;
  },
  frame(o: O = {}) {
    const w = o.w || 52, h = o.h || 40;
    return `<rect x="${R(50 - w / 2)}" y="${R(50 - h / 2)}" width="${w}" height="${h}" fill="${o.fill || 'none'}"/>`;
  },
  dots(o: O = {}) {
    const n = o.n || 6, rnd = rng(o.seed || 3), sp = o.spread || 30;
    let s = '';
    for (let i = 0; i < n; i++) {
      const a = rnd() * TAU, r = Math.sqrt(rnd()) * sp;
      s += `<circle cx="${R(50 + r * Math.cos(a))}" cy="${R(50 + r * Math.sin(a))}" r="${o.r || 2.4}" fill="currentColor" stroke="none"/>`;
    }
    return s;
  },
  links(o: O = {}) {
    const n = o.n || 3;
    let s = '';
    for (let i = 0; i < n; i++) {
      const x = 50 + (i - (n - 1) / 2) * (o.gap || 20);
      s += `<ellipse cx="${R(x)}" cy="50" rx="${o.rx || 12}" ry="${o.ry || 8}" fill="none"/>`;
    }
    return s;
  },
  branchTree(o: O = {}) {
    const rnd = rng(o.seed || 11);
    let s = '';
    (function grow(x: number, y: number, ang: number, len: number, depth: number): void {
      if (depth <= 0 || len < 3) return;
      const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
      s += `<line x1="${R(x)}" y1="${R(y)}" x2="${R(x2)}" y2="${R(y2)}"/>`;
      const spread = o.spread || .55;
      grow(x2, y2, ang - spread * (.6 + rnd() * .8), len * .68, depth - 1);
      grow(x2, y2, ang + spread * (.6 + rnd() * .8), len * .68, depth - 1);
    })(50, 84, -Math.PI / 2, o.len || 20, o.depth || 4);
    return s;
  },
  plume(o: O = {}) {
    const rnd = rng(o.seed || 5), n = o.n || 3;
    let s = '';
    for (let i = 0; i < n; i++) {
      const x = 50 + (i - (n - 1) / 2) * 11;
      s += `<path d="M${R(x)} 80 C${R(x - 12 + rnd() * 8)} 62 ${R(x + 12 - rnd() * 8)} 44 ${R(x - 4 + rnd() * 10)} 22" fill="none"/>`;
    }
    return s;
  },
  teeth(o: O = {}) {
    const n = o.n || 10, r = o.r || 26, t = o.t || 7, cx = 50, cy = 50;
    let d = '';
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * TAU, a1 = ((i + .48) / n) * TAU, a2 = ((i + .52) / n) * TAU, a3 = ((i + 1) / n) * TAU;
      const p0 = pt(cx, cy, r, a0), p1 = pt(cx, cy, r + t, a1), p2 = pt(cx, cy, r + t, a2), p3 = pt(cx, cy, r, a3);
      d += (i ? 'L' : 'M') + p0.join(' ') + 'L' + p1.join(' ') + 'L' + p2.join(' ') + 'L' + p3.join(' ');
    }
    return `<path d="${d}Z" fill="none"/><circle cx="50" cy="50" r="${R(r * .34)}" fill="none"/>`;
  },
  coil(o: O = {}) {
    const turns = o.turns || 3, steps = 90;
    let d = '';
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, a = t * turns * TAU, r = (o.r0 || 5) + t * ((o.r1 || 30) - (o.r0 || 5));
      const [x, y] = pt(50, 50, r, a);
      d += (i ? 'L' : 'M') + x + ' ' + y;
    }
    return `<path d="${d}" fill="none"/>`;
  },
  orbit(o: O = {}) {
    const n = o.n || 2;
    let s = `<circle cx="50" cy="50" r="${o.core || 9}" fill="none"/>`;
    for (let i = 0; i < n; i++) s += `<ellipse cx="50" cy="50" rx="${o.rx || 34}" ry="${o.ry || 13}" fill="none" transform="rotate(${R(i * 180 / n + (o.rot || 0))} 50 50)"/>`;
    return s;
  },
  traces(o: O = {}) {
    const rnd = rng(o.seed || 9), n = o.n || 5;
    let s = `<rect x="26" y="26" width="48" height="48" fill="none"/>`;
    for (let i = 0; i < n; i++) {
      const y = 32 + i * (36 / n);
      const bend = 34 + Math.floor(rnd() * 26);
      s += `<path d="M12 ${R(y)}H${bend}V${R(y + (rnd() > .5 ? 9 : -9))}H74" fill="none"/>`;
      s += `<circle cx="12" cy="${R(y)}" r="1.8" fill="currentColor" stroke="none"/>`;
    }
    return s;
  },
  stairs(o: O = {}) {
    const n = o.n || 4, w = o.w || 48, h = o.h || 36;
    let d = `M${R(50 - w / 2)} ${R(50 + h / 2)}`;
    for (let i = 0; i < n; i++) d += `v${R(-h / n)}h${R(w / n)}`;
    return `<path d="${d}" fill="none"/>`;
  },
  archShape(o: O = {}) {
    const w = o.w || 40, h = o.h || 40;
    const x0 = 50 - w / 2, y1 = 50 + h / 2;
    return `<path d="M${x0} ${y1}V${R(50 - h / 6)}A${R(w / 2)} ${R(w / 2)} 0 0 1 ${x0 + w} ${R(50 - h / 6)}V${y1}" fill="none"/>`;
  },
  sheet(o: O = {}) {
    const w = o.w || 36, h = o.h || 46, sk = o.skew || 5;
    return `<path d="M${50 - w / 2} ${R(50 - h / 2 + sk)}L${R(50 + w / 2 - sk)} ${R(50 - h / 2)}L${50 + w / 2} ${R(50 + h / 2 - sk)}L${R(50 - w / 2 + sk)} ${50 + h / 2}Z" fill="none"/>`;
  },
  blade(o: O = {}) {
    const L = o.len || 42, w = o.w || 13, rot = o.rot || -32;
    return `<g transform="rotate(${rot} 50 50)"><path d="M${R(50 - L / 2)} 50L${R(50 + L / 2 - w)} ${R(50 - w / 2)}L${R(50 + L / 2)} 50L${R(50 + L / 2 - w)} ${R(50 + w / 2)}Z" fill="none"/></g>`;
  },
  vessel(o: O = {}) {
    const w = o.w || 32, h = o.h || 40, neck = o.neck || 12;
    const y0 = 50 - h / 2, y1 = 50 + h / 2;
    return `<path d="M${R(50 - neck / 2)} ${R(y0)}C${R(50 - w / 2)} ${R(y0 + h * .3)} ${R(50 - w / 2)} ${R(y1 - h * .18)} ${R(50 - w / 4)} ${R(y1)}H${R(50 + w / 4)}C${R(50 + w / 2)} ${R(y1 - h * .18)} ${R(50 + w / 2)} ${R(y0 + h * .3)} ${R(50 + neck / 2)} ${R(y0)}Z" fill="none"/><line x1="${R(50 - neck / 2 - 4)}" y1="${R(y0)}" x2="${R(50 + neck / 2 + 4)}" y2="${R(y0)}"/>`;
  },
  mountain(o: O = {}) {
    const rnd = rng(o.seed || 4), n = o.n || 3;
    let d = 'M12 74';
    for (let i = 0; i < n; i++) {
      const x0 = 12 + i * (76 / n), peak = x0 + (76 / n) / 2;
      d += `L${R(peak)} ${R(74 - (22 + rnd() * 26))}L${R(x0 + 76 / n)} 74`;
    }
    return `<path d="${d}" fill="none"/>`;
  },
  strata(o: O = {}) {
    const n = o.n || 4, rnd = rng(o.seed || 6);
    let s = '';
    for (let i = 0; i < n; i++) {
      const y = 28 + i * (44 / n);
      let d = `M16 ${R(y)}`;
      for (let x = 24; x <= 84; x += 12) d += `Q${R(x - 6)} ${R(y + (rnd() - .5) * 6)} ${R(x)} ${R(y)}`;
      s += `<path d="${d}" fill="none"/>`;
    }
    return s;
  },
  netLinks(o: O = {}) {
    const rnd = rng(o.seed || 13), n = o.n || 6;
    const ps: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rnd() * .5, r = 16 + rnd() * 18;
      ps.push(pt(50, 50, r, a));
    }
    let s = '';
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (rnd() > .48) s += `<line x1="${ps[i][0]}" y1="${ps[i][1]}" x2="${ps[j][0]}" y2="${ps[j][1]}" opacity=".55"/>`;
    ps.forEach(p => { s += `<circle cx="${p[0]}" cy="${p[1]}" r="3.2" fill="currentColor" stroke="none"/>`; });
    return s;
  },
  wireCube(o: O = {}) {
    const s = o.s || 26, d = o.d || 12;
    const x = 50 - s / 2 - d / 2, y = 50 - s / 2 + d / 2;
    return `<rect x="${R(x)}" y="${R(y)}" width="${s}" height="${s}" fill="none"/>` +
      `<rect x="${R(x + d)}" y="${R(y - d)}" width="${s}" height="${s}" fill="none" opacity=".6"/>` +
      `<line x1="${R(x)}" y1="${R(y)}" x2="${R(x + d)}" y2="${R(y - d)}"/>` +
      `<line x1="${R(x + s)}" y1="${R(y)}" x2="${R(x + s + d)}" y2="${R(y - d)}"/>` +
      `<line x1="${R(x)}" y1="${R(y + s)}" x2="${R(x + d)}" y2="${R(y + s - d)}"/>` +
      `<line x1="${R(x + s)}" y1="${R(y + s)}" x2="${R(x + s + d)}" y2="${R(y + s - d)}"/>`;
  },
  flame(o: O = {}) {
    return `<path d="M50 20C58 32 68 38 68 52a18 18 0 0 1-36 0c0-8 5-12 8-18 2 6 6 8 8 12 2-10-2-18 2-26Z" fill="none"/>` +
      (o.inner === false ? '' : `<path d="M50 44c4 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-6 6-11Z" fill="none" opacity=".65"/>`);
  },
  hearth(o: O = {}) {
    let s = `<path d="M50 34c5 8 11 12 11 20a11 11 0 0 1-22 0c0-5 4-8 6-12 2 4 4 5 5 7 1-6-2-10 0-15Z" fill="none"/>`;
    const n = o.n || 7;
    for (let i = 0; i < n; i++) {
      const a = Math.PI + (i / (n - 1)) * Math.PI;
      s += `<circle cx="${R(50 + Math.cos(a) * 30)}" cy="${R(72 + Math.sin(a) * 8)}" r="4.4" fill="none"/>`;
    }
    return s;
  },
  tower(o: O = {}) {
    const n = o.n || 3;
    let s = '';
    for (let i = 0; i < n; i++) {
      const w = 54 - i * 14, h = 12;
      s += `<rect x="${R(50 - w / 2)}" y="${R(70 - (i + 1) * h)}" width="${R(w)}" height="${h}" fill="none"/>`;
    }
    return s;
  },
  slab(o: O = {}) {
    const w = o.w || 34, h = o.h || 46;
    let s = `<path d="M${R(50 - w / 2)} ${R(50 + h / 2)}V${R(50 - h / 2 + 8)}A${R(w / 2)} ${R(w / 2)} 0 0 1 ${R(50 + w / 2)} ${R(50 - h / 2 + 8)}V${R(50 + h / 2)}Z" fill="none"/>`;
    for (let i = 0; i < (o.lines || 4); i++) s += `<line x1="${R(50 - w / 2 + 5)}" y1="${R(50 - h / 2 + 18 + i * 7)}" x2="${R(50 + w / 2 - 5)}" y2="${R(50 - h / 2 + 18 + i * 7)}" opacity=".6"/>`;
    return s;
  },
  wedges(o: O = {}) { // cuneiform-ish impressed marks
    const rnd = rng(o.seed || 21), n = o.n || 7;
    let s = '';
    for (let i = 0; i < n; i++) {
      const x = 22 + (i % 4) * 16, y = 32 + Math.floor(i / 4) * 18, rot = rnd() > .5 ? 0 : 90;
      s += `<g transform="rotate(${rot} ${x} ${y})"><path d="M${x} ${y}l9 -4v8Z" fill="currentColor" stroke="none"/><line x1="${x}" y1="${y}" x2="${x - 7}" y2="${y}"/></g>`;
    }
    return s;
  },
  axes(o: O = {}) { // little chart
    let s = `<path d="M24 24v52h52" fill="none"/>`;
    if (o.kind === 'bars') { for (let i = 0; i < 4; i++) s += `<rect x="${30 + i * 12}" y="${R(70 - (12 + i * 12))}" width="8" height="${R(12 + i * 12)}" fill="none"/>`; }
    else if (o.kind === 'dist') { s += `<path d="M26 74C38 74 38 34 50 34s12 40 24 40" fill="none"/>`; }
    else { s += `<path d="M26 70L40 58L52 62L66 34L76 30" fill="none"/>`; }
    return s;
  },
  person(o: O = {}) {
    const x = o.cx || 50, y = o.cy || 50, s = o.s || 1;
    return `<g transform="translate(${x} ${y}) scale(${s})"><circle cx="0" cy="-16" r="6" fill="none"/><path d="M0 -10v14M-9 14L0 4l9 10M-8 -4h16" fill="none"/></g>`;
  },
  ticks(o: O = {}) {
    const n = o.n || 9;
    let s = `<line x1="18" y1="50" x2="82" y2="50"/>`;
    for (let i = 0; i < n; i++) { const x = 18 + i * (64 / (n - 1)); s += `<line x1="${R(x)}" y1="50" x2="${R(x)}" y2="${i % 3 === 0 ? 40 : 45}"/>`; }
    return s;
  }
};

// ── spec table: vis key → composition ──────────────────────────────────
const S: Record<string, Spec> = {
  // materials & early tech
  'cobble': [['knap', { n: 8, r: 33, seed: 3 }], ['knap', { n: 6, r: 15, seed: 9 }]],
  'branch': [['branchTree', { depth: 4, len: 21, seed: 2 }]],
  'longbone': [['bar', { x: 28, y: 45, w: 44, h: 10, rot: -18 }], ['disc', { cx: 28, cy: 57, r: 7 }], ['disc', { cx: 72, cy: 43, r: 7 }]],
  'fibre-bundle': [['wave', { n: 3, amp: 5, freq: 2.6, w: 66, gap: 11 }]],
  'edge-fragment': [['knap', { n: 5, r: 30, seed: 17 }], ['hatch', { n: 3, w: 22, h: 16, ang: 34 }]],
  'flake': [['tri', { r: 32, rot: 14 }], ['arcs', { n: 3, r0: 9, dr: 6, a0: -2.2, a1: -1 }]],
  'handaxe': [['knap', { n: 9, r: 31, seed: 5, jag: false }], ['hatch', { n: 4, w: 26, h: 24, ang: 62 }]],
  'incision': [['frame', { w: 46, h: 34 }], ['hatch', { n: 4, w: 34, h: 22, ang: 26 }]],
  'scraper': [['arcs', { n: 2, r0: 24, dr: 8, a0: -3.1, a1: 0 }], ['bar', { x: 30, y: 56, w: 40, h: 9 }]],
  'hammerstone': [['knap', { n: 7, r: 22, seed: 8, cy: 38 }], ['rays', { n: 5, r0: 26, r1: 40, a0: 1.2 }]],
  'hafted-point': [['tri', { r: 20, cy: 34 }], ['bar', { x: 46, y: 46, w: 8, h: 34 }], ['wave', { n: 2, amp: 3, freq: 2, w: 20, y: 52, gap: 7 }]],
  'twisted-cord': [['coil', { turns: 3.4, r0: 4, r1: 30 }]],
  'lashing': [['bar', { x: 46, y: 20, w: 8, h: 60 }], ['wave', { n: 3, amp: 4, freq: 1.5, w: 34, gap: 9 }]],
  'stitch': [['wave', { n: 2, amp: 7, freq: 3, w: 60, gap: 16 }], ['dots', { n: 5, spread: 26, seed: 4 }]],
  'needle': [['bar', { x: 30, y: 48, w: 48, h: 4, rot: -20 }], ['ring', { cx: 30, cy: 56, r: 5 }]],
  'garment': [['sheet', { w: 40, h: 44, skew: 9 }], ['hatch', { n: 3, w: 26, h: 20, ang: 0 }]],
  'frame-shelter': [['tri', { r: 34, cy: 58 }], ['bar', { x: 20, y: 74, w: 60, h: 2 }]],
  'spear': [['tri', { r: 13, cy: 24 }], ['bar', { x: 47, y: 30, w: 6, h: 52 }]],
  'pursuit': [['person', { cx: 32, cy: 52, s: .9 }], ['rays', { n: 3, r0: 24, r1: 38, a0: -.3 }], ['knap', { n: 6, r: 13, seed: 12, cx: 72, cy: 56 }]],
  'hook-line': [['bar', { x: 49, y: 18, w: 2, h: 40 }], ['arcs', { n: 1, r0: 14, a0: -.4, a1: 2.6, cy: 62 }]],

  // fire & culture
  'flame': [['flame', {}]],
  'hearth': [['hearth', { n: 7 }]],
  'roast': [['flame', { inner: false }], ['bar', { x: 18, y: 30, w: 64, h: 3 }]],
  'smoke-plume': [['plume', { n: 3, seed: 7 }], ['bar', { x: 34, y: 80, w: 32, h: 3 }]],
  'tempering': [['knap', { n: 6, r: 24, seed: 14 }], ['arcs', { n: 3, r0: 30, dr: 6, a0: -2.6, a1: -.5 }]],
  'grinding': [['disc', { r: 26 }], ['disc', { r: 9 }], ['arcs', { n: 2, r0: 16, dr: 6, a0: .3, a1: 2.4 }]],
  'butchery': [['knap', { n: 8, r: 28, seed: 19 }], ['hatch', { n: 3, w: 30, h: 18, ang: 18 }]],
  'pestle': [['bar', { x: 44, y: 16, w: 12, h: 36 }], ['arcs', { n: 2, r0: 22, dr: 7, a0: 0, a1: 3.14, cy: 58 }]],
  'storage-pit': [['arcs', { n: 3, r0: 14, dr: 9, a0: 0, a1: 3.14, cy: 44 }], ['bar', { x: 14, y: 42, w: 72, h: 2 }]],
  'circle': [['ring', { r: 30 }], ['dots', { n: 7, spread: 24, seed: 2 }]],
  'signal': [['arcs', { n: 3, r0: 12, dr: 10, a0: -1.9, a1: -.2, cx: 34 }], ['disc', { cx: 34, cy: 50, r: 4, fill: 'currentColor' }]],
  'ochre-mark': [['frame', { w: 44, h: 44 }], ['hatch', { n: 4, w: 30, h: 30, ang: 45 }], ['hatch', { n: 4, w: 30, h: 30, ang: -45 }]],
  'utterance': [['arcs', { n: 4, r0: 10, dr: 8, a0: -1.6, a1: 1.6, cx: 30 }]],
  'demonstration': [['person', { cx: 34, cy: 52, s: .85 }], ['person', { cx: 68, cy: 54, s: .62 }]],
  'chain': [['links', { n: 4, gap: 19, rx: 11, ry: 8 }]],
  'lattice': [['grid', { cols: 4, rows: 4, w: 48, h: 48 }]],
  'sequence': [['ticks', { n: 7 }], ['dots', { n: 3, spread: 22, seed: 5, r: 2 }]],
  'pigment': [['knap', { n: 7, r: 18, seed: 23, cx: 34, cy: 58 }], ['arcs', { n: 3, r0: 14, dr: 8, a0: -2.4, a1: -.9, cx: 62, cy: 46 }]],
  'arrangement': [['ring', { r: 28 }], ['rays', { n: 6, r0: 8, r1: 24 }]],
  'cave-panel': [['frame', { w: 56, h: 40 }], ['mountain', { n: 2, seed: 3 }], ['dots', { n: 4, spread: 18, seed: 8 }]],

  // settlement
  'terrain': [['mountain', { n: 3, seed: 6 }], ['wave', { n: 1, amp: 3, freq: 2, w: 66, y: 80 }]],
  'cycle-path': [['coil', { turns: 2.2, r0: 8, r1: 30 }], ['dots', { n: 4, spread: 26, seed: 11 }]],
  'interlock': [['links', { n: 2, gap: 22, rx: 15, ry: 15 }]],
  'dispersal': [['disc', { r: 6, fill: 'currentColor' }], ['rays', { n: 7, r0: 12, r1: 36 }]],
  'layered': [['strata', { n: 4, seed: 2 }]],
  'crossing': [['wave', { n: 2, amp: 5, freq: 2.4, w: 70, gap: 16 }], ['bar', { x: 44, y: 30, w: 12, h: 40 }]],
  'raft': [['bar', { x: 20, y: 46, w: 60, h: 8 }], ['hatch', { n: 5, w: 56, h: 6, ang: 90 }], ['wave', { n: 1, amp: 4, freq: 2.6, w: 70, y: 68 }]],
  'dugout': [['arcs', { n: 2, r0: 30, dr: 7, a0: .25, a1: 2.9, cy: 40 }], ['wave', { n: 1, amp: 4, freq: 2.6, w: 74, y: 72 }]],
  'star-fix': [['dots', { n: 5, spread: 30, seed: 21, r: 2.6 }], ['rays', { n: 4, r0: 4, r1: 16 }], ['arcs', { n: 1, r0: 34, a0: 0, a1: 3.14 }]],
  'net': [['grid', { cols: 4, rows: 4, w: 46, h: 46 }], ['ring', { r: 30 }]],
  'dwelling': [['tri', { r: 26, cy: 42 }], ['frame', { w: 40, h: 22 }], ['bar', { x: 46, y: 58, w: 8, h: 14 }]],
  'cluster': [['dots', { n: 9, spread: 28, seed: 31, r: 3.4 }], ['ring', { r: 34 }]],
  'accumulation': [['axes', { kind: 'bars' }]],
  'partition': [['frame', { w: 52, h: 44 }], ['bar', { x: 49, y: 28, w: 2, h: 44 }], ['bar', { x: 24, y: 49, w: 26, h: 2 }]],
  'allocation': [['disc', { r: 28 }], ['rays', { n: 5, r0: 0, r1: 28 }]],

  // agriculture
  'herbarium': [['branchTree', { depth: 3, len: 17, seed: 9, spread: .7 }], ['frame', { w: 54, h: 62 }]],
  'seed-sort': [['dots', { n: 5, spread: 14, seed: 4, r: 3.2 }], ['ring', { r: 26 }], ['dots', { n: 4, spread: 34, seed: 12, r: 2 }]],
  'tilled-row': [['wave', { n: 4, amp: 3, freq: 3, w: 62, gap: 11 }]],
  'selected-form': [['knap', { n: 9, r: 26, seed: 6, jag: false }], ['knap', { n: 9, r: 14, seed: 6, jag: false }]],
  'herd': [['dots', { n: 7, spread: 26, seed: 15, r: 4 }], ['wave', { n: 1, amp: 3, freq: 2, w: 66, y: 76 }]],
  'sickle': [['arcs', { n: 1, r0: 28, a0: -3, a1: -.4 }], ['bar', { x: 50, y: 56, w: 26, h: 6, rot: 28 }]],
  'channel': [['bar', { x: 14, y: 42, w: 72, h: 16 }], ['wave', { n: 1, amp: 3, freq: 3.4, w: 68, y: 50 }]],
  'granary': [['arcs', { n: 1, r0: 22, a0: 3.14, a1: 0, cy: 44 }], ['frame', { w: 44, h: 26 }], ['rays', { n: 2, r0: 18, r1: 30, a0: 1.1 }]],
  'field-system': [['grid', { cols: 3, rows: 3, w: 54, h: 42 }], ['hatch', { n: 3, w: 16, h: 12, ang: 0 }]],
  'surplus-heap': [['tri', { r: 30, cy: 58 }], ['dots', { n: 8, spread: 20, seed: 7, r: 2.4 }]],
  'parcel': [['grid', { cols: 2, rows: 2, w: 50, h: 50 }], ['ticks', { n: 5 }]],
  'village-plan': [['dots', { n: 6, spread: 26, seed: 22, r: 4 }], ['ring', { r: 33 }]],
  'commons': [['ring', { r: 30 }], ['ring', { r: 12 }], ['rays', { n: 6, r0: 12, r1: 30 }]],
  'workshop': [['frame', { w: 50, h: 38 }], ['tri', { r: 18, cy: 30 }], ['dots', { n: 3, spread: 14, seed: 5, r: 2.4 }]],
  'exchange': [['arcs', { n: 1, r0: 24, a0: -2.8, a1: -.4 }], ['arcs', { n: 1, r0: 24, a0: .35, a1: 2.75 }], ['tri', { r: 7, cx: 74, cy: 42, rot: 90 }], ['tri', { r: 7, cx: 26, cy: 60, rot: -90 }]],

  // civilisation
  'vessel': [['vessel', {}]],
  'brick-course': [['bar', { x: 18, y: 36, w: 30, h: 12 }], ['bar', { x: 52, y: 36, w: 30, h: 12 }], ['bar', { x: 34, y: 52, w: 30, h: 12 }], ['bar', { x: 18, y: 68, w: 30, h: 12 }], ['bar', { x: 52, y: 68, w: 30, h: 12 }]],
  'scaffold': [['frame', { w: 46, h: 52 }], ['hatch', { n: 3, w: 46, h: 40, ang: 90 }], ['bar', { x: 20, y: 76, w: 60, h: 2 }]],
  'elevation': [['tower', { n: 3 }], ['ticks', { n: 5 }]],
  'causeway': [['bar', { x: 12, y: 44, w: 76, h: 14 }], ['hatch', { n: 6, w: 70, h: 10, ang: 90 }]],
  'grid-plan': [['grid', { cols: 4, rows: 4, w: 56, h: 56 }], ['bar', { x: 20, y: 49, w: 60, h: 2 }]],
  'townscape': [['tower', { n: 2 }], ['frame', { w: 22, h: 18 }]],
  'city-block': [['bar', { x: 20, y: 40, w: 16, h: 36 }], ['bar', { x: 42, y: 28, w: 16, h: 48 }], ['bar', { x: 64, y: 46, w: 16, h: 30 }]],
  'seal': [['disc', { r: 24 }], ['wedges', { n: 4, seed: 3 }]],
  'stele': [['slab', { lines: 5 }]],
  'tablet-stack': [['bar', { x: 24, y: 30, w: 52, h: 12 }], ['bar', { x: 24, y: 46, w: 52, h: 12 }], ['bar', { x: 24, y: 62, w: 52, h: 12 }]],
  'tally': [['hatch', { n: 5, w: 44, h: 40, ang: 90 }], ['bar', { x: 26, y: 48, w: 48, h: 2, rot: -22 }]],
  'cuneiform': [['frame', { w: 56, h: 44 }], ['wedges', { n: 7, seed: 11 }]],
  'token-set': [['dots', { n: 5, spread: 22, seed: 17, r: 4 }], ['tri', { r: 8, cx: 70, cy: 66 }], ['ring', { r: 32 }]],
  'numerals': [['ticks', { n: 10 }], ['dots', { n: 3, spread: 20, seed: 2, r: 2.4 }]],
  'ledger': [['frame', { w: 48, h: 56 }], ['hatch', { n: 5, w: 40, h: 44 }], ['bar', { x: 60, y: 26, w: 2, h: 50 }]],
  'calendar-disc': [['ring', { r: 30, n: 2, gap: 8 }], ['rays', { n: 12, r0: 22, r1: 30 }], ['bar', { x: 50, y: 34, w: 2, h: 18 }]],
  'ephemeris': [['arcs', { n: 3, r0: 14, dr: 10, a0: -2.9, a1: -.25 }], ['dots', { n: 4, spread: 30, seed: 5, r: 2.4 }]],
  'flow': [['wave', { n: 3, amp: 6, freq: 1.6, w: 66, gap: 14 }], ['tri', { r: 6, cx: 78, cy: 50, rot: 90 }]],
  'ziggurat': [['stairs', { n: 4, w: 56, h: 40 }], ['bar', { x: 16, y: 72, w: 68, h: 2 }]],

  // metals & machines
  'copper-ingot': [['sheet', { w: 44, h: 26, skew: 8 }], ['hatch', { n: 2, w: 30, h: 12 }]],
  'furnace': [['archShape', { w: 44, h: 46 }], ['flame', { inner: false }]],
  'bronze-alloy': [['disc', { r: 24 }], ['disc', { cx: 64, cy: 42, r: 14 }], ['hatch', { n: 3, w: 22, h: 16, ang: 40 }]],
  'bronze-blade': [['blade', { len: 52, w: 15, rot: -34 }]],
  'iron-bloom': [['knap', { n: 10, r: 28, seed: 27 }], ['dots', { n: 5, spread: 16, seed: 9, r: 2.2 }]],
  'anvil': [['bar', { x: 22, y: 46, w: 56, h: 12 }], ['bar', { x: 40, y: 58, w: 20, h: 18 }], ['rays', { n: 3, r0: 26, r1: 38, a0: -2 }]],
  'steel-bar': [['bar', { x: 18, y: 44, w: 64, h: 12 }], ['hatch', { n: 3, w: 56, h: 8, ang: 90 }]],
  'phase-diagram': [['axes', { kind: 'line' }], ['dots', { n: 4, spread: 18, seed: 13, r: 2.2 }]],
  'hammer-blow': [['bar', { x: 30, y: 26, w: 40, h: 12, rot: -30 }], ['rays', { n: 5, r0: 22, r1: 36, a0: .5 }]],
  'mould': [['frame', { w: 50, h: 44 }], ['tri', { r: 16, cy: 52 }], ['bar', { x: 46, y: 22, w: 8, h: 12 }]],
  'wheel': [['ring', { r: 30, n: 2, gap: 6 }], ['rays', { n: 8, r0: 6, r1: 24 }], ['disc', { r: 5, fill: 'currentColor' }]],
  'axle': [['ring', { r: 15, cx: 26 }], ['ring', { r: 15, cx: 74 }], ['bar', { x: 26, y: 47, w: 48, h: 6 }]],
  'cart': [['frame', { w: 46, h: 22 }], ['ring', { r: 10, cx: 34, cy: 70 }], ['ring', { r: 10, cx: 66, cy: 70 }]],
  'force-diagram': [['bar', { x: 20, y: 60, w: 60, h: 2, rot: -14 }], ['tri', { r: 10, cy: 70 }], ['rays', { n: 2, r0: 18, r1: 34, a0: -1.57 }]],
  'pulley': [['ring', { r: 16, cy: 34 }], ['bar', { x: 34, y: 34, w: 2, h: 44 }], ['bar', { x: 64, y: 34, w: 2, h: 30 }], ['bar', { x: 56, y: 64, w: 18, h: 12 }]],
  'lever': [['bar', { x: 16, y: 46, w: 68, h: 4, rot: -16 }], ['tri', { r: 12, cy: 66 }]],
  'gear': [['teeth', { n: 10, r: 24, t: 8 }]],
  'linkage': [['ring', { r: 8, cx: 28, cy: 62 }], ['ring', { r: 8, cx: 72, cy: 38 }], ['bar', { x: 28, y: 48, w: 44, h: 3, rot: -20 }], ['teeth', { n: 8, r: 12, t: 4 }]],
  'drawing': [['frame', { w: 56, h: 44 }], ['ticks', { n: 6 }], ['tri', { r: 12, cy: 44 }]],
  'aqueduct': [['archShape', { w: 26, h: 30 }], ['bar', { x: 12, y: 30, w: 76, h: 6 }], ['bar', { x: 20, y: 62, w: 4, h: 22 }], ['bar', { x: 76, y: 62, w: 4, h: 22 }]],

  // knowledge & science
  'rule': [['ticks', { n: 11 }]],
  'construction-lines': [['ring', { r: 26 }], ['tri', { r: 26 }], ['rays', { n: 3, r0: 0, r1: 30 }]],
  'proof': [['tri', { r: 28 }], ['ticks', { n: 4 }], ['hatch', { n: 2, w: 18, h: 12, ang: 30 }]],
  'scroll': [['ring', { r: 8, cx: 24 }], ['ring', { r: 8, cx: 76 }], ['bar', { x: 24, y: 34, w: 52, h: 32 }], ['hatch', { n: 4, w: 40, h: 24 }]],
  'plan-view': [['frame', { w: 54, h: 44 }], ['wave', { n: 1, amp: 6, freq: 1.4, w: 44 }], ['dots', { n: 3, spread: 18, seed: 6, r: 2.4 }]],
  'projection': [['ring', { r: 28 }], ['arcs', { n: 3, r0: 10, dr: 9, a0: -1.57, a1: 1.57 }], ['bar', { x: 22, y: 49, w: 56, h: 2 }]],
  'logbook': [['frame', { w: 44, h: 54 }], ['hatch', { n: 6, w: 34, h: 42 }]],
  'ray-diagram': [['ring', { r: 20, cx: 62 }], ['rays', { n: 3, r0: 10, r1: 40, a0: 3.0, cx: 26 }], ['bar', { x: 60, y: 24, w: 2, h: 52 }]],
  'lens-stack': [['arcs', { n: 2, r0: 30, dr: 8, a0: -1.2, a1: 1.2, cx: 34 }], ['arcs', { n: 2, r0: 30, dr: 8, a0: 1.94, a1: 4.34, cx: 66 }]],
  'refractor': [['bar', { x: 20, y: 44, w: 60, h: 14, rot: -20 }], ['ring', { r: 9, cx: 78, cy: 33 }], ['tri', { r: 12, cy: 76 }]],
  'apparatus': [['vessel', { w: 26, h: 30 }], ['bar', { x: 30, y: 74, w: 40, h: 4 }], ['coil', { turns: 1.6, r0: 4, r1: 14 }]],
  'loop-diagram': [['coil', { turns: 1.6, r0: 10, r1: 28 }], ['tri', { r: 7, cx: 74, cy: 44, rot: 120 }]],
  'vector-field': [['rays', { n: 9, r0: 16, r1: 32 }], ['dots', { n: 5, spread: 12, seed: 3, r: 2 }]],
  'retort': [['vessel', { w: 34, h: 38, neck: 10 }], ['arcs', { n: 1, r0: 20, a0: -1.4, a1: .4, cx: 68, cy: 34 }]],
  'pharmacopoeia': [['vessel', { w: 26, h: 32, neck: 12 }], ['branchTree', { depth: 3, len: 12, seed: 4 }]],
  'figure-plate': [['person', { cx: 50, cy: 54, s: 1.4 }], ['frame', { w: 54, h: 62 }]],
  'branching-tree': [['branchTree', { depth: 5, len: 19, seed: 1 }]],
  'distribution': [['axes', { kind: 'dist' }]],
  'table': [['grid', { cols: 3, rows: 4, w: 52, h: 48 }]],
  'correspondence': [['sheet', { w: 34, h: 26, skew: 6 }], ['netLinks', { n: 5, seed: 8 }]],

  // industry
  'water-wheel': [['ring', { r: 28, n: 2, gap: 7 }], ['rays', { n: 10, r0: 21, r1: 28 }], ['wave', { n: 1, amp: 4, freq: 3, w: 76, y: 82 }]],
  'windmill': [['bar', { x: 47, y: 46, w: 6, h: 36 }], ['rays', { n: 4, r0: 6, r1: 30, a0: .4, cy: 44 }], ['tri', { r: 10, cy: 40 }]],
  'drive-shaft': [['bar', { x: 10, y: 46, w: 80, h: 6 }], ['ring', { r: 11, cx: 30, cy: 49 }], ['ring', { r: 11, cx: 70, cy: 49 }]],
  'coal-seam': [['strata', { n: 3, seed: 8 }], ['knap', { n: 8, r: 15, seed: 2, cy: 68 }]],
  'boiler': [['ring', { r: 24 }], ['bar', { x: 26, y: 70, w: 48, h: 10 }], ['plume', { n: 2, seed: 3 }]],
  'beam-engine': [['bar', { x: 18, y: 26, w: 64, h: 6 }], ['tri', { r: 14, cy: 44 }], ['bar', { x: 26, y: 32, w: 4, h: 30 }], ['ring', { r: 12, cx: 74, cy: 60 }]],
  'mill-block': [['frame', { w: 48, h: 44 }], ['grid', { cols: 3, rows: 3, w: 40, h: 36 }], ['bar', { x: 66, y: 20, w: 8, h: 30 }]],
  'chimney-line': [['bar', { x: 24, y: 34, w: 8, h: 44 }], ['bar', { x: 46, y: 26, w: 8, h: 52 }], ['bar', { x: 68, y: 40, w: 8, h: 38 }], ['plume', { n: 3, seed: 6 }]],
  'lathe': [['bar', { x: 16, y: 52, w: 68, h: 8 }], ['ring', { r: 12, cx: 32, cy: 44 }], ['tri', { r: 9, cx: 66, cy: 42, rot: 180 }]],
  'tolerance': [['ring', { r: 22 }], ['ring', { r: 26 }], ['ticks', { n: 5 }]],
  'assembly-line': [['bar', { x: 10, y: 56, w: 80, h: 6 }], ['frame', { w: 14, h: 12 }], ['bar', { x: 24, y: 40, w: 12, h: 12 }], ['bar', { x: 64, y: 40, w: 12, h: 12 }], ['tri', { r: 6, cx: 84, cy: 46, rot: 90 }]],
  'track': [['bar', { x: 34, y: 14, w: 5, h: 72 }], ['bar', { x: 61, y: 14, w: 5, h: 72 }], ['hatch', { n: 5, w: 46, h: 60, ang: 0 }]],
  'locomotive': [['frame', { w: 46, h: 26 }], ['ring', { r: 9, cx: 34, cy: 70 }], ['ring', { r: 9, cx: 62, cy: 70 }], ['plume', { n: 2, seed: 4 }]],

  // electric
  'circuit': [['traces', { n: 4, seed: 5 }]],
  'dynamo': [['ring', { r: 26 }], ['coil', { turns: 2.4, r0: 5, r1: 18 }], ['bar', { x: 76, y: 46, w: 12, h: 8 }]],
  'rotor': [['ring', { r: 28 }], ['rays', { n: 6, r0: 10, r1: 26 }], ['disc', { r: 7 }]],
  'filament': [['arcs', { n: 1, r0: 22, a0: 3.4, a1: 6.0 }], ['coil', { turns: 2.6, r0: 3, r1: 11 }], ['bar', { x: 42, y: 70, w: 16, h: 14 }]],
  'key': [['bar', { x: 24, y: 52, w: 44, h: 6, rot: -10 }], ['disc', { cx: 68, cy: 48, r: 7 }], ['bar', { x: 20, y: 64, w: 56, h: 5 }]],
  'handset': [['arcs', { n: 1, r0: 26, a0: 3.34, a1: 6.08 }], ['disc', { cx: 26, cy: 44, r: 8 }], ['disc', { cx: 74, cy: 44, r: 8 }]],
  'cityscape': [['bar', { x: 16, y: 44, w: 14, h: 34 }], ['bar', { x: 34, y: 30, w: 14, h: 48 }], ['bar', { x: 52, y: 38, w: 14, h: 40 }], ['bar', { x: 70, y: 50, w: 14, h: 28 }]],
  'plate': [['frame', { w: 50, h: 40 }], ['ring', { r: 12 }], ['hatch', { n: 2, w: 40, h: 30, ang: 20 }]],
  'piston': [['frame', { w: 26, h: 46 }], ['bar', { x: 46, y: 20, w: 8, h: 26 }], ['ring', { r: 12, cy: 74 }]],
  'chassis': [['bar', { x: 16, y: 46, w: 68, h: 14 }], ['ring', { r: 9, cx: 32, cy: 68 }], ['ring', { r: 9, cx: 68, cy: 68 }], ['sheet', { w: 30, h: 16, skew: 6 }]],
  'aerofoil': [['arcs', { n: 2, r0: 34, dr: 9, a0: 3.3, a1: 6.1 }], ['bar', { x: 24, y: 56, w: 52, h: 3 }]],
  'film-strip': [['frame', { w: 62, h: 34 }], ['hatch', { n: 4, w: 62, h: 26, ang: 90 }], ['dots', { n: 6, spread: 28, seed: 2, r: 1.8 }]],
  'valve': [['arcs', { n: 1, r0: 22, a0: 3.34, a1: 6.08 }], ['bar', { x: 38, y: 50, w: 24, h: 26 }], ['coil', { turns: 1.4, r0: 3, r1: 10 }]],
  'schematic': [['traces', { n: 3, seed: 12 }], ['ticks', { n: 4 }]],
  'antenna': [['bar', { x: 48, y: 40, w: 4, h: 42 }], ['arcs', { n: 3, r0: 12, dr: 9, a0: -2.3, a1: -.85, cy: 40 }], ['tri', { r: 8, cy: 34 }]],

  // computing
  'wafer': [['disc', { r: 30 }], ['grid', { cols: 4, rows: 4, w: 40, h: 40 }]],
  'transistor': [['disc', { r: 26 }], ['bar', { x: 34, y: 36, w: 4, h: 28 }], ['bar', { x: 38, y: 42, w: 18, h: 3, rot: -22 }], ['bar', { x: 38, y: 56, w: 18, h: 3, rot: 22 }]],
  'die': [['frame', { w: 42, h: 42 }], ['grid', { cols: 3, rows: 3, w: 30, h: 30 }], ['hatch', { n: 4, w: 58, h: 42, ang: 90 }]],
  'logic-unit': [['frame', { w: 48, h: 40 }], ['traces', { n: 3, seed: 3 }]],
  'punched-card': [['sheet', { w: 54, h: 36, skew: 7 }], ['dots', { n: 8, spread: 20, seed: 14, r: 2 }]],
  'core-plane': [['grid', { cols: 4, rows: 4, w: 46, h: 46 }], ['dots', { n: 9, spread: 20, seed: 4, r: 2.2 }]],
  'platter': [['ring', { r: 30, n: 3, gap: 8 }], ['bar', { x: 50, y: 30, w: 26, h: 3, rot: -28 }]],
  'stack-layers': [['sheet', { w: 46, h: 14, skew: 8 }], ['bar', { x: 28, y: 46, w: 44, h: 12 }], ['bar', { x: 28, y: 62, w: 44, h: 12 }]],
  'chip': [['frame', { w: 40, h: 40 }], ['grid', { cols: 2, rows: 2, w: 24, h: 24 }], ['hatch', { n: 4, w: 60, h: 34, ang: 90 }], ['hatch', { n: 4, w: 34, h: 60, ang: 0 }]],
  'desktop-unit': [['frame', { w: 52, h: 36 }], ['bar', { x: 44, y: 60, w: 12, h: 8 }], ['bar', { x: 30, y: 68, w: 40, h: 4 }]],
  'raster': [['grid', { cols: 6, rows: 6, w: 48, h: 48 }], ['dots', { n: 5, spread: 18, seed: 7, r: 2.6 }]],
  'bitstream': [['ticks', { n: 12 }], ['hatch', { n: 3, w: 60, h: 22, ang: 0 }]],
  'topology': [['netLinks', { n: 6, seed: 5 }]],
  'internetwork': [['netLinks', { n: 7, seed: 9 }], ['ring', { r: 36 }]],
  'hyperlink': [['links', { n: 2, gap: 24, rx: 15, ry: 10 }], ['bar', { x: 40, y: 48, w: 20, h: 3 }]],
  'viewport': [['frame', { w: 56, h: 42 }], ['bar', { x: 22, y: 30, w: 56, h: 8 }], ['dots', { n: 3, spread: 6, seed: 2, r: 1.8 }]],
  'message-thread': [['frame', { w: 40, h: 20 }], ['bar', { x: 40, y: 56, w: 40, h: 18 }], ['dots', { n: 3, spread: 8, seed: 3, r: 1.6 }]],
  'handheld': [['frame', { w: 30, h: 54 }], ['bar', { x: 42, y: 32, w: 16, h: 2 }], ['ring', { r: 3, cy: 68 }]],
  'datacentre': [['bar', { x: 22, y: 26, w: 56, h: 12 }], ['bar', { x: 22, y: 44, w: 56, h: 12 }], ['bar', { x: 22, y: 62, w: 56, h: 12 }], ['dots', { n: 6, spread: 26, seed: 11, r: 1.8 }]],
  'network-weights': [['netLinks', { n: 8, seed: 21 }], ['dots', { n: 4, spread: 34, seed: 6, r: 2 }]],

  // games & simulation
  'rule-set': [['frame', { w: 44, h: 52 }], ['hatch', { n: 5, w: 34, h: 40 }], ['tri', { r: 8, cx: 72, cy: 68 }]],
  'crt-screen': [['frame', { w: 52, h: 40 }], ['dots', { n: 4, spread: 16, seed: 8, r: 3 }], ['bar', { x: 36, y: 72, w: 28, h: 5 }]],
  'console': [['frame', { w: 54, h: 26 }], ['ring', { r: 5, cx: 66, cy: 50 }], ['bar', { x: 30, y: 48, w: 12, h: 4 }], ['bar', { x: 34, y: 44, w: 4, h: 12 }]],
  'wireframe': [['wireCube', {}]],
  'frame-budget': [['ticks', { n: 8 }], ['axes', { kind: 'bars' }]],
  'collision': [['disc', { cx: 36, cy: 54, r: 15 }], ['knap', { n: 6, r: 16, seed: 3, cx: 66, cy: 44 }], ['rays', { n: 4, r0: 20, r1: 30, a0: .6, cx: 50, cy: 50 }]],
  'keyframe': [['tri', { r: 9, cx: 24, cy: 50, rot: 90 }], ['tri', { r: 9, cx: 50, cy: 50, rot: 90 }], ['tri', { r: 9, cx: 76, cy: 50, rot: 90 }], ['bar', { x: 16, y: 66, w: 68, h: 2 }]],
  'marker-rig': [['person', { cx: 50, cy: 52, s: 1.3 }], ['dots', { n: 6, spread: 26, seed: 19, r: 2.6 }]],
  'engine-core': [['teeth', { n: 8, r: 20, t: 6 }], ['ring', { r: 32 }], ['rays', { n: 4, r0: 32, r1: 40 }]],
  'noise-field': [['dots', { n: 26, spread: 34, seed: 42, r: 1.9 }]],
  'city-model': [['wireCube', { s: 18, d: 8 }], ['bar', { x: 22, y: 62, w: 12, h: 16 }], ['bar', { x: 68, y: 56, w: 12, h: 22 }]],
  'open-map': [['frame', { w: 58, h: 46 }], ['wave', { n: 2, amp: 5, freq: 1.4, w: 48, gap: 16 }], ['dots', { n: 4, spread: 20, seed: 16, r: 2.4 }]],
  'light-path': [['disc', { cx: 30, cy: 34, r: 7, fill: 'currentColor' }], ['rays', { n: 5, r0: 8, r1: 40, a0: .5, cx: 30, cy: 34 }], ['knap', { n: 6, r: 14, seed: 4, cx: 68, cy: 64 }]],
  'behaviour-tree': [['branchTree', { depth: 3, len: 18, seed: 7, spread: .9 }], ['dots', { n: 4, spread: 28, seed: 2, r: 2.6 }]],
  'camera-rig': [['frame', { w: 40, h: 26 }], ['ring', { r: 9, cx: 76, cy: 50 }], ['tri', { r: 10, cy: 76 }]],
  'production-chart': [['axes', { kind: 'bars' }], ['ticks', { n: 5 }]],
  'world-state': [['ring', { r: 32 }], ['netLinks', { n: 6, seed: 33 }], ['arcs', { n: 1, r0: 38, a0: -1, a1: 1.6 }]],
  'pipeline': [['bar', { x: 12, y: 44, w: 24, h: 12 }], ['bar', { x: 40, y: 44, w: 20, h: 12 }], ['bar', { x: 64, y: 44, w: 24, h: 12 }], ['tri', { r: 5, cx: 38, cy: 50, rot: 90 }], ['tri', { r: 5, cx: 62, cy: 50, rot: 90 }]],
  'open-city': [['bar', { x: 18, y: 40, w: 12, h: 38 }], ['bar', { x: 34, y: 28, w: 12, h: 50 }], ['bar', { x: 50, y: 44, w: 12, h: 34 }], ['bar', { x: 66, y: 34, w: 12, h: 44 }], ['wave', { n: 1, amp: 3, freq: 2, w: 76, y: 84 }]],
  'horizon': [['arcs', { n: 3, r0: 26, dr: 9, a0: 3.34, a1: 6.08, cy: 62 }], ['bar', { x: 12, y: 62, w: 76, h: 2 }], ['dots', { n: 3, spread: 26, seed: 5, r: 2 }]],
  'shared-space': [['ring', { r: 32 }], ['person', { cx: 34, cy: 54, s: .7 }], ['person', { cx: 66, cy: 54, s: .7 }], ['netLinks', { n: 4, seed: 12 }]],

  // hidden
  'flute': [['bar', { x: 18, y: 46, w: 64, h: 10, rot: -12 }], ['dots', { n: 4, spread: 24, seed: 3, r: 2.2 }]],
  'glass-ingot': [['sheet', { w: 38, h: 40, skew: 10 }], ['hatch', { n: 2, w: 20, h: 18, ang: 30 }]],
  'sheet': [['sheet', { w: 40, h: 50, skew: 6 }], ['hatch', { n: 4, w: 28, h: 30 }]],
  'type-case': [['grid', { cols: 4, rows: 3, w: 54, h: 42 }], ['wedges', { n: 4, seed: 6 }]],
  'coin': [['disc', { r: 26 }], ['ring', { r: 20 }], ['rays', { n: 6, r0: 8, r1: 18 }]],
  'needle-card': [['ring', { r: 28 }], ['rays', { n: 8, r0: 22, r1: 28 }], ['bar', { x: 49, y: 28, w: 3, h: 44, rot: 24 }], ['tri', { r: 6, cy: 32 }]],
  'escapement': [['teeth', { n: 14, r: 22, t: 5 }], ['bar', { x: 46, y: 14, w: 8, h: 22, rot: 16 }]],
  'biconvex': [['arcs', { n: 1, r0: 34, a0: -1.05, a1: 1.05, cx: 30 }], ['arcs', { n: 1, r0: 34, a0: 2.09, a1: 4.19, cx: 70 }], ['rays', { n: 3, r0: 40, r1: 48, a0: 3.14 }]],
  'charge': [['disc', { r: 20 }], ['rays', { n: 10, r0: 22, r1: 36 }], ['dots', { n: 4, spread: 12, seed: 9, r: 2.4 }]],
  'ampoule': [['vessel', { w: 20, h: 40, neck: 7 }], ['bar', { x: 48, y: 14, w: 4, h: 14 }]],
  'culture-dish': [['ring', { r: 30, n: 2, gap: 5 }], ['dots', { n: 7, spread: 20, seed: 24, r: 3.4 }]],
  'polymer-chain': [['links', { n: 4, gap: 18, rx: 10, ry: 7 }], ['wave', { n: 1, amp: 4, freq: 2.4, w: 70, y: 66 }]],
  'ingot': [['sheet', { w: 46, h: 24, skew: 9 }], ['hatch', { n: 2, w: 30, h: 10 }], ['ticks', { n: 5 }]],
  'sweep': [['ring', { r: 32, n: 3, gap: 10 }], ['rays', { n: 1, r0: 0, r1: 32, a0: -.9 }], ['dots', { n: 2, spread: 24, seed: 4, r: 2.6 }]],
  'orbit': [['orbit', { n: 2, rot: 22 }]],
  'trilateration': [['dots', { n: 3, spread: 30, seed: 33, r: 3 }], ['ring', { r: 30, n: 3, gap: 9 }], ['tri', { r: 30 }]]
};

// ── category fallback shape grammar ────────────────────────────────────
const FALLBACK: Record<string, (id: string) => Spec> = {
  material: id => [['knap', { n: 7, r: 30, seed: hash(id) }], ['hatch', { n: 3, w: 22, h: 16, ang: (hash(id) % 90) }]],
  technique: id => [['arcs', { n: 3, r0: 12, dr: 9, a0: -2.4, a1: -.4 }], ['rays', { n: 3, r0: 30, r1: 40, a0: hash(id) % 6 }]],
  technology: _id => [['frame', { w: 46, h: 38 }], ['teeth', { n: 8, r: 14, t: 4 }]],
  biology: id => [['branchTree', { depth: 4, len: 17, seed: hash(id) }]],
  culture: id => [['ring', { r: 28 }], ['dots', { n: 6, spread: 20, seed: hash(id) }]],
  society: id => [['netLinks', { n: 6, seed: hash(id) }]],
  knowledge: id => [['grid', { cols: 3, rows: 3, w: 44, h: 44 }], ['dots', { n: 3, spread: 16, seed: hash(id) }]],
  science: id => [['axes', { kind: 'line' }], ['dots', { n: 4, spread: 18, seed: hash(id) }]],
  engineering: _id => [['teeth', { n: 9, r: 22, t: 7 }]],
  energy: _id => [['disc', { r: 14 }], ['rays', { n: 9, r0: 18, r1: 34 }]],
  computing: id => [['traces', { n: 4, seed: hash(id) }]],
  media: _id => [['frame', { w: 52, h: 38 }], ['wave', { n: 2, amp: 5, freq: 2, w: 40, gap: 12 }]],
  economy: _id => [['arcs', { n: 1, r0: 24, a0: -2.8, a1: -.4 }], ['arcs', { n: 1, r0: 24, a0: .35, a1: 2.75 }]]
};

function build(node: GlyphNode): string {
  const drawn = EXTRA_ART[node.id] ?? ART[node.id];
  if (drawn) return drawn;
  const spec = S[node.vis] || (FALLBACK[node.cat] || FALLBACK.material)(node.id);
  return spec.map(([fn, args]) => (P[fn] ? P[fn](args || {}) : '')).join('');
}

const cache = new Map<string, string>();

/** Render a discovery's mark. `locked` draws it as an unexcavated silhouette. */
export function svg(node: GlyphNode, options?: GlyphOpts): string {
  const opts: GlyphOpts = options || {};
  const key = node.id + (opts.locked ? '|L' : '') + (opts.plate ? '|P' : '');
  let inner: string | undefined = cache.get(key);
  if (inner === undefined) {
    inner = build(node);
    if (opts.plate) {
      inner = `<g opacity=".28"><line x1="4" y1="4" x2="14" y2="4"/><line x1="4" y1="4" x2="4" y2="14"/>` +
        `<line x1="96" y1="96" x2="86" y2="96"/><line x1="96" y1="96" x2="96" y2="86"/></g>` + inner;
    }
    cache.set(key, inner);
  }
  const cls = 'g' + (opts.class ? ' ' + opts.class : '');
  const sw = opts.sw || 2;
  return `<svg class="${cls}" viewBox="0 0 100 100" aria-hidden="true" focusable="false" ` +
    `fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" ` +
    `style="${opts.locked ? 'opacity:.22' : ''}">${inner}</svg>`;
}

/** The single stone on the landing page — hand-tuned, not from the table. */
export function heroStone(): string {
  return `<svg viewBox="0 0 200 200" fill="none" stroke="currentColor" stroke-linejoin="round" aria-hidden="true">
    <g stroke-width="1.4" opacity=".30">
      <circle cx="100" cy="100" r="86"/><circle cx="100" cy="100" r="66"/>
      <line x1="100" y1="6" x2="100" y2="22"/><line x1="100" y1="178" x2="100" y2="194"/>
      <line x1="6" y1="100" x2="22" y2="100"/><line x1="178" y1="100" x2="194" y2="100"/>
    </g>
    <g stroke-width="2.1" class="stone-body">
      <path d="M62 118 L52 84 L74 56 L112 46 L146 62 L152 96 L138 132 L104 148 Z"/>
      <path d="M74 56 L96 88 L152 96" opacity=".72"/>
      <path d="M96 88 L104 148" opacity=".72"/>
      <path d="M96 88 L52 84" opacity=".55"/>
      <path d="M112 46 L96 88" opacity=".55"/>
    </g>
    <g stroke-width="1.3" opacity=".5">
      <path d="M60 112 L70 104"/><path d="M66 96 L78 90"/><path d="M120 66 L132 74"/>
      <path d="M126 112 L138 106"/><path d="M110 130 L120 120"/>
    </g>
  </svg>`;
}


/** Inner SVG markup of a node's drawing, without the plate ticks. */
export function markup(node: GlyphNode): string {
  return build(node);
}

export const specCount = Object.keys(S).length;
export const artCount = Object.keys(ART).length;
export { hash, rng };
