/** Shared screen-space atmosphere for the four individual-device game canvases (Swarm Survival, Arena Clash, Obstacle Survival, Clue Racing).
 *  Drawn LAST, on top of the finished scene, with the identity transform in CSS pixels. Purely visual: nothing here reads or writes game state, hit-tests, or covers
 *  a control. Every element is a pure function of (theme, size, time, index), so a still frame is repeatable; `reduced` freezes motion and `lowFx` drops particles.
 *  Each theme has its own light, its own drifting life and its own edge dressing so the four games never look like one skin. */
import { hash2 } from './props';

export type AtmosTheme = 'dusk' | 'stadium' | 'morning' | 'parchment';
type G = CanvasRenderingContext2D;
export type AtmosOpts = { reduced?: boolean; lowFx?: boolean; seed?: number; accent?: string };

const TAU = Math.PI * 2;

function vignette(g: G, w: number, h: number, rgb: string, a: number) {
  const r = Math.hypot(w, h) / 2; const gr = g.createRadialGradient(w / 2, h / 2, r * 0.45, w / 2, h / 2, r);
  gr.addColorStop(0, `rgba(${rgb},0)`); gr.addColorStop(1, `rgba(${rgb},${a})`); g.fillStyle = gr; g.fillRect(0, 0, w, h);
}
function tint(g: G, w: number, h: number, top: string, bottom: string) {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, top); gr.addColorStop(1, bottom); g.fillStyle = gr; g.fillRect(0, 0, w, h);
}
function cloudShadows(g: G, w: number, h: number, t: number, rgb: string, a: number, seed: number) {
  for (let i = 0; i < 3; i++) {
    const sp = 6 + i * 3; const x = ((t * sp + hash2(i, seed, 11) * (w + 500)) % (w + 500)) - 250; const y = h * (0.2 + 0.3 * hash2(i, seed, 12));
    const rx = 130 + 70 * hash2(i, seed, 13); const ry = rx * 0.5; const gr = g.createRadialGradient(x, y, 0, x, y, rx);
    gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, rx, ry, -0.2, 0, TAU); g.fill();
  }
}

/** Fireflies: warm points that wander and twinkle (dusk). */
function fireflies(g: G, w: number, h: number, t: number, n: number, seed: number) {
  for (let i = 0; i < n; i++) {
    const bx = hash2(i, seed, 21) * w; const by = hash2(i, seed, 22) * h; const ph = hash2(i, seed, 23) * TAU;
    const x = bx + Math.sin(t * 0.5 + ph) * 26 + Math.sin(t * 1.3 + ph * 2) * 8; const y = by + Math.cos(t * 0.4 + ph) * 20;
    const tw = 0.35 + 0.65 * Math.max(0, Math.sin(t * 1.8 + ph * 3)); const r = 2.2 + hash2(i, seed, 24) * 1.6;
    const gr = g.createRadialGradient(x, y, 0, x, y, r * 6); gr.addColorStop(0, `rgba(255,236,150,${0.55 * tw})`); gr.addColorStop(1, 'rgba(255,236,150,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r * 6, 0, TAU); g.fill();
    g.fillStyle = `rgba(255,250,210,${0.9 * tw})`; g.beginPath(); g.arc(x, y, r * 0.7, 0, TAU); g.fill();
  }
}
/** Confetti: small tumbling paper rectangles in the team colours (stadium). */
function confetti(g: G, w: number, h: number, t: number, n: number, seed: number) {
  const cols = ['#F56F59', '#F7D96B', '#6DD7B0', '#6BBFE8', '#745FAD'];
  for (let i = 0; i < n; i++) {
    const sp = 18 + hash2(i, seed, 31) * 26; const x = (hash2(i, seed, 32) * w + Math.sin(t * 0.8 + i) * 18) % w; const y = ((t * sp + hash2(i, seed, 33) * (h + 80)) % (h + 80)) - 40;
    const a = t * (1.5 + hash2(i, seed, 34) * 2) + i; g.save(); g.translate(x, y); g.rotate(a); g.scale(1, Math.abs(Math.cos(a * 1.3)) * 0.8 + 0.2);
    g.globalAlpha = 0.8; g.fillStyle = cols[i % cols.length]!; g.fillRect(-4, -2, 8, 4); g.restore();
  }
}
/** Pollen and dandelion seeds drifting on a breeze, with soft sun shafts (morning). */
function breeze(g: G, w: number, h: number, t: number, n: number, seed: number) {
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) { const x0 = w * (0.1 + i * 0.32) + Math.sin(t * 0.15 + i) * 18; const gr = g.createLinearGradient(x0, 0, x0 + w * 0.22, h); gr.addColorStop(0, 'rgba(255,238,170,.10)'); gr.addColorStop(1, 'rgba(255,238,170,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(x0, 0); g.lineTo(x0 + w * 0.1, 0); g.lineTo(x0 + w * 0.34, h); g.lineTo(x0 + w * 0.18, h); g.closePath(); g.fill(); }
  g.restore();
  for (let i = 0; i < n; i++) {
    const sp = 14 + hash2(i, seed, 41) * 20; const x = ((t * sp + hash2(i, seed, 42) * (w + 60)) % (w + 60)) - 30; const y = hash2(i, seed, 43) * h + Math.sin(t * 0.9 + i * 2) * 14;
    g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.arc(x, y, 1.6 + hash2(i, seed, 44) * 1.4, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 8, y + 2); g.stroke();
  }
}
/** Dust motes in lamplight and a faint warm paper grain (parchment). */
function motes(g: G, w: number, h: number, t: number, n: number, seed: number) {
  for (let i = 0; i < n; i++) {
    const x = hash2(i, seed, 51) * w + Math.sin(t * 0.3 + i) * 12; const y = ((hash2(i, seed, 52) * h - t * (4 + hash2(i, seed, 53) * 6)) % h + h) % h;
    g.fillStyle = `rgba(255,244,214,${0.25 + 0.4 * hash2(i, seed, 54)})`; g.beginPath(); g.arc(x, y, 1 + hash2(i, seed, 55) * 1.8, 0, TAU); g.fill();
  }
}

/** Bunting along the top edge: swaying triangular pennants on a sagging string (stadium). */
function bunting(g: G, w: number, t: number, cols: readonly string[]) {
  const n = Math.max(6, Math.round(w / 64)); const sag = 16; g.save(); g.lineJoin = 'round'; g.lineWidth = 2; g.strokeStyle = 'rgba(23,37,58,.85)';
  g.beginPath(); for (let i = 0; i <= n; i++) { const x = (i / n) * w; const y = 2 + Math.sin((i / n) * Math.PI) * sag; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
  for (let i = 0; i < n; i++) {
    const x0 = (i / n) * w; const x1 = ((i + 1) / n) * w; const xm = (x0 + x1) / 2; const y0 = 2 + Math.sin((i / n) * Math.PI) * sag; const y1 = 2 + Math.sin(((i + 1) / n) * Math.PI) * sag;
    const sw = Math.sin(t * 2.2 + i * 0.9) * 3; g.fillStyle = cols[i % cols.length]!; g.beginPath(); g.moveTo(x0 + 4, y0 + 1); g.lineTo(x1 - 4, y1 + 1); g.lineTo(xm + sw, (y0 + y1) / 2 + 24); g.closePath(); g.fill(); g.stroke();
  }
  g.restore();
}
/** Leafy corners (morning): two overlapping leaf clusters that sway a little. */
function leafCorner(g: G, x: number, y: number, flip: number, t: number, s: number) {
  g.save(); g.translate(x, y); g.scale(flip, 1); g.lineWidth = 2.5; g.strokeStyle = '#17253A';
  for (let i = 0; i < 6; i++) { const a = 0.25 + i * 0.24 + Math.sin(t * 1.1 + i) * 0.03; g.save(); g.rotate(a); g.fillStyle = i % 2 ? '#4FB286' : '#2F8F6B'; g.beginPath(); g.ellipse(s * 0.55, 0, s * 0.5, s * 0.17, 0, 0, TAU); g.fill(); g.stroke(); g.restore(); }
  g.restore();
}
/** Compass-rose corner marks and a dashed frame line (parchment). */
function compassCorner(g: G, x: number, y: number, s: number, t: number) {
  g.save(); g.translate(x, y); g.rotate(Math.sin(t * 0.4) * 0.05); g.lineJoin = 'round'; g.strokeStyle = '#17253A'; g.lineWidth = 2;
  for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 2); g.fillStyle = i % 2 ? '#F6A04D' : '#FFF7E8'; g.beginPath(); g.moveTo(0, -s); g.lineTo(s * 0.2, -s * 0.2); g.lineTo(0, 0); g.lineTo(-s * 0.2, -s * 0.2); g.closePath(); g.fill(); g.stroke(); }
  g.restore();
}
/** Moon glow in the top corner (dusk). */
function moon(g: G, w: number, t: number) {
  const x = w - 70; const y = 64; const gr = g.createRadialGradient(x, y, 4, x, y, 120); gr.addColorStop(0, 'rgba(255,248,214,.5)'); gr.addColorStop(1, 'rgba(255,248,214,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, 120, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,248,222,.85)'; g.strokeStyle = 'rgba(23,37,58,.7)'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 17 + Math.sin(t * 0.6) * 0.4, 0, TAU); g.fill(); g.stroke();
  g.fillStyle = 'rgba(206,196,160,.55)'; g.beginPath(); g.arc(x - 5, y - 3, 4, 0, TAU); g.arc(x + 6, y + 5, 3, 0, TAU); g.fill();
}

export function drawAtmosphere(g: G, w: number, h: number, time: number, theme: AtmosTheme, o: AtmosOpts = {}) {
  if (w < 40 || h < 40) return;
  const t = o.reduced ? 0 : time; const seed = o.seed ?? 7; const rich = !o.lowFx; const small = w < 560;
  g.save(); g.setLineDash([]); g.globalCompositeOperation = 'source-over';
  switch (theme) {
    case 'dusk': tint(g, w, h, 'rgba(24,36,92,.20)', 'rgba(255,170,90,.07)'); if (rich) cloudShadows(g, w, h, t, '16,24,60', 0.16, seed); vignette(g, w, h, '10,16,44', 0.42); if (rich) { fireflies(g, w, h, t, small ? 8 : 16, seed); if (!small) moon(g, w, t); } break;
    case 'stadium': tint(g, w, h, 'rgba(255,196,110,.10)', 'rgba(245,111,89,.06)'); if (rich) cloudShadows(g, w, h, t, '120,60,40', 0.10, seed); vignette(g, w, h, '60,24,40', 0.34); if (rich) { confetti(g, w, h, t, small ? 10 : 22, seed); bunting(g, w, t, ['#F56F59', '#F7D96B', '#6DD7B0', '#6BBFE8', '#745FAD']); } break;
    case 'morning': tint(g, w, h, 'rgba(255,244,190,.10)', 'rgba(120,210,255,.05)'); if (rich) cloudShadows(g, w, h, t, '30,90,70', 0.12, seed); vignette(g, w, h, '20,60,50', 0.28); if (rich) { breeze(g, w, h, t, small ? 8 : 18, seed); if (!small) { leafCorner(g, 0, h, 1, t, 120); leafCorner(g, w, h, -1, t, 120); } } break;
    case 'parchment': tint(g, w, h, 'rgba(255,214,140,.12)', 'rgba(150,90,40,.10)'); if (rich) cloudShadows(g, w, h, t, '90,50,20', 0.10, seed); vignette(g, w, h, '70,36,14', 0.38); if (rich) { motes(g, w, h, t, small ? 10 : 24, seed); if (!small) { compassCorner(g, 34, h - 34, 26, t); compassCorner(g, w - 34, h - 34, 26, t + 1); } } break;
  }
  g.restore();
}
