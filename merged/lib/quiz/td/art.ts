/** ORIGINAL vector art for Tower Defense — "ink-cut arcade illustration". Built only from basic geometry in this file (no traced or third-party
 *  artwork, no faces, no gradients, no scripts, no external references). The same functions write the shipped files in public/quiz/td/
 *  (tools/td-art/build.ts) and feed the canvas renderer, so the files and the game can never drift apart.
 *  Grammar: 3 px ink outline at 72 px, 2 flat fills + 1 accent per unit, a pad shadow, one signature shape per family. */
import type { TDBossId, TDEnemyKind, TDRole, TDTowerKind } from './domain';

export const INK = '#19283A';
export const PAL = { ink: INK, paper: '#FFF3DC', gold: '#FFC94B', green: '#55BD8C', grass: '#A7D9AF', coral: '#FC7462', blue: '#67BCD9', purple: '#A48EDD', panel: '#24394B', cream: '#FCE6BD', moss: '#7E9A63', teal: '#3FA7A0', amber: '#F2B45A', stone: '#B9C3CF', copper: '#D9824A', white: '#FFFFFF' } as const;
const svg = (w: number, h: number, body: string, title: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img"><title>${title}</title><g stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`;
const shadow = (cx: number, cy: number, rx: number, ry = rx * 0.32) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${INK}" opacity="0.22" stroke="none"/>`;
const base = (lv: number) => `${shadow(36, 63, 24)}<path d="M14 58 L18 50 H54 L58 58 Z" fill="${PAL.stone}"/>${lv >= 2 ? `<path d="M22 50 V46 H50 V50" fill="none"/>` : ''}${lv >= 3 ? `<circle cx="20" cy="55" r="1.6" fill="${INK}" stroke="none"/><circle cx="52" cy="55" r="1.6" fill="${INK}" stroke="none"/>` : ''}`;

// ── towers: 6 families × 3 levels × (idle, fire) ────────────────────────────────────────────────────────────────────────────────
function towerBody(kind: TDTowerKind, lv: 1 | 2 | 3, fire: boolean): string {
  const lift = fire ? -2 : 0;
  switch (kind) {
    case 'bolt': { // squat turret, angled roof, forward barrel, lightning plate
      const barrel = lv === 3 ? `<rect x="46" y="${27 + lift}" width="17" height="6" rx="2" fill="${PAL.panel}"/><rect x="46" y="${35 + lift}" width="17" height="6" rx="2" fill="${PAL.panel}"/>` : `<rect x="46" y="${30 + lift}" width="${lv === 2 ? 18 : 15}" height="8" rx="2" fill="${PAL.panel}"/>`;
      return `${base(lv)}${barrel}<path d="M18 50 V30 L26 20 H46 L52 30 V50 Z" fill="${PAL.gold}" transform="translate(0 ${lift})"/><path d="M33 26 L28 36 H35 L31 46 L41 33 H34 L38 26 Z" fill="${PAL.paper}" transform="translate(0 ${lift})"/>${lv >= 2 ? `<path d="M18 40 H13 V48 H18" fill="${PAL.gold}"/>` : ''}${lv >= 3 ? `<path d="M26 20 L30 12 H40 L46 20" fill="${PAL.panel}" transform="translate(0 ${lift})"/>` : ''}${fire ? `<path d="M64 30 L70 26 M64 36 L71 36 M64 42 L70 46" stroke="${PAL.gold}" stroke-width="3"/>` : ''}`;
    }
    case 'frost': { // slim prism lens on a tripod, abstract six-point mark
      const crown = lv === 3 ? `<path d="M30 12 L36 4 L42 12" fill="${PAL.white}"/>` : '';
      return `${base(lv)}<path d="M26 50 L32 38 M46 50 L40 38 M36 50 V40"/><path d="M36 ${10 + lift} L50 ${26 + lift} L36 ${42 + lift} L22 ${26 + lift} Z" fill="${PAL.blue}"/><path d="M36 ${18 + lift} V${34 + lift} M29 ${22 + lift} L43 ${30 + lift} M43 ${22 + lift} L29 ${30 + lift}" stroke="${PAL.white}" stroke-width="2.4"/>${lv >= 2 ? `<path d="M22 26 L15 22 V32 Z M50 26 L57 22 V32 Z" fill="${PAL.paper}"/>` : ''}${crown}${fire ? `<circle cx="36" cy="26" r="20" fill="none" stroke="${PAL.blue}" stroke-width="2" opacity="0.8"/>` : ''}`;
    }
    case 'ember': { // wide kiln (trapezoid), chimney, triangular hatch with a flame wedge
      const chim = `<rect x="44" y="${12 + lift}" width="8" height="14" fill="${PAL.panel}"/>${lv >= 2 ? `<rect x="20" y="${16 + lift}" width="7" height="10" fill="${PAL.panel}"/>` : ''}`;
      return `${base(lv)}${chim}<path d="M14 50 L20 26 H52 L58 50 Z" fill="${PAL.coral}"/><path d="M27 50 L36 ${fire ? 30 : 34} L45 50 Z" fill="${PAL.panel}"/><path d="M33 48 L36 40 L39 48 Z" fill="${PAL.gold}" stroke-width="2"/>${lv >= 3 ? `<path d="M14 36 H58" /><path d="M20 26 L24 20 H48 L52 26" fill="${PAL.coral}"/>` : ''}${fire ? `<path d="M33 30 L36 22 L39 30" fill="${PAL.gold}"/>` : ''}`;
    }
    case 'thorn': { // planter box with leaf spikes; level 3 grows a vine arch
      const leaves = [[26, 30], [36, 22], [46, 30]].slice(0, lv === 1 ? 3 : 3).map(([x, y]) => `<path d="M${x} 40 Q${x! - 8} ${y! + 6} ${x} ${y! + lift} Q${x! + 8} ${y! + 6} ${x} 40 Z" fill="${PAL.green}"/><path d="M${x} 39 V${y! + 6 + lift}" stroke-width="2"/>`).join('');
      const more = lv >= 2 ? `<path d="M18 42 Q12 34 16 28 Q22 34 22 42 Z" fill="${PAL.green}"/><path d="M54 42 Q60 34 56 28 Q50 34 50 42 Z" fill="${PAL.green}"/>` : '';
      return `${base(lv)}${more}${leaves}${lv >= 3 ? `<path d="M18 30 Q36 4 54 30" fill="none" stroke="${PAL.green}" stroke-width="4"/><path d="M18 30 Q36 4 54 30" fill="none" stroke-width="1.5"/>` : ''}<path d="M16 40 H56 L52 52 H20 Z" fill="${PAL.moss}"/><path d="M22 46 H50" stroke-width="2"/>${fire ? `<circle cx="58" cy="20" r="3" fill="${PAL.green}"/>` : ''}`;
    }
    case 'arc': { // mast with stacked rings and two prongs; level 3 orb
      const rings = Array.from({ length: lv + 1 }, (_, i) => `<ellipse cx="36" cy="${44 - i * 8 + lift}" rx="${14 - i * 1.5}" ry="4" fill="${PAL.purple}"/>`).join('');
      return `${base(lv)}<rect x="32" y="${14 + lift}" width="8" height="36" fill="${PAL.panel}"/>${rings}<path d="M28 ${16 + lift} L24 ${6 + lift} M44 ${16 + lift} L48 ${6 + lift}" stroke-width="3"/>${lv >= 3 ? `<circle cx="36" cy="${10 + lift}" r="6" fill="${PAL.paper}"/>` : ''}${fire ? `<path d="M48 6 L56 12 L52 16 L62 22" fill="none" stroke="${PAL.purple}" stroke-width="3"/>` : ''}`;
    }
    case 'beacon': { // lantern with honey window and pointed cap; level 3 halo
      return `${base(lv)}${lv >= 3 ? `<circle cx="36" cy="26" r="24" fill="none" stroke="${PAL.gold}" stroke-width="2.5" opacity="0.9"/>` : ''}<path d="M24 50 V24 H48 V50 Z" fill="${PAL.cream}"/><rect x="30" y="${28 + lift}" width="12" height="14" fill="${PAL.gold}"/><path d="M22 24 L36 ${10 + lift} L50 24 Z" fill="${PAL.panel}"/>${lv >= 2 ? `<rect x="14" y="32" width="8" height="10" fill="${PAL.gold}"/><rect x="50" y="32" width="8" height="10" fill="${PAL.gold}"/>` : ''}${fire ? `<circle cx="36" cy="35" r="11" fill="none" stroke="${PAL.gold}" stroke-width="2"/>` : ''}`;
    }
  }
}
export const towerSVG = (kind: TDTowerKind, lv: 1 | 2 | 3, fire = false) => svg(72, 72, towerBody(kind, lv, fire), `${kind} tower level ${lv}`);

// ── enemies: 8 families × (idle, move, hit) — abstract panels and stripes, never eyes or mouths ─────────────────────────────────────
function enemyBody(kind: TDEnemyKind, pose: 'idle' | 'move' | 'hit'): string {
  const tilt = pose === 'move' ? ' transform="rotate(6 24 26)"' : '';
  const flash = pose === 'hit' ? PAL.white : null;
  const f = (c: string) => flash ?? c;
  switch (kind) {
    case 'drifter': return `${shadow(24, 42, 14)}<g${tilt}><circle cx="24" cy="24" r="15" fill="${f(PAL.coral)}"/><path d="M14 13 L34 35" stroke-width="5" stroke="${f(PAL.paper)}"/><path d="M14 13 L34 35" stroke-width="1.5"/></g>`;
    case 'zipper': return `${shadow(24, 42, 13)}<g${tilt}><path d="M8 34 L24 8 L40 34 Z" fill="${f(PAL.purple)}"/><path d="M18 26 H30"/><path d="M4 18 H10 M2 26 H8" stroke-width="2.5"/></g>`;
    case 'bulwark': return `${shadow(24, 44, 17)}<g${tilt}><rect x="7" y="8" width="34" height="32" rx="3" fill="${f(PAL.moss)}"/><path d="M7 20 H41 M7 30 H41 M24 8 V40" stroke-width="2.4"/><rect x="18" y="14" width="12" height="4" fill="${INK}" stroke="none"/></g>`;
    case 'skimmer': return `${shadow(24, 44, 10, 2.5)}<g${tilt}><path d="M4 26 L16 14 L24 22 L32 14 L44 26 L24 32 Z" fill="${f(PAL.blue)}"/><path d="M24 22 V32"/></g>`;
    case 'warden': return `${shadow(24, 44, 14)}<g${tilt}><path d="M24 6 L40 24 L24 42 L8 24 Z" fill="${f(PAL.stone)}"/><path d="M28 14 H40 V30 L34 36 L28 30 Z" fill="${f(PAL.paper)}"/><path d="M14 24 H22"/></g>`;
    case 'splitter': return `${shadow(24, 42, 16)}<g${tilt}><circle cx="16" cy="25" r="11" fill="${f(PAL.amber)}"/><circle cx="32" cy="25" r="11" fill="${f(PAL.amber)}"/><path d="M24 15 V35" stroke-dasharray="3 3"/></g>`;
    case 'sapper': return `${shadow(24, 43, 13)}<g${tilt}><path d="M24 4 L38 30 L24 40 L10 30 Z" fill="${f(PAL.teal)}"/><path d="M24 4 L24 18 L32 28" fill="none"/><path d="M16 30 L24 40" stroke-width="2"/></g>`;
    case 'colossus': return `${shadow(24, 44, 18)}<rect x="6" y="6" width="36" height="36" rx="4" fill="${f(PAL.copper)}"/><path d="M6 18 H42 M6 30 H42"/>`;
  }
}
export const enemySVG = (kind: TDEnemyKind, pose: 'idle' | 'move' | 'hit' = 'idle') => svg(48, 48, enemyBody(kind, pose), `${kind} ${pose}`);

// ── bosses: three different silhouettes (96 px), plus a phase-3 pose each ───────────────────────────────────────────────────────
function bossBody(id: TDBossId, phase3: boolean): string {
  switch (id) {
    case 'copper_colossus': return `${shadow(48, 88, 36)}<rect x="12" y="20" width="72" height="62" rx="6" fill="${PAL.copper}"/><path d="M12 40 H84 M12 60 H84 M36 20 V82 M60 20 V82" stroke-width="2.5"/><rect x="6" y="14" width="18" height="18" fill="${PAL.panel}"/><rect x="72" y="14" width="18" height="18" fill="${PAL.panel}"/><rect x="6" y="70" width="18" height="18" fill="${PAL.panel}"/><rect x="72" y="70" width="18" height="18" fill="${PAL.panel}"/><path d="M38 46 H58 V54 H38 Z" fill="${phase3 ? PAL.gold : PAL.paper}"/>`;
    case 'quarry_crawler': return `${shadow(48, 86, 40)}${[18, 38, 58].map((x, i) => `<rect x="${x}" y="${40 - i * 2}" width="22" height="${36 + i * 2}" rx="6" fill="${i % 2 ? PAL.cream : '#E6B79A'}"/>`).join('')}<path d="M80 44 L94 56 L80 68 Z" fill="${PAL.stone}"/><path d="M84 52 H90 M84 60 H90" stroke-width="2"/><path d="M18 50 H78 M18 64 H78" stroke-width="2.2"/>${phase3 ? `<path d="M10 36 L4 30 M10 80 L4 86" stroke="${PAL.coral}" stroke-width="4"/>` : ''}`;
    case 'skywork_leviathan': return `${shadow(48, 90, 30, 6)}<path d="M8 50 Q30 18 68 30 Q90 38 92 50 Q90 62 68 70 Q30 82 8 50 Z" fill="${PAL.blue}"/><path d="M20 40 L10 24 L34 34 Z M20 60 L10 76 L34 66 Z" fill="${PAL.paper}"/><circle cx="66" cy="50" r="10" fill="${PAL.panel}"/><path d="M66 40 V60 M56 50 H76" stroke="${PAL.gold}" stroke-width="3"/><path d="M30 50 H52" stroke-width="2.4"/>${phase3 ? `<path d="M40 24 L46 16 L52 24" fill="${PAL.gold}"/>` : ''}`;
  }
}
export const bossSVG = (id: TDBossId, phase3 = false) => svg(96, 96, bossBody(id, phase3), `${id}${phase3 ? ' final phase' : ''}`);

// ── role emblems (64 px): five original symbols, no portraits ────────────────────────────────────────────────────────────────
const ROLE_BODY: Record<TDRole, string> = {
  architect: `<rect x="8" y="8" width="48" height="48" rx="5" fill="${PAL.green}"/><path d="M18 46 L32 16 L46 46" fill="none" stroke-width="3.5"/><path d="M24 36 H40" stroke-width="3"/><circle cx="32" cy="16" r="4" fill="${PAL.paper}"/>`,
  tactician: `<rect x="8" y="8" width="48" height="48" rx="5" fill="${PAL.blue}"/><circle cx="32" cy="32" r="14" fill="${PAL.paper}"/><path d="M32 12 V22 M32 42 V52 M12 32 H22 M42 32 H52" stroke-width="3"/><circle cx="32" cy="32" r="4" fill="${INK}" stroke="none"/>`,
  artillerist: `<rect x="8" y="8" width="48" height="48" rx="5" fill="${PAL.coral}"/><path d="M14 46 Q32 6 50 40" fill="none" stroke-width="3" stroke-dasharray="4 4"/><circle cx="50" cy="42" r="6" fill="${PAL.gold}"/><rect x="12" y="44" width="12" height="8" fill="${PAL.panel}"/>`,
  alchemist: `<rect x="8" y="8" width="48" height="48" rx="5" fill="${PAL.purple}"/><path d="M26 14 H38 M28 14 V26 L18 46 H46 L36 26 V14" fill="${PAL.paper}"/><path d="M22 38 H42 L46 46 H18 Z" fill="${PAL.green}"/>`,
  warden: `<rect x="8" y="8" width="48" height="48" rx="5" fill="${PAL.gold}"/><path d="M32 12 L48 18 V32 Q48 46 32 52 Q16 46 16 32 V18 Z" fill="${PAL.paper}"/><path d="M32 24 L38 32 L32 40 L26 32 Z" fill="${PAL.coral}"/>`,
};
export const roleSVG = (r: TDRole) => svg(64, 64, ROLE_BODY[r], `${r} emblem`);

// ── question-kind symbols (40 px) ────────────────────────────────────────────────────────────────────────────────────────────
const KIND_BODY: Record<string, string> = {
  multiple_choice: `<rect x="6" y="6" width="12" height="12" fill="${PAL.gold}"/><rect x="22" y="6" width="12" height="12" fill="${PAL.paper}"/><rect x="6" y="22" width="12" height="12" fill="${PAL.paper}"/><rect x="22" y="22" width="12" height="12" fill="${PAL.paper}"/>`,
  answer_forge: `<rect x="4" y="12" width="32" height="16" rx="2" fill="${PAL.paper}"/><path d="M10 20 H22"/><path d="M28 15 V25" stroke="${PAL.coral}"/>`,
  connection_rush: `<circle cx="9" cy="12" r="5" fill="${PAL.blue}"/><circle cx="31" cy="28" r="5" fill="${PAL.green}"/><path d="M14 13 Q22 14 26 27"/>`,
  truth_hunt: `<rect x="4" y="8" width="15" height="24" fill="${PAL.green}"/><rect x="21" y="8" width="15" height="24" fill="${PAL.coral}"/><path d="M8 20 L11 24 L16 15 M25 15 L32 25 M32 15 L25 25" stroke-width="2.5"/>`,
  fill_table: `<rect x="4" y="6" width="32" height="28" fill="${PAL.paper}"/><path d="M4 15 H36 M4 24 H36 M15 6 V34 M26 6 V34" stroke-width="2"/><rect x="17" y="17" width="7" height="5" fill="${PAL.gold}" stroke="none"/>`,
};
export const kindSVG = (k: string) => svg(40, 40, KIND_BODY[k] ?? KIND_BODY.multiple_choice!, `${k} question`);

// ── board props (48 px) ─────────────────────────────────────────────────────────────────────────────────────────────────────
const PROP: Record<string, (p: { prop: string; propInk: string }) => string> = {
  leaf: (c) => `<path d="M8 40 Q8 12 40 8 Q36 40 8 40 Z" fill="${c.prop}"/><path d="M10 38 L32 16" stroke="${c.propInk}" stroke-width="2"/>`,
  bush: (c) => `<circle cx="16" cy="28" r="10" fill="${c.prop}"/><circle cx="30" cy="24" r="12" fill="${c.prop}"/><circle cx="36" cy="32" r="8" fill="${c.prop}"/>`,
  pond: () => `<ellipse cx="24" cy="26" rx="20" ry="12" fill="${PAL.blue}"/><path d="M14 24 Q18 21 22 24 M26 29 Q30 26 34 29" stroke="${PAL.white}" stroke-width="2"/>`,
  stone: () => `<path d="M8 38 L12 20 L26 12 L40 22 L38 38 Z" fill="${PAL.stone}"/><path d="M18 26 L26 22" stroke-width="2"/>`,
  rock: () => `<path d="M4 40 L10 16 L24 8 L42 18 L44 40 Z" fill="#C9A48C"/><path d="M14 30 L24 22 L30 30" fill="none" stroke-width="2"/>`,
  bridge: () => `<rect x="4" y="16" width="40" height="16" fill="${PAL.cream}"/><path d="M12 16 V32 M20 16 V32 M28 16 V32 M36 16 V32" stroke-width="2"/>`,
  flag: () => `<path d="M14 42 V8"/><path d="M14 8 L38 14 L14 22 Z" fill="${PAL.coral}"/>`,
  crate: () => `<rect x="8" y="12" width="32" height="28" fill="${PAL.amber}"/><path d="M8 12 L40 40 M40 12 L8 40" stroke-width="2"/>`,
  cart: () => `<path d="M6 18 H42 L38 32 H10 Z" fill="${PAL.stone}"/><circle cx="16" cy="36" r="5" fill="${PAL.panel}"/><circle cx="32" cy="36" r="5" fill="${PAL.panel}"/>`,
  gear: () => `<circle cx="24" cy="24" r="14" fill="${PAL.stone}" stroke-dasharray="6 3" stroke-width="6"/><circle cx="24" cy="24" r="12" fill="${PAL.stone}"/><circle cx="24" cy="24" r="5" fill="${PAL.panel}"/>`,
  pipe: () => `<path d="M6 32 H26 V10 H42" fill="none" stroke-width="10"/><path d="M6 32 H26 V10 H42" fill="none" stroke="${PAL.stone}" stroke-width="5"/>`,
  cloud: () => `<path d="M8 34 Q6 22 18 22 Q20 10 32 14 Q44 14 42 26 Q48 34 38 36 H12 Q6 36 8 34 Z" fill="${PAL.white}"/>`,
};
export const propSVG = (kind: string, palette: { prop: string; propInk: string }) => svg(48, 48, (PROP[kind] ?? PROP.stone!)(palette), kind);
export const PROP_KINDS = Object.keys(PROP);

/** The core at the end of the lane and the spawn gate at its start (64 px). */
export const coreSVG = () => svg(64, 64, `${shadow(32, 56, 22)}<path d="M12 52 L18 24 H46 L52 52 Z" fill="${PAL.panel}"/><path d="M32 8 L44 24 L32 40 L20 24 Z" fill="${PAL.gold}"/><path d="M32 16 L38 24 L32 32 L26 24 Z" fill="${PAL.paper}"/>`, 'core');
export const spawnSVG = () => svg(64, 64, `${shadow(32, 56, 20)}<path d="M14 54 V22 Q32 4 50 22 V54" fill="${PAL.panel}"/><path d="M22 54 V28 Q32 18 42 28 V54" fill="${PAL.ink}"/><path d="M8 54 H56"/>`, 'spawn gate');

/** Small lifecycle icons for the HUD (24 px): wave, core, points, timer — the only icons, always beside a text label. */
export const ICON = {
  wave: `<path d="M3 15 Q7 9 11 15 T19 15" fill="none"/><path d="M3 9 Q7 3 11 9 T19 9" fill="none" opacity="0.5"/>`,
  core: `<path d="M12 3 L19 12 L12 21 L5 12 Z" fill="${PAL.gold}"/>`,
  points: `<circle cx="12" cy="12" r="8" fill="${PAL.gold}"/><path d="M12 7 V17 M8 11 H16" stroke-width="2"/>`,
  timer: `<circle cx="12" cy="13" r="8" fill="${PAL.paper}"/><path d="M12 13 V8 M10 3 H14" stroke-width="2"/>`,
};
export const iconSVG = (k: keyof typeof ICON) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><g stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">${ICON[k]}</g></svg>`;
