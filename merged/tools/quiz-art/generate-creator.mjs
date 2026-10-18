// Quiz Studio — original, face-free creator/game scene art. Run: node tools/quiz-art/generate-creator.mjs
// Writes SVG files to public/quiz/art/. Everything is authored here: no third-party art, no people, no faces, no baked-in text.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'quiz', 'art');
mkdirSync(OUT, { recursive: true });

const C = { ink: '#0A1220', cream: '#FFF6E2', yellow: '#FFD52F', cyan: '#16C9EF', coral: '#FF386A', lime: '#B5ED44', purple: '#8D5BFF', blue: '#3B6BE8', white: '#FFFFFF', night: '#0B1018' };
const SW = 6;
const f = (n) => Math.round(n * 10) / 10;
const R = (x, y, w, h, fill, o = {}) => `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${o.rx ?? 12}" fill="${fill}" stroke="${o.stroke ?? C.ink}" stroke-width="${o.sw ?? SW}"${o.rot ? ` transform="rotate(${o.rot} ${f(x + w / 2)} ${f(y + h / 2)})"` : ''}${o.op ? ` opacity="${o.op}"` : ''}/>`;
const E = (x, y, r, fill, o = {}) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${fill}" stroke="${o.stroke ?? C.ink}" stroke-width="${o.sw ?? SW}"/>`;
const P = (pts, fill, o = {}) => `<polygon points="${pts.map(([x, y]) => `${f(x)},${f(y)}`).join(' ')}" fill="${fill}" stroke="${o.stroke ?? C.ink}" stroke-width="${o.sw ?? SW}" stroke-linejoin="round"/>`;
const L = (x1, y1, x2, y2, o = {}) => `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${o.stroke ?? C.ink}" stroke-width="${o.sw ?? SW}" stroke-linecap="round"${o.op ? ` opacity="${o.op}"` : ''}/>`;
const PATH = (d, fill, o = {}) => `<path d="${d}" fill="${fill}" stroke="${o.stroke ?? C.ink}" stroke-width="${o.sw ?? SW}" stroke-linejoin="round" stroke-linecap="round"/>`;

function svg(w, h, title, desc, bg, body, accent = C.ink) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-labelledby="t d" preserveAspectRatio="xMidYMid slice"><title id="t">${title}</title><desc id="d">${desc}</desc>
<defs><pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="2.3" fill="${accent}" opacity=".2"/></pattern><pattern id="stripe" width="26" height="26" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><rect width="26" height="26" fill="${C.cream}"/><rect width="9" height="26" fill="${C.yellow}"/></pattern></defs>
<rect width="${w}" height="${h}" fill="${bg}"/><rect width="${w}" height="${h}" fill="url(#dots)"/>
${L(-20, h * 0.2, w + 20, h * 0.2, { sw: 7, op: 0.14 })}${L(-20, h * 0.78, w + 20, h * 0.78, { sw: 7, op: 0.14 })}
${body}</svg>`;
}
const write = (name, s) => writeFileSync(join(OUT, name), s);
const W = 1000, H = 620;

/* ── creator step scenes ── */
write('cover-supplies.svg', svg(W, H, 'Cover supplies', 'A cover card with a mountain picture, a brush, a pencil and colour swatches.', C.yellow, [
  P([[0, 560], [260, 380], [380, 620]], C.cyan), P([[700, 0], [1000, 0], [940, 260]], C.coral),
  R(250, 90, 470, 380, C.cream, { rot: -3 }), R(290, 130, 390, 220, C.cyan, { rot: -3 }),
  P([[310, 330], [430, 190], [540, 330]], C.lime), P([[470, 330], [560, 230], [660, 330]], C.purple), E(610, 180, 28, C.yellow),
  R(300, 380, 260, 26, C.ink, { rot: -3, rx: 6, sw: 0 }), R(300, 420, 180, 20, C.purple, { rot: -3, rx: 6, sw: 0 }),
  R(730, 150, 34, 330, C.coral, { rot: 18 }), P([[770, 120], [800, 130], [790, 175], [760, 160]], C.cream, { sw: 5 }),
  R(120, 330, 40, 250, C.blue, { rot: -24 }), P([[96, 560], [130, 600], [150, 540]], C.yellow),
  E(150, 160, 36, C.coral), E(210, 215, 30, C.lime), E(120, 235, 26, C.purple),
].join('')));

write('rules-dials.svg', svg(W, H, 'Rule controls', 'A control panel with three sliders, two dials and switches.', C.cyan, [
  P([[0, 90], [280, 0], [420, 0], [0, 200]], C.yellow), P([[1000, 560], [760, 620], [1000, 620]], C.coral),
  R(140, 90, 720, 440, C.cream, { rot: 2 }),
  [0, 1, 2].map((i) => `${R(210, 160 + i * 70, 380, 26, C.ink, { rx: 13, sw: 0, rot: 2 })}${E(280 + i * 110, 174 + i * 70 + 4, 28, [C.coral, C.lime, C.purple][i], { sw: 6 })}`).join(''),
  E(720, 230, 76, C.yellow), L(720, 230, 770, 190, { sw: 10 }), E(720, 230, 14, C.ink),
  E(720, 420, 56, C.lime), L(720, 420, 690, 455, { sw: 10 }), E(720, 420, 11, C.ink),
  R(220, 400, 140, 60, C.ink, { rx: 30, sw: 0 }), E(330, 430, 22, C.lime, { sw: 5 }), R(400, 400, 140, 60, C.ink, { rx: 30, sw: 0 }), E(430, 430, 22, C.coral, { sw: 5 }),
].join('')));

write('palette-wall.svg', svg(W, H, 'Palette wall', 'A wall of colour swatches, a palette board and a brush.', C.purple, [
  P([[0, 0], [300, 0], [0, 190]], C.yellow), P([[1000, 620], [700, 620], [1000, 410]], C.cyan),
  R(170, 90, 660, 440, C.cream, { rot: -2 }),
  ...[[C.yellow, C.cyan, C.coral], [C.lime, C.purple, C.blue], [C.ink, C.white, C.yellow]].flatMap((row, r) => row.map((c, i) => R(230 + i * 180, 140 + r * 120, 150, 90, c, { rot: -2 }))),
  PATH('M760 300 q70 -80 140 -10 q40 60 -20 100 q-70 40 -130 -20 z', C.cream), E(800, 330, 16, C.coral), E(850, 320, 16, C.lime), E(830, 370, 16, C.cyan),
  R(80, 420, 34, 190, C.yellow, { rot: -20 }), P([[40, 410], [78, 380], [100, 440]], C.coral),
].join('')));

write('preview-arena.svg', svg(W, H, 'Preview arena', 'A big screen with a play button, stage lights and a controller.', C.lime, [
  P([[0, 540], [240, 420], [330, 620], [0, 620]], C.purple), P([[640, 0], [1000, 0], [1000, 180]], C.coral),
  R(150, 70, 700, 380, C.ink, { rx: 22 }), R(180, 100, 640, 320, C.cyan, { rx: 10 }), P([[440, 190], [440, 330], [570, 260]], C.cream),
  R(110, 470, 780, 46, C.yellow, { rx: 10 }), ...[0, 1, 2, 3, 4].map((i) => E(180 + i * 160, 493, 14, [C.coral, C.cream, C.cyan, C.lime, C.purple][i], { sw: 4 })),
  R(780, 60, 80, 36, C.yellow, { rx: 8, rot: 18 }), R(130, 50, 80, 36, C.coral, { rx: 8, rot: -18 }),
  E(830, 560, 34, C.coral), L(830, 560, 830, 590, { sw: 12 }), R(780, 590, 100, 26, C.ink, { rx: 10, sw: 0 }),
].join('')));

write('room-ticket.svg', svg(W, H, 'Room ticket', 'A ticket with six empty code boxes and a punched edge.', C.coral, [
  P([[0, 0], [260, 0], [0, 180]], C.yellow), P([[1000, 620], [740, 620], [1000, 440]], C.purple),
  PATH('M130 150 h640 q50 0 50 50 v60 a40 40 0 0 0 0 80 v60 q0 50 -50 50 h-640 q-50 0 -50 -50 v-60 a40 40 0 0 0 0 -80 v-60 q0 -50 50 -50 z', C.cream),
  ...[0, 1, 2, 3, 4, 5].map((i) => R(170 + i * 100, 230, 80, 110, C.white, { rx: 10 })),
  R(170, 380, 340, 28, C.ink, { rx: 6, sw: 0 }), R(170, 430, 220, 22, C.cyan, { rx: 6, sw: 0 }),
  L(660, 140, 660, 540, { sw: 5, op: 0.5 }), P([[700, 330], [790, 330], [790, 300], [860, 360], [790, 420], [790, 390], [700, 390]], C.lime),
].join('')));

write('join-ticket.svg', svg(W, H, 'Join door', 'A lobby door with six code boxes above it and an arrow pointing in.', C.cyan, [
  P([[0, 0], [300, 0], [0, 220]], C.coral), P([[1000, 620], [680, 620], [1000, 400]], C.yellow),
  R(330, 110, 340, 420, C.cream), R(370, 150, 260, 340, C.purple), E(590, 330, 16, C.yellow),
  ...[0, 1, 2, 3, 4, 5].map((i) => R(190 + i * 100, 40, 78, 60, C.white, { rx: 8, sw: 5 })),
  P([[120, 320], [250, 320], [250, 280], [320, 350], [250, 420], [250, 380], [120, 380]], C.lime),
].join('')));

write('my-desk.svg', svg(W, H, 'Creator desk', 'A shelf of folders, a pencil cup and a stack of cards.', C.yellow, [
  P([[0, 620], [0, 430], [220, 620]], C.purple), P([[760, 0], [1000, 0], [1000, 200]], C.cyan),
  R(110, 120, 780, 340, C.cream), L(110, 290, 890, 290, { sw: 7 }),
  ...[0, 1, 2, 3, 4, 5].map((i) => R(150 + i * 120, 160, 96, 120, [C.cyan, C.coral, C.lime, C.purple, C.yellow, C.blue][i], { rot: i % 2 ? 2 : -2 })),
  ...[0, 1, 2, 3, 4].map((i) => R(160 + i * 140, 320, 110, 110, [C.lime, C.coral, C.cyan, C.yellow, C.purple][i], { rot: i % 2 ? -2 : 2 })),
  R(700, 480, 130, 110, C.blue), L(730, 480, 720, 420, { sw: 10 }), L(765, 480, 770, 410, { sw: 10, stroke: C.coral }), L(800, 480, 820, 425, { sw: 10, stroke: C.lime }),
].join('')));

write('login-key.svg', svg(W, H, 'Account key', 'A key beside a padlock and a small account card.', C.purple, [
  P([[0, 0], [280, 0], [0, 200]], C.yellow), P([[1000, 620], [700, 620], [1000, 420]], C.coral),
  R(540, 250, 250, 220, C.yellow), PATH('M600 250 v-50 a65 65 0 0 1 130 0 v50', 'none', { sw: 18 }), E(665, 350, 24, C.ink), R(655, 362, 20, 56, C.ink, { rx: 6, sw: 0 }),
  E(240, 330, 80, C.cyan), E(240, 330, 32, C.purple), R(300, 316, 220, 30, C.cyan, { rx: 6 }), R(430, 340, 28, 54, C.cyan, { rx: 4 }), R(480, 340, 28, 40, C.cyan, { rx: 4 }),
  R(150, 90, 280, 120, C.cream, { rot: -5 }), R(180, 125, 120, 14, C.ink, { rx: 4, sw: 0, rot: -5 }), R(180, 155, 190, 14, C.cyan, { rx: 4, sw: 0, rot: -5 }),
].join('')));

/* ── game mode cards (no characters: shapes and machines only) ── */
write('game-classic.svg', svg(W, H, 'Classic Quiz', 'A question card above four coloured answer tiles.', C.cyan, [
  P([[0, 620], [220, 440], [340, 620]], C.yellow), P([[700, 0], [1000, 0], [940, 240]], C.coral),
  R(150, 80, 700, 190, C.cream, { rot: -1.5 }), R(190, 120, 420, 26, C.ink, { rx: 6, sw: 0, rot: -1.5 }), R(190, 170, 560, 22, C.purple, { rx: 6, sw: 0, rot: -1.5 }), E(780, 150, 36, C.yellow),
  ...[0, 1, 2, 3].map((i) => R(150 + (i % 2) * 360, 320 + Math.floor(i / 2) * 120, 340, 96, [C.coral, C.lime, C.purple, C.yellow][i], { rot: i % 2 ? 1 : -1 })),
].join('')));

write('game-tower.svg', svg(W, H, 'Tower Defense', 'A stone tower beside a winding path with round and spiky shapes marching toward it.', C.lime, [
  P([[0, 0], [240, 0], [0, 160]], C.purple),
  PATH('M-20 470 C 200 470, 240 330, 420 330 S 640 520, 800 440 S 1000 330, 1040 330', 'none', { sw: 64, stroke: C.cream }),
  PATH('M-20 470 C 200 470, 240 330, 420 330 S 640 520, 800 440 S 1000 330, 1040 330', 'none', { sw: 10, stroke: C.ink }),
  R(780, 90, 150, 230, C.cyan), ...[0, 1, 2].map((i) => R(780 + i * 54, 60, 42, 44, C.yellow, { rx: 4, sw: 5 })), R(830, 230, 50, 90, C.ink, { rx: 22, sw: 0 }),
  R(350, 190, 90, 120, C.cyan), R(340, 170, 110, 30, C.yellow, { rx: 4 }), L(395, 190, 395, 140, { sw: 12 }), E(395, 130, 16, C.coral),
  E(120, 460, 34, C.coral), P([[240, 400], [270, 360], [300, 400], [330, 380], [300, 440], [260, 440]], C.purple),
  E(560, 470, 26, C.coral), P([[620, 520], [650, 480], [680, 520]], C.yellow),
  L(440, 150, 540, 90, { sw: 6, stroke: C.yellow }), E(550, 86, 10, C.yellow, { sw: 4 }),
].join('')));

write('game-obstacle.svg', svg(W, H, 'Obstacle Survival', 'A running lane with hurdles, spikes and a spinning saw ahead of a rounded runner shape.', C.coral, [
  P([[0, 0], [300, 0], [0, 180]], C.yellow),
  R(-20, 380, 1040, 200, C.ink, { rx: 0, sw: 0 }), L(-20, 380, 1040, 380, { sw: 8, stroke: C.cream }),
  ...[0, 1, 2, 3, 4, 5, 6].map((i) => R(i * 160, 470, 90, 12, C.cream, { rx: 4, sw: 0 })),
  R(120, 290, 80, 90, C.cyan, { rx: 30 }), L(160, 380, 160, 400, { sw: 6 }),
  R(330, 300, 36, 80, C.yellow, { rx: 6 }), R(310, 280, 76, 24, C.cream, { rx: 6 }),
  P([[480, 380], [510, 320], [540, 380], [570, 320], [600, 380]], C.lime),
  E(760, 300, 66, C.purple), E(760, 300, 22, C.cream), ...[0, 1, 2, 3, 4, 5].map((i) => P([[760 + Math.cos(i * 1.047) * 66, 300 + Math.sin(i * 1.047) * 66], [760 + Math.cos(i * 1.047 + 0.35) * 92, 300 + Math.sin(i * 1.047 + 0.35) * 92], [760 + Math.cos(i * 1.047 + 0.7) * 66, 300 + Math.sin(i * 1.047 + 0.7) * 66]], C.cream, { sw: 5 })),
  ...[0, 1, 2].map((i) => R(40 + i * 40, 120 + i * 36, 70, 14, C.cream, { rx: 7, sw: 0, op: 0.8 })),
].join('')));

write('game-clue.svg', svg(W, H, 'Clue Racing', 'A winding race track with checkpoints, a chequered flag, a magnifier and torn clue pieces.', C.purple, [
  P([[0, 620], [240, 450], [340, 620]], C.yellow), P([[740, 0], [1000, 0], [1000, 200]], C.cyan),
  PATH('M90 450 C 250 520, 380 330, 520 400 S 770 520, 900 280', 'none', { sw: 70, stroke: C.cream }),
  PATH('M90 450 C 250 520, 380 330, 520 400 S 770 520, 900 280', 'none', { sw: 8, stroke: C.ink }),
  ...[[220, 475], [380, 395], [560, 415], [760, 470]].map(([x, y], i) => E(x, y, 22, [C.coral, C.lime, C.yellow, C.cyan][i], { sw: 5 })),
  L(900, 280, 900, 130, { sw: 8 }), ...[0, 1, 2, 3].flatMap((r) => [0, 1, 2].map((c) => R(900 + c * 26, 130 + r * 22, 26, 22, (r + c) % 2 ? C.cream : C.ink, { rx: 0, sw: 3 }))),
  E(220, 200, 66, C.cyan), E(220, 200, 40, C.cream), L(268, 248, 330, 310, { sw: 18 }),
  PATH('M470 130 l120 -20 l20 70 l-100 40 z', C.cream), PATH('M620 150 l90 10 l-10 80 l-90 -20 z', C.yellow, { sw: 5 }),
].join('')));

/* ── theme swatches (a miniature play screen in each theme) ── */
const THEMES = {
  volt: { bg: '#0B1018', panel: '#17202B', a: C.yellow, b: C.cyan, t: '#F1F4F8' },
  coral: { bg: '#1a0e14', panel: '#2a1620', a: C.coral, b: C.lime, t: C.cream },
  violet: { bg: '#120c24', panel: '#1d1538', a: C.purple, b: C.coral, t: '#F4F0FF' },
  paper: { bg: '#FFF8EA', panel: '#FFFFFF', a: C.coral, b: C.cyan, t: C.ink },
  contrast: { bg: '#000000', panel: '#0a0a0a', a: '#FFEB3B', b: '#FFFFFF', t: '#FFFFFF' },
};
for (const [k, t] of Object.entries(THEMES)) {
  write(`theme-${k}.svg`, svg(500, 300, `Theme ${k}`, 'A miniature play screen showing the theme colours.', t.bg, [
    R(30, 30, 440, 80, t.panel, { sw: 5 }), R(54, 58, 280, 16, t.t, { rx: 6, sw: 0, op: 0.9 }),
    ...[0, 1, 2, 3].map((i) => R(30 + (i % 2) * 226, 130 + Math.floor(i / 2) * 76, 214, 62, i === 0 ? t.a : i === 3 ? t.b : t.panel, { sw: 5 })),
    E(430, 70, 14, t.a, { sw: 4 }),
  ].join(''), t.a));
}
console.log('creator art written');
