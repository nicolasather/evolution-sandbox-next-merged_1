// Quiz Studio — original, face-free scene art. Run: node tools/quiz-art/generate.mjs
// Writes SVG files to public/quiz/art/. Everything is authored here (no third-party art, no text baked in).
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'quiz', 'art');
mkdirSync(OUT, { recursive: true });

const C = { ink: '#05080D', night: '#0B1018', navy: '#12202F', steel: '#1d3550', teal: '#0f4a63', cyan: '#16C9EF', cyanLo: '#0e7f9c', yellow: '#FFD52F', gold: '#c99a10', coral: '#FF386A', coralLo: '#a81f45', lime: '#B5ED44', paper: '#F8F7F0', stone: '#2a3b50', stoneHi: '#3d5572', mist: '#9fe9fb' };
const SW = 5; // outline weight
let seed = 7;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const f = (n) => Math.round(n * 10) / 10;
const pts = (a) => a.map(([x, y]) => `${f(x)},${f(y)}`).join(' ');
const poly = (a, fill, stroke = C.ink, sw = SW, extra = '') => `<polygon points="${pts(a)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="miter" ${extra}/>`;
const rect = (x, y, w, h, fill, stroke = C.ink, sw = SW, extra = '') => `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="miter" ${extra}/>`;
const line = (x1, y1, x2, y2, stroke, sw = 3, extra = '') => `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="square" ${extra}/>`;
const circle = (x, y, r, fill, stroke = C.ink, sw = SW) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;

const head = (w, h, title, desc) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-labelledby="t d" preserveAspectRatio="xMidYMid slice"><title id="t">${title}</title><desc id="d">${desc}</desc>
<defs>
<pattern id="ht" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><circle cx="7" cy="7" r="2.6" fill="#000" opacity=".28"/></pattern>
<pattern id="htl" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><circle cx="6" cy="6" r="2" fill="#fff" opacity=".16"/></pattern>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#07101b"/><stop offset=".55" stop-color="#0f4a63"/><stop offset="1" stop-color="#1b87a3"/></linearGradient>
<linearGradient id="dusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a0f2e"/><stop offset=".5" stop-color="#7a1f4a"/><stop offset="1" stop-color="#ff7a3a"/></linearGradient>
<linearGradient id="hall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a1320"/><stop offset="1" stop-color="#1d3550"/></linearGradient>
<linearGradient id="beam" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFD52F" stop-opacity=".85"/><stop offset="1" stop-color="#FFD52F" stop-opacity="0"/></linearGradient>
</defs>`;
const tail = '</svg>';

function rays(cx, cy, n, len, fill, op, rot = 0) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2, w = (Math.PI * 2 / n) * 0.5;
    s += `<polygon points="${pts([[cx, cy], [cx + Math.cos(a) * len, cy + Math.sin(a) * len], [cx + Math.cos(a + w) * len, cy + Math.sin(a + w) * len]])}" fill="${fill}" opacity="${op}"/>`;
  }
  return s;
}
function ridge(w, baseY, amp, step, fill, stroke = C.ink, sw = 4) {
  const p = [[0, baseY + amp * 3]];
  for (let x = 0; x <= w + step; x += step) p.push([x, baseY - rnd() * amp]);
  p.push([w + step, baseY + amp * 3]);
  return poly(p, fill, stroke, sw);
}
function bolt(x, y, s, fill = C.yellow) {
  return poly([[x, y], [x + 34 * s, y - 70 * s], [x + 12 * s, y - 70 * s], [x + 46 * s, y - 150 * s], [x - 8 * s, y - 62 * s], [x + 14 * s, y - 62 * s]], fill, C.ink, 4);
}
function speed(w, h, n, color, op, angle = -16) {
  let s = '';
  for (let i = 0; i < n; i++) { const y = rnd() * h, x = rnd() * w, l = 120 + rnd() * 380; s += `<line x1="${f(x)}" y1="${f(y)}" x2="${f(x + l)}" y2="${f(y + l * Math.tan(angle * Math.PI / 180))}" stroke="${color}" stroke-width="${f(2 + rnd() * 5)}" opacity="${op}" stroke-linecap="square"/>`; }
  return s;
}
function stars(w, h, n, maxY) {
  let s = '';
  for (let i = 0; i < n; i++) { const x = rnd() * w, y = rnd() * maxY, r = 1.5 + rnd() * 3; s += `<polygon points="${pts([[x, y - r * 2], [x + r, y], [x, y + r * 2], [x - r, y]])}" fill="${C.paper}" opacity="${f(0.4 + rnd() * 0.5)}"/>`; }
  return s;
}
// castle-like block tower with battlements and lit windows
function tower(x, y, w, h, body, hi, win = C.yellow) {
  let s = rect(x, y, w, h, body);
  s += rect(x, y, w * 0.34, h, hi, 'none', 0, 'opacity=".55"');
  const merl = Math.max(3, Math.floor(w / 26));
  for (let i = 0; i < merl; i++) { if (i % 2 === 0) s += rect(x + (i * w) / merl, y - 22, w / merl, 22, body); }
  for (let r = 0; r < Math.floor(h / 70); r++) s += rect(x + w / 2 - 9, y + 40 + r * 70, 18, 30, win, C.ink, 3);
  return s;
}
function banner(x, y, color, h = 110) {
  return line(x, y, x, y + h + 30, C.ink, 7) + poly([[x, y], [x + 70, y + 14], [x + 52, y + 40], [x + 70, y + 66], [x, y + 52]], color, C.ink, 4);
}
function island(x, y, w, grass = C.stoneHi) {
  const d = w * 0.55;
  return poly([[x, y], [x + w, y], [x + w * 0.8, y + d * 0.55], [x + w * 0.58, y + d], [x + w * 0.48, y + d * 0.62], [x + w * 0.3, y + d * 0.9], [x + w * 0.16, y + d * 0.4]], C.stone, C.ink, 5) + poly([[x - 6, y], [x + w + 6, y], [x + w - 8, y - 16], [x + 10, y - 16]], grass, C.ink, 5);
}
function overlay(w, h) { return `<rect width="${w}" height="${h}" fill="url(#ht)"/>`; }
function frameCuts(w, h) { // angular comic crop in the corners
  return `<polygon points="0,0 ${w * 0.09},0 0,${h * 0.12}" fill="${C.ink}"/><polygon points="${w},${h} ${w * 0.9},${h} ${w},${h * 0.88}" fill="${C.ink}"/>`;
}

/* ---------------- 1. HERO: the quiz arena ---------------- */
function hero() {
  seed = 11; const W = 1600, H = 900;
  let s = head(W, H, 'Quiz arena', 'A hilltop arena with a lit stage, banner poles and floating answer tiles under a night sky.');
  s += `<rect width="${W}" height="${H}" fill="url(#sky)"/>`;
  s += stars(W, H, 60, 380);
  s += rays(1180, 250, 20, 1500, C.yellow, 0.07, 0.1);
  s += circle(1180, 250, 120, C.yellow, C.ink, 6) + circle(1210, 232, 98, '#ffe97a', 'none', 0);
  s += speed(W, H, 18, C.mist, 0.14);
  s += ridge(W, 520, 170, 90, '#16405b');
  s += ridge(W, 610, 150, 70, '#102f46');
  // far towers
  s += tower(120, 470, 86, 250, C.stone, C.stoneHi) + tower(260, 520, 64, 200, C.stone, C.stoneHi) + tower(1390, 440, 96, 290, C.stone, C.stoneHi) + tower(1290, 520, 64, 200, C.stone, C.stoneHi);
  // central arena (stepped stage)
  const cx = 800;
  s += poly([[cx - 520, 840], [cx - 420, 640], [cx + 420, 640], [cx + 520, 840]], C.stone);
  s += poly([[cx - 420, 640], [cx - 330, 520], [cx + 330, 520], [cx + 420, 640]], C.stoneHi);
  s += poly([[cx - 330, 520], [cx - 250, 430], [cx + 250, 430], [cx + 330, 520]], '#4d6d8f');
  for (let i = 0; i < 9; i++) s += line(cx - 480 + i * 120, 840, cx - 380 + i * 95, 650, C.ink, 4, 'opacity=".6"');
  s += rect(cx - 250, 402, 500, 28, C.yellow, C.ink, 6); // stage lip
  s += rect(cx - 220, 330, 440, 72, C.night, C.ink, 6);
  for (let i = 0; i < 5; i++) s += rect(cx - 200 + i * 84, 346, 66, 40, [C.cyan, C.yellow, C.coral, C.lime, C.cyan][i], C.ink, 4);
  // light beams from stage
  for (const [bx, a] of [[cx - 200, -0.5], [cx - 70, -0.2], [cx + 70, 0.2], [cx + 200, 0.5]]) s += `<polygon points="${pts([[bx, 330], [bx - 40 + a * 600, 40], [bx + 40 + a * 600, 40]])}" fill="${C.yellow}" opacity=".13"/>`;
  // banner poles
  s += banner(cx - 360, 360, C.coral) + banner(cx + 290, 360, C.cyan) + banner(cx - 460, 520, C.yellow, 80) + banner(cx + 390, 520, C.lime, 80);
  // floating answer tiles (shapes only)
  const tiles = [[330, 250, -12, C.cyan, 'tri'], [520, 170, 7, C.yellow, 'circ'], [1090, 160, -6, C.coral, 'sq'], [1290, 270, 11, C.lime, 'dia']];
  for (const [tx, ty, rot, col, shape] of tiles) {
    s += `<g transform="rotate(${rot} ${tx} ${ty})">` + rect(tx - 90, ty - 60, 180, 120, C.night, C.ink, 6) + rect(tx - 80, ty - 50, 160, 100, col, C.ink, 4);
    if (shape === 'tri') s += poly([[tx, ty - 30], [tx + 32, ty + 26], [tx - 32, ty + 26]], C.night, C.ink, 4);
    if (shape === 'circ') s += circle(tx, ty, 28, C.night, C.ink, 4);
    if (shape === 'sq') s += rect(tx - 26, ty - 26, 52, 52, C.night, C.ink, 4);
    if (shape === 'dia') s += poly([[tx, ty - 34], [tx + 34, ty], [tx, ty + 34], [tx - 34, ty]], C.night, C.ink, 4);
    s += '</g>';
  }
  s += bolt(120, 700, 1.4) + bolt(1460, 760, 1.2, C.coral) + bolt(700, 150, 0.8, C.cyan);
  // foreground rocks and crates
  s += poly([[0, 900], [0, 760], [120, 700], [260, 780], [340, 900]], '#0d1a28') + poly([[1600, 900], [1600, 740], [1470, 690], [1330, 790], [1240, 900]], '#0d1a28');
  s += overlay(W, H) + `<rect width="${W}" height="${H}" fill="url(#htl)" opacity=".5"/>` + frameCuts(W, H) + tail;
  return s;
}

/* ---------------- 2. SOLO: the clock climb ---------------- */
function solo() {
  seed = 23; const W = 1200, H = 675;
  let s = head(W, H, 'Solo play: the clock climb', 'A winding stone trail climbs a cliff toward a giant clock tower at dawn.');
  s += `<rect width="${W}" height="${H}" fill="url(#dusk)"/>` + rays(900, 260, 18, 1200, '#ffd58a', 0.1, 0.2) + circle(900, 270, 90, '#ffe08a', C.ink, 6);
  s += speed(W, H, 10, '#ffd0a0', 0.18);
  s += ridge(W, 420, 120, 80, '#6d2750') + ridge(W, 500, 100, 60, '#3d1a40');
  // cliff with switchback trail
  s += poly([[420, 675], [470, 470], [560, 380], [660, 300], [760, 240], [900, 215], [1200, 215], [1200, 675]], '#2a1636');
  s += poly([[420, 675], [470, 470], [560, 380], [660, 300], [760, 240], [800, 240], [700, 330], [610, 430], [540, 520], [520, 675]], '#4a2750', C.ink, 4);
  const trail = [[520, 640], [880, 610], [560, 560], [900, 510], [600, 460], [930, 410], [660, 360], [940, 310], [760, 270]];
  for (let i = 0; i < trail.length - 1; i++) {
    const [a, b] = [trail[i], trail[i + 1]];
    s += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${C.ink}" stroke-width="30" stroke-linecap="square"/><line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#e9c98f" stroke-width="20" stroke-linecap="square"/>`;
    s += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${C.coral}" stroke-width="3" stroke-dasharray="14 14"/>`;
  }
  // checkpoints (flags)
  for (const [x, y] of [[880, 610], [900, 510], [930, 410], [940, 310]]) s += banner(x, y - 90, C.cyan, 60);
  // clock tower
  s += rect(880, 70, 150, 200, C.stoneHi) + rect(880, 70, 54, 200, '#5d7ea3', 'none', 0, 'opacity=".6"');
  s += poly([[860, 70], [955, -10], [1050, 70]], C.coral);
  s += circle(955, 150, 58, C.paper, C.ink, 6);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; s += line(955 + Math.cos(a) * 44, 150 + Math.sin(a) * 44, 955 + Math.cos(a) * 52, 150 + Math.sin(a) * 52, C.ink, 4); }
  s += line(955, 150, 955, 110, C.ink, 7) + line(955, 150, 990, 168, C.coral, 7) + circle(955, 150, 7, C.ink, C.ink, 2);
  // foreground gear/ruins
  s += poly([[0, 675], [0, 520], [140, 470], [290, 560], [340, 675]], '#1a0e28');
  s += bolt(120, 470, 0.9, C.yellow) + bolt(300, 340, 0.55, C.cyan);
  s += overlay(W, H) + frameCuts(W, H) + tail;
  return s;
}

/* ---------------- 3. CLASSROOM: the projection hall ---------------- */
function classroom() {
  seed = 31; const W = 1200, H = 675;
  let s = head(W, H, 'Classroom projector: the hall', 'A wide hall with a huge projection screen, team banners on poles and a light beam from the booth.');
  s += `<rect width="${W}" height="${H}" fill="url(#hall)"/>`;
  // perspective floor
  s += poly([[0, 675], [0, 470], [1200, 470], [1200, 675]], '#14253a');
  for (let i = -8; i <= 8; i++) s += line(600 + i * 40, 470, 600 + i * 190, 675, C.stone, 3, 'opacity=".7"');
  for (let i = 0; i < 5; i++) s += line(0, 470 + i * i * 12 + 14, 1200, 470 + i * i * 12 + 14, C.stone, 3, 'opacity=".6"');
  // columns
  for (const x of [90, 250, 950, 1110]) s += rect(x - 36, 70, 72, 420, C.stone) + rect(x - 36, 70, 24, 420, C.stoneHi, 'none', 0, 'opacity=".7"') + rect(x - 50, 50, 100, 30, C.stoneHi) + rect(x - 50, 480, 100, 26, C.stoneHi);
  // screen
  s += rect(360, 110, 480, 290, C.ink, C.ink, 6) + rect(376, 126, 448, 258, '#e9f9ff', C.ink, 4);
  s += rect(376, 126, 448, 258, C.cyan, 'none', 0, 'opacity=".25"');
  s += rect(404, 156, 300, 28, C.night, 'none', 0) + rect(404, 200, 392, 22, '#b7c9d8', 'none', 0) + rect(404, 236, 360, 22, '#b7c9d8', 'none', 0);
  for (let i = 0; i < 4; i++) s += rect(404 + i * 98, 292, 86, 62, [C.cyan, C.yellow, C.coral, C.lime][i], C.ink, 4);
  s += poly([[372, 400], [828, 400], [860, 430], [340, 430]], C.stoneHi);
  // projector booth + beam
  s += rect(560, 16, 80, 36, C.night, C.ink, 5) + circle(600, 58, 14, C.yellow, C.ink, 4);
  s += `<polygon points="${pts([[600, 58], [376, 126], [824, 126]])}" fill="${C.yellow}" opacity=".18"/>`;
  // team tables with banners
  const cols = [C.coral, C.cyan, C.yellow, C.lime];
  cols.forEach((col, i) => {
    const x = 150 + i * 300, y = 520 + (i % 2) * 20;
    s += rect(x - 80, y, 160, 50, C.steel) + rect(x - 80, y, 160, 14, col, C.ink, 4);
    s += banner(x - 56, y - 140, col, 90);
    s += rect(x - 36, y + 50, 14, 40, C.ink, C.ink, 2) + rect(x + 22, y + 50, 14, 40, C.ink, C.ink, 2);
  });
  s += bolt(70, 640, 0.8, C.yellow) + bolt(1150, 640, 0.8, C.coral);
  s += overlay(W, H) + frameCuts(W, H) + tail;
  return s;
}

/* ---------------- 4. ONLINE: linked sky islands ---------------- */
function online() {
  seed = 47; const W = 1200, H = 675;
  let s = head(W, H, 'Online multiplayer: linked sky islands', 'Floating islands, each with a lit beacon tower, joined by glowing links to a central beacon.');
  s += `<rect width="${W}" height="${H}" fill="url(#sky)"/>` + stars(W, H, 50, 320) + rays(600, 300, 24, 1100, C.cyan, 0.08, 0.05);
  s += speed(W, H, 14, C.mist, 0.12, -8);
  const spots = [[110, 360, 260], [800, 400, 300], [470, 480, 250], [880, 215, 220], [210, 175, 220]];
  const hub = [600, 250];
  // links
  const centers = spots.map(([x, y, w]) => [x + w / 2, y - 40]);
  for (const [cx, cy] of centers) s += `<line x1="${hub[0]}" y1="${hub[1]}" x2="${cx}" y2="${cy}" stroke="${C.ink}" stroke-width="14"/><line x1="${hub[0]}" y1="${hub[1]}" x2="${cx}" y2="${cy}" stroke="${C.cyan}" stroke-width="6" stroke-dasharray="22 12"/>`;
  s += island(520, 300, 160, '#5d7ea3');
  s += poly([[580, 250], [600, 120], [620, 250]], C.stoneHi) + circle(600, 112, 36, C.yellow, C.ink, 6) + circle(600, 112, 16, C.paper, C.ink, 4);
  s += rays(600, 112, 12, 130, C.yellow, 0.2);
  spots.forEach(([x, y, w], i) => {
    s += island(x, y, w, i % 2 ? '#4d6d8f' : C.stoneHi);
    s += rect(x + w / 2 - 22, y - 120, 44, 104, C.stone) + poly([[x + w / 2 - 30, y - 120], [x + w / 2, y - 168], [x + w / 2 + 30, y - 120]], [C.coral, C.lime, C.yellow, C.cyan, C.coral][i]);
    s += rect(x + w / 2 - 8, y - 92, 16, 26, C.yellow, C.ink, 3);
    s += banner(x + 24, y - 90, [C.cyan, C.coral, C.lime, C.yellow, C.lime][i], 50);
  });
  s += bolt(1080, 640, 1, C.yellow) + bolt(60, 650, 0.8, C.cyan);
  s += overlay(W, H) + frameCuts(W, H) + tail;
  return s;
}

/* ---------------- 5. LIBRARY banner: towering shelves of quiz tiles ---------------- */
function library() {
  seed = 59; const W = 1600, H = 420;
  let s = head(W, H, 'Quiz library shelves', 'Tall stone shelves stacked with colorful quiz boxes under warm lamps.');
  s += `<rect width="${W}" height="${H}" fill="url(#hall)"/>` + rays(800, -60, 18, 1400, C.yellow, 0.06, 0.4);
  const cols = [C.cyan, C.yellow, C.coral, C.lime, '#5d7ea3', C.paper];
  for (let sh = 0; sh < 4; sh++) {
    const x0 = sh * 420 - 20; s += rect(x0, 60, 380, 340, C.stone) + rect(x0 + 14, 74, 352, 312, C.night, C.ink, 4);
    for (let r = 0; r < 3; r++) {
      const y = 74 + r * 104; s += rect(x0 + 14, y + 98, 352, 8, C.stoneHi, C.ink, 3);
      let x = x0 + 22;
      while (x < x0 + 340) { const w = 22 + rnd() * 34, h = 52 + rnd() * 40; s += rect(x, y + 98 - h, w, h, cols[Math.floor(rnd() * cols.length)], C.ink, 3); if (rnd() > .6) s += rect(x + 5, y + 98 - h + 10, w - 10, 7, C.ink, 'none', 0, 'opacity=".5"'); x += w + 3; }
    }
  }
  s += bolt(40, 410, 0.7, C.yellow) + bolt(1560, 410, 0.7, C.coral);
  s += overlay(W, H) + tail;
  return s;
}

/* ---------------- 6. RESULTS: podium ---------------- */
function results() {
  seed = 71; const W = 1600, H = 520;
  let s = head(W, H, 'Results podium', 'Three podium blocks of different heights under a spotlight with confetti shards.');
  s += `<rect width="${W}" height="${H}" fill="url(#sky)"/>` + rays(800, 520, 22, 1400, C.yellow, 0.09, 0) + speed(W, H, 14, C.mist, 0.12);
  const base = 470;
  const blocks = [[560, 150, C.cyan], [800, 230, C.yellow], [1040, 100, C.coral]]; // second, first, third
  s += `<polygon points="${pts([[800, 0], [560, base], [1040, base]])}" fill="${C.yellow}" opacity=".12"/>`;
  for (const [cx, h, col] of blocks) {
    s += rect(cx - 110, base - h, 220, h, col) + rect(cx - 110, base - h, 70, h, '#fff', 'none', 0, 'opacity=".18"') + rect(cx - 124, base - h - 22, 248, 22, C.paper);
  }
  for (let i = 0; i < 46; i++) { const x = rnd() * W, y = rnd() * 400, w = 10 + rnd() * 14; s += `<g transform="rotate(${f(rnd() * 360)} ${f(x)} ${f(y)})">${rect(x, y, w, w * 0.45, [C.cyan, C.yellow, C.coral, C.lime, C.paper][i % 5], C.ink, 2)}</g>`; }
  s += rect(0, base, W, H - base, '#0d1a28') + bolt(120, 500, 0.8) + bolt(1500, 500, 0.8, C.coral);
  s += overlay(W, H) + tail;
  return s;
}

const files = { 'hero-arena.svg': hero(), 'mode-solo.svg': solo(), 'mode-classroom.svg': classroom(), 'mode-online.svg': online(), 'library-shelves.svg': library(), 'results-podium.svg': results() };
for (const [n, c] of Object.entries(files)) { writeFileSync(join(OUT, n), c); console.log(n, c.length); }
