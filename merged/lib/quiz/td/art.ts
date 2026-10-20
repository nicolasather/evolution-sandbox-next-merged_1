/** ORIGINAL vector art for Tower Defense — "storybook toybox" (2026-10-20 redesign).
 *  Built only from basic geometry in this file (no traced or third-party artwork, no faces, no gradients, no scripts, no external references).
 *  The same functions write the shipped files in public/quiz/td/ (tools/td-art/build.ts) and feed the canvas renderer, so the files and the game
 *  can never drift apart.
 *  Grammar: 3 px ink outline at 72 px, bright flat fills, a darker flat underside + a white highlight blob on every body (toy plastic, not paper),
 *  a coloured pedestal per tower family, one signature silhouette per family that grows (not just decorates) from level 1 → 3. */
import type { TDBossId, TDEnemyKind, TDRole, TDTowerKind } from './domain';

export const INK = '#19283A';
export const PAL = {
  ink: INK, paper: '#FFF3DC', gold: '#FFC94B', green: '#55BD8C', grass: '#A7D9AF', coral: '#FC7462', blue: '#67BCD9', purple: '#A48EDD', panel: '#24394B',
  cream: '#FCE6BD', moss: '#7E9A63', teal: '#3FA7A0', amber: '#F2B45A', stone: '#B9C3CF', copper: '#D9824A', white: '#FFFFFF',
  // storybook-toybox additions
  sun: '#FFD84A', candy: '#FF8FB1', berry: '#8E5AD6', leaf: '#3FBF6F', sky: '#6EC6F5', wood: '#C98B4A', woodDark: '#8A5A2B', snow: '#EAF7FF', ice: '#9FE3FF', flame: '#FF7A3D', mint: '#7FE0B0',
} as const;
const svg = (w: number, h: number, body: string, title: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img"><title>${title}</title><g stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`;
const shadow = (cx: number, cy: number, rx: number, ry = rx * 0.32) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${INK}" opacity="0.22" stroke="none"/>`;
/** white highlight blob: the "toy plastic" read */
const hl = (cx: number, cy: number, rx: number, ry = rx * 0.55, rot = -25) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#fff" opacity="0.5" stroke="none" transform="rotate(${rot} ${cx} ${cy})"/>`;
/** darker flat underside laid over a body shape */
const under = (d: string) => `<path d="${d}" fill="#000" opacity="0.14" stroke="none"/>`;
const star = (cx: number, cy: number, r: number, fill: string, sw = 2) => {
  const pts = Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 5; const rr = i % 2 ? r * 0.45 : r; return `${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`; });
  return `<path d="M${pts.join(' L')} Z" fill="${fill}" stroke-width="${sw}"/>`;
};

// ── towers: 6 families × 3 levels × (idle, fire) ────────────────────────────────────────────────────────────────────────────────
const FAMILY_COLOR: Record<TDTowerKind, string> = { bolt: PAL.sun, frost: PAL.ice, ember: PAL.flame, thorn: PAL.candy, arc: PAL.berry, beacon: PAL.amber };
/** Pedestal. L1 plain stone, L2 studded, L3 gold-rimmed with a banner post: the foundation itself shows the level before you read the badge. */
const base = (kind: TDTowerKind, lv: number) => {
  const c = FAMILY_COLOR[kind];
  return `${shadow(36, 64, lv === 3 ? 28 : 25)}<rect x="${lv === 3 ? 8 : 11}" y="50" width="${lv === 3 ? 56 : 50}" height="13" rx="6.5" fill="${PAL.stone}"/>${under(`M${lv === 3 ? 8 : 11} 57 H${lv === 3 ? 64 : 61} V${lv === 3 ? 56.5 : 56.5} a6.5 6.5 0 0 1 -6.5 6.5 H${(lv === 3 ? 8 : 11) + 6.5} a6.5 6.5 0 0 1 -6.5 -6.5 Z`)}<rect x="${lv === 3 ? 12 : 15}" y="54.5" width="${lv === 3 ? 48 : 42}" height="3.5" rx="1.75" fill="${c}" stroke="none"/>${lv >= 2 ? [18, 28, 44, 54].map((x) => `<circle cx="${x}" cy="52.4" r="1.4" fill="${INK}" stroke="none"/>`).join('') : ''}${lv >= 3 ? `<path d="M8 57 V45" /><path d="M8 45 L18 48 L8 52 Z" fill="${PAL.coral}" stroke-width="2"/><path d="M64 57 V45" /><path d="M64 45 L54 48 L64 52 Z" fill="${PAL.coral}" stroke-width="2"/>` : ''}`;
};
function towerBody(kind: TDTowerKind, lv: 1 | 2 | 3, fire: boolean): string {
  const j = fire ? -2 : 0; // a firing tower pops up 2 px
  switch (kind) {
    case 'bolt': { // chunky turret: round yellow drum, lightning plate, red-tipped barrels; L2 side gear + second barrel, L3 twin barrels + spark mast
      const barrels = lv === 3
        ? `<rect x="46" y="${22 + j}" width="19" height="7" rx="3.5" fill="${PAL.panel}"/><rect x="46" y="${34 + j}" width="19" height="7" rx="3.5" fill="${PAL.panel}"/><circle cx="65" cy="${25.5 + j}" r="3.4" fill="${PAL.coral}"/><circle cx="65" cy="${37.5 + j}" r="3.4" fill="${PAL.coral}"/>`
        : lv === 2
          ? `<rect x="46" y="${27 + j}" width="19" height="8" rx="4" fill="${PAL.panel}"/><rect x="46" y="${37 + j}" width="14" height="6" rx="3" fill="${PAL.panel}"/><circle cx="65" cy="${31 + j}" r="3.6" fill="${PAL.coral}"/>`
          : `<rect x="46" y="${30 + j}" width="16" height="8" rx="4" fill="${PAL.panel}"/><circle cx="62" cy="${34 + j}" r="3.6" fill="${PAL.coral}"/>`;
      const gear = lv >= 2 ? `<circle cx="17" cy="${42 + j}" r="7" fill="${PAL.stone}" stroke-dasharray="3 2.6"/><circle cx="17" cy="${42 + j}" r="3" fill="${PAL.panel}"/>` : '';
      const mast = lv === 3 ? `<path d="M35 ${14 + j} V6"/><circle cx="35" cy="${5 + j}" r="4" fill="${PAL.paper}"/><path d="M28 ${8 + j} L24 ${4 + j} M42 ${8 + j} L46 ${4 + j}" stroke="${PAL.sun}" stroke-width="2.5"/>` : '';
      return `${base(kind, lv)}${gear}${barrels}<g transform="translate(0 ${j})"><rect x="19" y="20" width="31" height="33" rx="11" fill="${PAL.sun}"/>${under('M19 40 H50 V42 a11 11 0 0 1 -11 11 H30 a11 11 0 0 1 -11 -11 Z')}<path d="M19 30 H50" stroke-width="2.4"/>${hl(29, 26, 6, 3)}<path d="M37 31 L29 43 H35 L32 52 L43 38 H37 L41 31 Z" fill="${PAL.paper}" stroke-width="2.4"/></g>${mast}${fire ? `${star(70, 34 + j, 6, PAL.sun)}<path d="M66 24 L71 20 M66 44 L71 48" stroke="${PAL.sun}" stroke-width="3"/>` : ''}`;
    }
    case 'frost': { // ice-crystal spire in a snow cap; L2 flanking crystals + snowflake plate, L3 crown crystal, floating shards, sparkle ring
      const main = lv === 3 ? 'M36 -2 L48 18 L43 46 H29 L24 18 Z' : lv === 2 ? 'M36 6 L47 24 L42 46 H30 L25 24 Z' : 'M36 12 L45 27 L41 46 H31 L27 27 Z';
      const side = lv >= 2 ? `<path d="M22 46 L15 28 L24 36 L26 46 Z" fill="${PAL.sky}"/><path d="M50 46 L57 28 L48 36 L46 46 Z" fill="${PAL.sky}"/>` : `<path d="M24 46 L20 36 L27 41 L28 46 Z" fill="${PAL.sky}"/><path d="M48 46 L52 36 L45 41 L44 46 Z" fill="${PAL.sky}"/>`;
      const shards = lv === 3 ? `<path d="M10 14 L14 8 L18 14 L14 20 Z M54 10 L58 4 L62 10 L58 16 Z" fill="${PAL.snow}" stroke-width="2"/>` : '';
      return `${base(kind, lv)}<ellipse cx="36" cy="47" rx="19" ry="5.5" fill="${PAL.snow}"/>${side}<g transform="translate(0 ${j})"><path d="${main}" fill="${PAL.ice}"/>${under('M36 14 L45 27 L41 46 H36 Z')}<path d="M36 ${lv === 3 ? 2 : 14} V44" stroke="${PAL.white}" stroke-width="2.2"/>${hl(31, 26, 3, 8, 8)}${lv >= 2 ? `<path d="M30 30 H42 M32 37 H40" stroke="${PAL.white}" stroke-width="2"/>` : ''}</g>${shards}${lv === 3 ? star(36, 3, 4.5, PAL.white) : ''}${fire ? `<circle cx="36" cy="28" r="22" fill="none" stroke="${PAL.ice}" stroke-width="3" opacity="0.9"/><circle cx="36" cy="28" r="28" fill="none" stroke="${PAL.white}" stroke-width="1.8" opacity="0.7"/>` : ''}`;
    }
    case 'ember': { // fat kiln pot with chimney puffs; L2 second chimney + gold rim, L3 horned crown + big flame
      const rim = lv >= 2 ? PAL.sun : PAL.panel;
      return `${base(kind, lv)}<rect x="45" y="${10 + j}" width="9" height="${lv === 3 ? 20 : 17}" rx="2" fill="${PAL.panel}"/>${lv >= 2 ? `<rect x="19" y="${14 + j}" width="8" height="16" rx="2" fill="${PAL.panel}"/><circle cx="23" cy="${9 + j}" r="4" fill="${PAL.paper}" opacity="0.9"/>` : ''}<circle cx="50" cy="${5 + j}" r="${fire ? 5 : 4}" fill="${PAL.paper}" opacity="0.9"/><g transform="translate(0 ${j})"><path d="M13 52 Q9 28 28 27 H44 Q63 28 59 52 Z" fill="${PAL.flame}"/>${under('M13 52 Q11 40 14 36 H58 Q61 40 59 52 Z')}${hl(24, 35, 7, 3.4)}<rect x="19" y="23" width="34" height="8" rx="4" fill="${rim}"/><path d="M26 52 Q26 38 36 36 Q46 38 46 52 Z" fill="${PAL.panel}"/><path d="M31 51 Q31 42 36 40 Q41 42 41 51 Z" fill="${PAL.sun}" stroke-width="2"/><path d="M34 51 Q34 46 36 44 Q38 46 38 51 Z" fill="${PAL.paper}" stroke-width="1.5"/>${lv === 3 ? `<path d="M19 23 L15 12 L26 20 Z M53 23 L57 12 L46 20 Z" fill="${PAL.coral}"/><path d="M30 23 Q36 8 42 23 Z" fill="${PAL.sun}"/><path d="M33 23 Q36 14 39 23 Z" fill="${PAL.paper}" stroke-width="1.5"/>` : ''}</g>${fire ? `<path d="M31 24 Q36 6 41 24 Z" fill="${PAL.sun}"/><path d="M34 24 Q36 14 38 24 Z" fill="${PAL.paper}" stroke-width="1.6"/><circle cx="23" cy="20" r="2.4" fill="${PAL.sun}" stroke="none"/><circle cx="50" cy="19" r="2.4" fill="${PAL.sun}" stroke="none"/>` : ''}`;
    }
    case 'thorn': { // pink bud in a clay pot with leaf spikes; L2 two side buds, L3 giant bloom + vine arch
      const bloom = lv === 3 ? 14 : 10;
      const petals = Array.from({ length: 6 }, (_, i) => { const a = (i * Math.PI) / 3 - Math.PI / 2; return `<circle cx="${(36 + Math.cos(a) * bloom * 0.95).toFixed(1)}" cy="${(24 + j + Math.sin(a) * bloom * 0.95).toFixed(1)}" r="${(bloom * 0.62).toFixed(1)}" fill="${PAL.candy}"/>`; }).join('');
      const nSp = lv === 1 ? 5 : 7; const spikes = Array.from({ length: nSp }, (_, i) => { const a = Math.PI + (i * Math.PI) / (nSp - 1); const x = 36 + Math.cos(a) * 21, y = 40 + Math.sin(a) * 14; return `<path d="M${(x - 3).toFixed(1)} ${(y + 4).toFixed(1)} L${x.toFixed(1)} ${(y - 5).toFixed(1)} L${(x + 3).toFixed(1)} ${(y + 4).toFixed(1)} Z" fill="${PAL.leaf}" stroke-width="2"/>`; }).join('');
      const side = lv >= 2 ? `<path d="M22 44 Q14 36 16 26" fill="none" stroke="${PAL.leaf}" stroke-width="4"/><circle cx="16" cy="24" r="6" fill="${PAL.candy}"/><circle cx="16" cy="24" r="2.4" fill="${PAL.sun}" stroke="none"/><path d="M50 44 Q58 36 56 26" fill="none" stroke="${PAL.leaf}" stroke-width="4"/><circle cx="56" cy="24" r="6" fill="${PAL.candy}"/><circle cx="56" cy="24" r="2.4" fill="${PAL.sun}" stroke="none"/>` : '';
      const arch = lv === 3 ? `<path d="M14 44 Q10 6 36 4 Q62 6 58 44" fill="none" stroke="${PAL.leaf}" stroke-width="4.5"/><circle cx="14" cy="30" r="2.8" fill="${PAL.sun}"/><circle cx="58" cy="30" r="2.8" fill="${PAL.sun}"/>` : '';
      return `${base(kind, lv)}${arch}${side}<path d="M36 44 V30" stroke="${PAL.leaf}" stroke-width="5"/>${spikes}<g>${petals}<circle cx="36" cy="${24 + j}" r="${bloom * 0.5}" fill="${PAL.sun}"/>${hl(33, 21 + j, 3, 1.6)}</g><path d="M17 41 H55 L51 56 H21 Z" fill="${PAL.copper}"/>${under('M18 49 H54 L51 56 H21 Z')}<rect x="15" y="37" width="42" height="7" rx="3.5" fill="${PAL.amber}"/>${hl(27, 40.5, 6, 1.6, 0)}${fire ? `<circle cx="62" cy="14" r="3.6" fill="${PAL.leaf}"/><circle cx="68" cy="22" r="2.8" fill="${PAL.leaf}"/>` : ''}`;
    }
    case 'arc': { // tesla coil: stacked purple discs on a post, glowing orb; L2 side mini-coils + more discs, L3 orbit ring + big orb
      const discs = Array.from({ length: lv + 2 }, (_, i) => `<ellipse cx="36" cy="${45 - i * 7 + j}" rx="${15 - i * 1.6}" ry="4.6" fill="${PAL.berry}"/><ellipse cx="36" cy="${43.6 - i * 7 + j}" rx="${12 - i * 1.4}" ry="2" fill="#fff" opacity="0.28" stroke="none"/>`).join('');
      const top = lv === 3 ? 5 : 8;
      const minis = lv >= 2 ? `<rect x="14" y="${34 + j}" width="5" height="14" rx="2" fill="${PAL.panel}"/><circle cx="16.5" cy="${32 + j}" r="4" fill="${PAL.purple}"/><rect x="53" y="${34 + j}" width="5" height="14" rx="2" fill="${PAL.panel}"/><circle cx="55.5" cy="${32 + j}" r="4" fill="${PAL.purple}"/>` : '';
      return `${base(kind, lv)}${minis}<rect x="32" y="${14 + j}" width="8" height="36" rx="3" fill="${PAL.panel}"/>${discs}<path d="M28 ${14 + j} L23 ${6 + j} M44 ${14 + j} L49 ${6 + j}" stroke-width="3"/>${lv === 3 ? `<ellipse cx="36" cy="${top + 6 + j}" rx="17" ry="5.5" fill="none" stroke="${PAL.sun}" stroke-width="2.4" transform="rotate(-14 36 ${top + 6 + j})"/>` : ''}<circle cx="36" cy="${top + j}" r="${lv === 3 ? 8 : 6.5}" fill="${fire ? PAL.white : PAL.sun}"/>${hl(34, top - 2 + j, 2.6, 1.6)}${fire ? `<path d="M46 6 L56 12 L50 17 L64 24" fill="none" stroke="${PAL.sun}" stroke-width="3.4"/><path d="M26 6 L16 12 L22 17 L10 22" fill="none" stroke="${PAL.sun}" stroke-width="3.4"/>` : ''}`;
    }
    case 'beacon': { // lighthouse lantern: striped tower, warm window, cap with star; L2 side lanterns, L3 halo + banner flags
      return `${base(kind, lv)}${lv >= 3 ? `<circle cx="36" cy="26" r="26" fill="${PAL.sun}" opacity="0.2" stroke="none"/><circle cx="36" cy="26" r="26" fill="none" stroke="${PAL.sun}" stroke-width="2.6" stroke-dasharray="5 4"/>` : ''}${lv >= 2 ? `<path d="M24 34 H13" /><rect x="6" y="${34 + j}" width="9" height="14" rx="4" fill="${PAL.cream}"/><rect x="8.5" y="${37 + j}" width="4" height="8" rx="2" fill="${PAL.sun}" stroke-width="1.8"/><path d="M48 34 H59"/><rect x="57" y="${34 + j}" width="9" height="14" rx="4" fill="${PAL.cream}"/><rect x="59.5" y="${37 + j}" width="4" height="8" rx="2" fill="${PAL.sun}" stroke-width="1.8"/>` : ''}<g transform="translate(0 ${j})"><path d="M24 52 L27 22 H45 L48 52 Z" fill="${PAL.cream}"/>${under('M36 22 H45 L48 52 H36 Z')}<path d="M25.4 36 H46.6 M24.7 44 H47.3" stroke="${PAL.coral}" stroke-width="4"/><rect x="30" y="26" width="12" height="13" rx="5" fill="${fire ? PAL.white : PAL.sun}"/>${hl(33, 29, 2.2, 3, 10)}<path d="M21 23 L36 ${lv === 3 ? 4 : 9} L51 23 Z" fill="${PAL.panel}"/>${lv >= 2 ? star(36, lv === 3 ? 4 : 8, 5.5, PAL.sun) : `<circle cx="36" cy="9" r="3" fill="${PAL.sun}"/>`}</g>${fire ? `<circle cx="36" cy="32" r="13" fill="none" stroke="${PAL.sun}" stroke-width="3"/><circle cx="36" cy="32" r="20" fill="none" stroke="${PAL.sun}" stroke-width="1.8" opacity="0.7"/>` : ''}`;
    }
  }
}
export const towerSVG = (kind: TDTowerKind, lv: 1 | 2 | 3, fire = false) => svg(72, 72, towerBody(kind, lv, fire), `${kind} tower level ${lv}`);
export const TOWER_ACCENT = FAMILY_COLOR;

// ── enemies: 8 families × (idle, move, hit) — bright toys: round shapes, stub feet, stripes. Never eyes or mouths ───────────────────────
function enemyBody(kind: TDEnemyKind, pose: 'idle' | 'move' | 'hit'): string {
  const tilt = pose === 'move' ? ' transform="rotate(7 24 28)"' : '';
  const flash = pose === 'hit' ? PAL.white : null;
  const f = (c: string) => flash ?? c;
  const foot = (x: number, y: number) => `<ellipse cx="${x}" cy="${y}" rx="4.4" ry="2.8" fill="${f(PAL.panel)}"/>`;
  const step = pose === 'move' ? 2 : 0;
  switch (kind) {
    case 'drifter': return `${shadow(24, 43, 14)}${foot(16, 41 + step)}${foot(32, 41 - step)}<g${tilt}><circle cx="24" cy="24" r="16" fill="${f(PAL.coral)}"/>${pose === 'hit' ? '' : under('M10 28 Q24 40 38 28 A16 16 0 0 1 10 28 Z')}<path d="M13 12 L35 34" stroke-width="5.5" stroke="${f(PAL.paper)}"/><path d="M13 12 L35 34" stroke-width="1.4"/>${hl(17, 16, 4.5, 2.4)}<path d="M24 8 Q22 2 27 2" fill="none" stroke-width="2.4"/><circle cx="27.5" cy="2.8" r="2.4" fill="${f(PAL.sun)}" stroke-width="1.8"/></g>`;
    case 'zipper': return `${shadow(24, 43, 13)}<circle cx="15" cy="40" r="3.8" fill="${f(PAL.panel)}"/><circle cx="33" cy="40" r="3.8" fill="${f(PAL.panel)}"/><g${tilt}><path d="M5 35 Q24 -2 43 35 Z" fill="${f(PAL.berry)}"/>${pose === 'hit' ? '' : under('M7 35 Q24 20 41 35 Z')}<path d="M17 27 H31 M20 20 H28" stroke="${f(PAL.sun)}" stroke-width="3"/>${hl(18, 20, 3.4, 2, -40)}<path d="M2 18 H9 M0 26 H8 M3 33 H9" stroke-width="2.6"/></g>`;
    case 'bulwark': return `${shadow(24, 45, 18)}${foot(14, 42 + step)}${foot(34, 42 - step)}<g${tilt}><path d="M6 38 V16 Q6 6 16 6 H32 Q42 6 42 16 V38 Q42 42 38 42 H10 Q6 42 6 38 Z" fill="${f(PAL.moss)}"/>${pose === 'hit' ? '' : under('M6 30 H42 V38 Q42 42 38 42 H10 Q6 42 6 38 Z')}<path d="M6 22 H42 M6 31 H42 M24 6 V42" stroke-width="2.2"/><rect x="15" y="12" width="18" height="5" rx="2.5" fill="${INK}" stroke="none"/>${[10, 38].map((x) => `<circle cx="${x}" cy="26.5" r="1.6" fill="${INK}" stroke="none"/>`).join('')}${hl(14, 11, 4, 2)}</g>`;
    case 'skimmer': return `<ellipse cx="24" cy="44" rx="11" ry="2.6" fill="${INK}" opacity="0.2" stroke="none"/><g${tilt}><path d="M2 24 L15 12 L24 19 L33 12 L46 24 L24 33 Z" fill="${f(PAL.sky)}"/>${pose === 'hit' ? '' : under('M2 24 L24 33 L46 24 L24 28 Z')}<path d="M24 19 V33"/><circle cx="24" cy="23" r="5" fill="${f(PAL.sun)}" stroke-width="2.4"/>${hl(12, 20, 5, 1.8, -35)}<path d="M19 8 H29 M24 8 V13" stroke-width="2.6"/></g>`;
    case 'warden': return `${shadow(24, 44, 14)}<g${tilt}><path d="M24 4 L41 22 L24 41 L7 22 Z" fill="${f(PAL.stone)}"/>${pose === 'hit' ? '' : under('M7 22 L24 41 L41 22 L24 28 Z')}<path d="M26 12 H40 V28 L33 35 L26 28 Z" fill="${f(PAL.paper)}"/><path d="M30 18 H36 M33 18 V28" stroke-width="2.2"/><path d="M13 22 H21" stroke-width="2.6"/><circle cx="24" cy="22" r="19" fill="none" stroke="${f(PAL.sun)}" stroke-width="1.8" stroke-dasharray="4 4" opacity="0.8"/>${hl(15, 17, 4, 2, -40)}</g>`;
    case 'splitter': return `${shadow(24, 43, 17)}${foot(13, 41 + step)}${foot(35, 41 - step)}<g${tilt}><circle cx="15" cy="26" r="12" fill="${f(PAL.amber)}"/><circle cx="33" cy="26" r="12" fill="${f(PAL.amber)}"/>${pose === 'hit' ? '' : under('M3 28 Q15 40 24 30 Q33 40 45 28 A12 12 0 0 1 33 38 H15 A12 12 0 0 1 3 28 Z')}<path d="M24 15 V38" stroke-dasharray="3 3"/>${hl(11, 20, 4, 2.2)}${hl(29, 20, 4, 2.2)}<circle cx="15" cy="27" r="3" fill="${f(PAL.paper)}" stroke-width="2"/><circle cx="33" cy="27" r="3" fill="${f(PAL.paper)}" stroke-width="2"/></g>`;
    case 'sapper': return `${shadow(24, 44, 13)}${foot(17, 41 + step)}${foot(31, 41 - step)}<g${tilt}><path d="M24 6 L40 32 Q40 40 24 40 Q8 40 8 32 Z" fill="${f(PAL.teal)}"/>${pose === 'hit' ? '' : under('M8 32 Q8 40 24 40 Q40 40 40 32 Q24 38 8 32 Z')}<path d="M24 6 V20 L32 30" fill="none"/><path d="M15 31 H33" stroke="${f(PAL.paper)}" stroke-width="4"/><path d="M15 31 H33" stroke-width="1.2"/>${hl(17, 24, 3.2, 5.5, 25)}<path d="M24 6 Q28 -1 33 3" fill="none" stroke-width="2.4"/>${star(34, 3, 4, f(PAL.sun), 1.8)}</g>`;
    case 'colossus': return `${shadow(24, 45, 19)}${foot(14, 43)}${foot(34, 43)}<rect x="6" y="6" width="36" height="36" rx="7" fill="${f(PAL.copper)}"/>${pose === 'hit' ? '' : under('M6 30 H42 V35 a7 7 0 0 1 -7 7 H13 a7 7 0 0 1 -7 -7 Z')}<path d="M6 18 H42 M6 30 H42"/><rect x="16" y="20" width="16" height="6" rx="3" fill="${f(PAL.sun)}" stroke-width="2.2"/>${hl(15, 11, 5, 2)}`;
  }
}
export const enemySVG = (kind: TDEnemyKind, pose: 'idle' | 'move' | 'hit' = 'idle') => svg(48, 48, enemyBody(kind, pose), `${kind} ${pose}`);

// ── bosses: three different silhouettes (96 px), plus a phase-3 pose each. Big, bright, with a "tell" (spinning gear / drill / lantern) ────
function bossBody(id: TDBossId, phase3: boolean): string {
  switch (id) {
    case 'copper_colossus': return `${shadow(48, 90, 38)}<rect x="12" y="20" width="72" height="64" rx="12" fill="${PAL.copper}"/>${under('M12 62 H84 V72 a12 12 0 0 1 -12 12 H24 a12 12 0 0 1 -12 -12 Z')}<path d="M12 42 H84 M12 62 H84 M36 20 V84 M60 20 V84" stroke-width="2.5"/><rect x="3" y="16" width="20" height="22" rx="8" fill="${PAL.panel}"/><rect x="73" y="16" width="20" height="22" rx="8" fill="${PAL.panel}"/><circle cx="13" cy="27" r="4" fill="${phase3 ? PAL.coral : PAL.sun}" stroke-width="2"/><circle cx="83" cy="27" r="4" fill="${phase3 ? PAL.coral : PAL.sun}" stroke-width="2"/><rect x="3" y="68" width="20" height="18" rx="7" fill="${PAL.panel}"/><rect x="73" y="68" width="20" height="18" rx="7" fill="${PAL.panel}"/><circle cx="48" cy="12" r="11" fill="${PAL.stone}" stroke-dasharray="5 3.4" stroke-width="5"/><circle cx="48" cy="12" r="9" fill="${PAL.stone}"/><circle cx="48" cy="12" r="3.4" fill="${PAL.panel}"/><rect x="34" y="46" width="28" height="12" rx="6" fill="${phase3 ? PAL.sun : PAL.paper}"/>${hl(30, 30, 9, 3.6)}${phase3 ? `<path d="M40 52 H56" stroke-width="3" stroke="${PAL.coral}"/>` : ''}`;
    case 'quarry_crawler': return `${shadow(48, 88, 42)}${[16, 36, 56].map((x, i) => `<rect x="${x}" y="${38 - i * 2}" width="24" height="${40 + i * 2}" rx="10" fill="${i % 2 ? PAL.cream : '#F0B993'}"/>`).join('')}<path d="M16 54 H80 M16 66 H80" stroke-width="2.2"/>${[24, 44, 64].map((x, i) => `<path d="M${x} ${40 - i * 2} L${x + 6} ${28 - i * 2} L${x + 12} ${40 - i * 2} Z" fill="${PAL.coral}" stroke-width="2.2"/>`).join('')}<path d="M80 40 Q96 44 94 56 Q96 68 80 72 Z" fill="${PAL.stone}"/><path d="M82 48 L92 52 M82 58 L92 56 M82 66 L90 62" stroke-width="2.2"/>${hl(26, 46, 5, 2.4)}<path d="M20 78 V86 M40 78 V86 M60 78 V86" stroke-width="5"/>${phase3 ? `<path d="M10 34 L4 26 M10 80 L4 88" stroke="${PAL.coral}" stroke-width="4"/>` : ''}`;
    case 'skywork_leviathan': return `${shadow(48, 92, 30, 6)}<path d="M6 52 Q26 14 66 26 Q92 34 94 52 Q92 70 66 78 Q26 90 6 52 Z" fill="${PAL.sky}"/>${under('M6 52 Q26 90 66 78 Q92 70 94 52 Q60 66 6 52 Z')}<path d="M20 38 L6 20 L34 32 Z M20 66 L6 84 L34 72 Z" fill="${PAL.paper}"/><circle cx="68" cy="50" r="12" fill="${PAL.panel}"/><circle cx="68" cy="50" r="7" fill="${PAL.sun}" stroke-width="2.4"/><path d="M68 38 V62 M56 50 H80" stroke="${PAL.sun}" stroke-width="2.2"/><path d="M30 50 H54 M30 58 H50" stroke-width="2.4"/>${[34, 48].map((x) => `<circle cx="${x}" cy="42" r="2.2" fill="${INK}" stroke="none"/>`).join('')}<path d="M44 28 V16 M34 16 H54" stroke-width="3"/>${hl(40, 34, 12, 3.4, -18)}${phase3 ? star(44, 12, 7, PAL.sun) : ''}`;
  }
}
export const bossSVG = (id: TDBossId, phase3 = false) => svg(96, 96, bossBody(id, phase3), `${id}${phase3 ? ' final phase' : ''}`);

// ── role emblems (64 px): five original symbols, no portraits ────────────────────────────────────────────────────────────────
const ROLE_BODY: Record<TDRole, string> = {
  architect: `<rect x="6" y="6" width="52" height="52" rx="12" fill="${PAL.green}"/>${hl(20, 16, 9, 3.4)}<path d="M18 46 L32 16 L46 46" fill="none" stroke-width="3.5"/><path d="M24 36 H40" stroke-width="3"/><circle cx="32" cy="16" r="4.4" fill="${PAL.paper}"/>`,
  tactician: `<rect x="6" y="6" width="52" height="52" rx="12" fill="${PAL.sky}"/>${hl(20, 16, 9, 3.4)}<circle cx="32" cy="32" r="14" fill="${PAL.paper}"/><path d="M32 12 V22 M32 42 V52 M12 32 H22 M42 32 H52" stroke-width="3"/><circle cx="32" cy="32" r="4" fill="${INK}" stroke="none"/>`,
  artillerist: `<rect x="6" y="6" width="52" height="52" rx="12" fill="${PAL.coral}"/>${hl(20, 16, 9, 3.4)}<path d="M14 46 Q32 6 50 40" fill="none" stroke-width="3" stroke-dasharray="4 4"/><circle cx="50" cy="42" r="6.5" fill="${PAL.sun}"/><rect x="11" y="44" width="14" height="9" rx="3" fill="${PAL.panel}"/>`,
  alchemist: `<rect x="6" y="6" width="52" height="52" rx="12" fill="${PAL.purple}"/>${hl(20, 16, 9, 3.4)}<path d="M26 14 H38 M28 14 V26 L18 46 H46 L36 26 V14" fill="${PAL.paper}"/><path d="M22 38 H42 L46 46 H18 Z" fill="${PAL.green}"/><circle cx="30" cy="34" r="2" fill="${PAL.paper}" stroke-width="1.6"/>`,
  warden: `<rect x="6" y="6" width="52" height="52" rx="12" fill="${PAL.sun}"/>${hl(20, 16, 9, 3.4)}<path d="M32 12 L48 18 V32 Q48 46 32 52 Q16 46 16 32 V18 Z" fill="${PAL.paper}"/><path d="M32 24 L38 32 L32 40 L26 32 Z" fill="${PAL.coral}"/>`,
};
export const roleSVG = (r: TDRole) => svg(64, 64, ROLE_BODY[r], `${r} emblem`);

// ── question-kind symbols (40 px) ────────────────────────────────────────────────────────────────────────────────────────────
const KIND_BODY: Record<string, string> = {
  multiple_choice: `<rect x="5" y="5" width="13" height="13" rx="3" fill="${PAL.sun}"/><rect x="22" y="5" width="13" height="13" rx="3" fill="${PAL.paper}"/><rect x="5" y="22" width="13" height="13" rx="3" fill="${PAL.paper}"/><rect x="22" y="22" width="13" height="13" rx="3" fill="${PAL.paper}"/>`,
  answer_forge: `<rect x="3" y="11" width="34" height="18" rx="4" fill="${PAL.paper}"/><path d="M10 20 H22"/><path d="M28 14 V26" stroke="${PAL.coral}"/>`,
  connection_rush: `<circle cx="9" cy="12" r="6" fill="${PAL.sky}"/><circle cx="31" cy="28" r="6" fill="${PAL.green}"/><path d="M14 13 Q22 14 26 27"/>`,
  truth_hunt: `<rect x="3" y="7" width="16" height="26" rx="4" fill="${PAL.green}"/><rect x="21" y="7" width="16" height="26" rx="4" fill="${PAL.coral}"/><path d="M8 20 L11 24 L16 15 M25 15 L32 25 M32 15 L25 25" stroke-width="2.5"/>`,
  fill_table: `<rect x="3" y="5" width="34" height="30" rx="4" fill="${PAL.paper}"/><path d="M3 15 H37 M3 25 H37 M14 5 V35 M26 5 V35" stroke-width="2"/><rect x="16" y="17" width="8" height="6" rx="2" fill="${PAL.sun}" stroke="none"/>`,
};
export const kindSVG = (k: string) => svg(40, 40, KIND_BODY[k] ?? KIND_BODY.multiple_choice!, `${k} question`);

// ── board props (48 px): the world around the lane ──────────────────────────────────────────────────────────────────────────
type PP = { prop: string; propInk: string };
const PROP: Record<string, (p: PP) => string> = {
  leaf: (c) => `<path d="M8 40 Q8 12 40 8 Q36 40 8 40 Z" fill="${c.prop}"/><path d="M10 38 L32 16" stroke="${c.propInk}" stroke-width="2"/>`,
  bush: (c) => `<circle cx="15" cy="30" r="10" fill="${c.prop}"/><circle cx="30" cy="25" r="13" fill="${c.prop}"/><circle cx="37" cy="33" r="8" fill="${c.prop}"/>${hl(26, 19, 6, 2.6)}<circle cx="20" cy="30" r="1.8" fill="${PAL.candy}" stroke="none"/><circle cx="33" cy="30" r="1.8" fill="${PAL.sun}" stroke="none"/>`,
  pond: () => `<ellipse cx="24" cy="27" rx="21" ry="13" fill="${PAL.sky}"/>${hl(15, 22, 6, 2.2, -10)}<path d="M13 28 Q17 25 21 28 M26 32 Q30 29 34 32" stroke="${PAL.white}" stroke-width="2"/><path d="M34 12 Q36 6 38 12 Z M38 12 V24" fill="${PAL.leaf}" stroke-width="2"/>`,
  stone: () => `<path d="M7 40 L11 20 L26 11 L41 22 L39 40 Z" fill="${PAL.stone}"/>${under('M7 40 L9 31 H40 L39 40 Z')}${hl(20, 20, 5, 2.2)}<path d="M18 28 L26 24" stroke-width="2"/>`,
  rock: () => `<path d="M4 41 L10 16 L24 8 L42 18 L44 41 Z" fill="#E2B08F"/>${under('M4 41 L6 32 H44 V41 Z')}${hl(20, 18, 6, 2.4)}<path d="M14 31 L24 23 L31 31" fill="none" stroke-width="2"/>`,
  bridge: () => `<rect x="3" y="14" width="42" height="20" rx="4" fill="${PAL.wood}"/><path d="M11 14 V34 M19 14 V34 M27 14 V34 M35 14 V34" stroke-width="2"/><path d="M3 18 H45 M3 30 H45" stroke="${PAL.woodDark}" stroke-width="3"/>`,
  flag: () => `<path d="M13 43 V7"/><path d="M13 7 Q26 3 38 9 Q26 13 38 19 Q26 23 13 19 Z" fill="${PAL.coral}"/><circle cx="13" cy="6" r="3" fill="${PAL.sun}" stroke-width="2"/>`,
  crate: () => `<rect x="7" y="11" width="34" height="30" rx="3" fill="${PAL.amber}"/>${under('M7 33 H41 V38 a3 3 0 0 1 -3 3 H10 a3 3 0 0 1 -3 -3 Z')}<path d="M7 11 L41 41 M41 11 L7 41" stroke-width="2"/><rect x="7" y="11" width="34" height="30" rx="3" fill="none"/>`,
  cart: () => `<path d="M5 17 H43 L38 33 H10 Z" fill="${PAL.stone}"/><path d="M8 17 L12 9 H20 L22 17 M26 17 L28 11 H36 L40 17" fill="${PAL.sun}" stroke-width="2"/><circle cx="16" cy="37" r="6" fill="${PAL.panel}"/><circle cx="32" cy="37" r="6" fill="${PAL.panel}"/><circle cx="16" cy="37" r="2" fill="${PAL.stone}" stroke="none"/><circle cx="32" cy="37" r="2" fill="${PAL.stone}" stroke="none"/>`,
  gear: () => `<circle cx="24" cy="24" r="17" fill="${PAL.stone}" stroke-dasharray="7 4" stroke-width="7"/><circle cx="24" cy="24" r="14" fill="${PAL.stone}"/>${hl(18, 16, 6, 2.4)}<circle cx="24" cy="24" r="5.5" fill="${PAL.panel}"/>`,
  pipe: () => `<path d="M5 33 H25 V11 H43" fill="none" stroke-width="11"/><path d="M5 33 H25 V11 H43" fill="none" stroke="${PAL.stone}" stroke-width="6"/><circle cx="25" cy="22" r="4" fill="${PAL.sun}" stroke-width="2"/>`,
  cloud: () => `<path d="M7 35 Q4 22 17 22 Q19 8 32 13 Q45 12 42 26 Q49 35 38 37 H11 Q5 37 7 35 Z" fill="${PAL.white}"/>${under('M8 35 H42 Q49 35 38 37 H11 Q5 37 8 35 Z')}`,
  // storybook additions
  tree: (c) => `<rect x="21" y="26" width="7" height="16" rx="2" fill="${PAL.woodDark}"/><circle cx="24" cy="18" r="14" fill="${c.prop}"/><circle cx="14" cy="24" r="9" fill="${c.prop}"/><circle cx="34" cy="24" r="9" fill="${c.prop}"/>${hl(19, 12, 6, 2.6)}<circle cx="27" cy="20" r="2" fill="${PAL.candy}" stroke="none"/><circle cx="16" cy="25" r="2" fill="${PAL.sun}" stroke="none"/>`,
  mushroom: () => `<rect x="20" y="24" width="9" height="16" rx="4" fill="${PAL.cream}"/><path d="M6 28 Q6 8 24 8 Q42 8 42 28 Z" fill="${PAL.coral}"/><circle cx="16" cy="19" r="3" fill="${PAL.white}" stroke-width="2"/><circle cx="30" cy="16" r="3.4" fill="${PAL.white}" stroke-width="2"/><circle cx="35" cy="23" r="2.2" fill="${PAL.white}" stroke-width="1.6"/>`,
  lantern: () => `<path d="M24 43 V14"/><path d="M24 14 H33 V9" fill="none"/><rect x="29" y="9" width="10" height="13" rx="4" fill="${PAL.sun}"/><rect x="27" y="6" width="14" height="5" rx="2.5" fill="${PAL.panel}"/><circle cx="34" cy="16" r="9" fill="${PAL.sun}" opacity="0.22" stroke="none"/>`,
  fence: () => `${[6, 18, 30, 42].map((x) => `<path d="M${x - 3} 40 V16 L${x} 11 L${x + 3} 16 V40 Z" fill="${PAL.wood}"/>`).join('')}<path d="M3 22 H45 M3 33 H45" stroke="${PAL.woodDark}" stroke-width="3.4"/>`,
  sign: () => `<rect x="21" y="22" width="6" height="20" rx="2" fill="${PAL.woodDark}"/><path d="M6 12 H40 L46 18 L40 24 H6 Z" fill="${PAL.wood}"/><path d="M12 18 H34" stroke="${PAL.paper}" stroke-width="3"/>`,
  crystal: (c) => `<path d="M24 4 L33 20 L29 42 H19 L15 20 Z" fill="${PAL.candy}"/><path d="M12 42 L8 28 L16 34 L17 42 Z" fill="${PAL.sky}"/><path d="M36 42 L40 26 L32 33 L31 42 Z" fill="${PAL.mint}"/>${hl(21, 20, 2.6, 8, 10)}<path d="M24 6 V38" stroke="${PAL.white}" stroke-width="1.8"/><circle cx="24" cy="46" r="0" fill="${c.prop}"/>`,
  banner: () => `<path d="M10 43 V6 M38 43 V6"/><path d="M10 8 H38 V30 L24 24 L10 30 Z" fill="${PAL.coral}"/><path d="M18 14 H30" stroke="${PAL.paper}" stroke-width="3"/>`,
  flower: () => `<path d="M24 42 V24" stroke="${PAL.leaf}" stroke-width="3.4"/><path d="M24 36 Q14 34 12 28 Q20 28 24 34 M24 34 Q34 32 36 26 Q28 26 24 32" fill="${PAL.leaf}" stroke-width="2"/>${Array.from({ length: 5 }, (_, i) => { const a = (i * 2 * Math.PI) / 5 - Math.PI / 2; return `<circle cx="${(24 + Math.cos(a) * 7).toFixed(1)}" cy="${(17 + Math.sin(a) * 7).toFixed(1)}" r="5" fill="${PAL.candy}" stroke-width="2"/>`; }).join('')}<circle cx="24" cy="17" r="4.4" fill="${PAL.sun}" stroke-width="2"/>`,
  barrel: () => `<path d="M10 12 Q6 26 10 40 H38 Q42 26 38 12 Z" fill="${PAL.wood}"/><path d="M8.5 20 H39.5 M8.5 32 H39.5" stroke="${PAL.woodDark}" stroke-width="3.4"/><ellipse cx="24" cy="12" rx="14" ry="4" fill="${PAL.amber}"/>`,
  tent: () => `<path d="M3 40 L24 6 L45 40 Z" fill="${PAL.coral}"/><path d="M24 6 L24 40" stroke-width="2.4"/><path d="M13 40 L24 22 L35 40 Z" fill="${PAL.panel}"/><path d="M24 6 V2" /><path d="M24 2 L32 5 L24 8 Z" fill="${PAL.sun}" stroke-width="2"/>`,
  windmill: () => `<path d="M16 42 L19 18 H29 L32 42 Z" fill="${PAL.cream}"/><path d="M15 18 L24 9 L33 18 Z" fill="${PAL.coral}"/><path d="M24 15 L40 6 M24 15 L8 24 M24 15 L36 28 M24 15 L12 4" stroke-width="3.6"/><circle cx="24" cy="15" r="3" fill="${PAL.sun}" stroke-width="2"/><rect x="21" y="32" width="6" height="10" rx="3" fill="${PAL.panel}"/>`,
  tuft: (c) => `<path d="M10 40 Q12 24 18 40 M18 40 Q22 18 28 40 M28 40 Q34 26 38 40" fill="${c.prop}"/>`,
};
export const propSVG = (kind: string, palette: { prop: string; propInk: string }) => svg(48, 48, (PROP[kind] ?? PROP.stone!)(palette), kind);
export const PROP_KINDS = Object.keys(PROP);

/** The core at the end of the lane (a gate-fort holding a glowing crystal heart) and the spawn gate at its start (64 px). */
export const coreSVG = () => svg(64, 64, `${shadow(32, 58, 25)}<path d="M8 54 V26 H14 V20 H20 V26 H26 V20 H38 V26 H44 V20 H50 V26 H56 V54 Z" fill="${PAL.stone}"/>${under('M8 46 H56 V54 H8 Z')}<path d="M24 54 V38 Q32 28 40 38 V54 Z" fill="${PAL.panel}"/><path d="M32 6 L43 22 L32 38 L21 22 Z" fill="${PAL.sun}"/><path d="M32 13 L38 22 L32 31 L26 22 Z" fill="${PAL.paper}"/>${hl(27, 17, 3, 1.6)}<path d="M11 20 V10 M11 10 L19 13 L11 16 Z M53 20 V10 M53 10 L45 13 L53 16 Z" fill="${PAL.coral}" stroke-width="2"/>`, 'core');
export const spawnSVG = () => svg(64, 64, `${shadow(32, 58, 22)}<path d="M10 56 V26 Q10 6 32 6 Q54 6 54 26 V56 Z" fill="${PAL.woodDark}"/><path d="M18 56 V28 Q18 16 32 16 Q46 16 46 28 V56 Z" fill="${PAL.berry}"/><path d="M24 56 V32 Q24 24 32 24 Q40 24 40 32 V56 Z" fill="${INK}" stroke="none"/><circle cx="32" cy="38" r="6" fill="${PAL.candy}" opacity="0.7" stroke="none"/><path d="M6 56 H58"/><path d="M12 10 V2 M12 2 L20 5 L12 8 Z M52 10 V2 M52 2 L44 5 L52 8 Z" fill="${PAL.sun}" stroke-width="2"/>${star(32, 12, 4, PAL.sun, 1.8)}`, 'spawn gate');

/** Small lifecycle icons for the HUD (24 px): wave, core, points, timer — always beside a text label. */
export const ICON = {
  wave: `<path d="M3 15 Q7 9 11 15 T19 15" fill="none"/><path d="M3 9 Q7 3 11 9 T19 9" fill="none" opacity="0.5"/>`,
  core: `<path d="M12 3 L19 12 L12 21 L5 12 Z" fill="${PAL.gold}"/>`,
  points: `<circle cx="12" cy="12" r="8" fill="${PAL.gold}"/><path d="M12 7 V17 M8 11 H16" stroke-width="2"/>`,
  timer: `<circle cx="12" cy="13" r="8" fill="${PAL.paper}"/><path d="M12 13 V8 M10 3 H14" stroke-width="2"/>`,
};
export const iconSVG = (k: keyof typeof ICON) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><g stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">${ICON[k]}</g></svg>`;
