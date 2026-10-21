/** Clue Racing art tokens: four team colours (each with its own SHAPE, so colour is never the only cue), six role glyphs (original line icons, no faces) with a distinct back accessory
 *  for the on-map avatars, perk and format glyphs. Glyph paths are 24×24 SVG strings so the same data draws on the canvas (Path2D) and in DOM <svg> cards. */
import type { Format, Perk, Role } from '@/lib/quiz/cr/domain';
import { ROLE_INFO as BAL_ROLE } from '@/lib/quiz/cr/balance';

export const TEAM_COLORS = ['#F56F59', '#4AA8E0', '#E6B422', '#3DBE8B'] as const;
export const TEAM_DARK = ['#B8402E', '#2B78AD', '#A57C0C', '#1F8B63'] as const;
export const TEAM_SHAPE = ['circle', 'square', 'triangle', 'star'] as const;
export const TEAM_WORD = ['Coral', 'Sky', 'Gold', 'Mint'] as const;
export type TeamShape = (typeof TEAM_SHAPE)[number];
export const INK = '#17253A'; export const PAPER = '#FFF7E8';

export const ROLE_COLOR: Record<Role, string> = { solo_pathfinder: '#F6A04D', scout: '#4AA8E0', signal_keeper: '#E6B422', cartographer: '#9B7BE0', trail_maker: '#3DBE8B', archivist: '#F56F59' };
export const ROLE_INFO: Record<Role, { name: string; ability: string; how: string; seconds: number; color: string; short: string; accessory: string }> = {
  solo_pathfinder: { ...BAL_ROLE.solo_pathfinder, color: ROLE_COLOR.solo_pathfinder, short: 'Does a little of everything.', accessory: 'compass' },
  scout: { ...BAL_ROLE.scout, color: ROLE_COLOR.scout, short: 'Sees the forks ahead.', accessory: 'spyglass' },
  signal_keeper: { ...BAL_ROLE.signal_keeper, color: ROLE_COLOR.signal_keeper, short: 'Lights the way for the team.', accessory: 'lantern' },
  cartographer: { ...BAL_ROLE.cartographer, color: ROLE_COLOR.cartographer, short: 'Keeps the big picture.', accessory: 'scroll' },
  trail_maker: { ...BAL_ROLE.trail_maker, color: ROLE_COLOR.trail_maker, short: 'Opens a shortcut for everyone.', accessory: 'plank' },
  archivist: { ...BAL_ROLE.archivist, color: ROLE_COLOR.archivist, short: 'Keeps the clues in sight.', accessory: 'satchel' },
};
export const ROLE_GLYPH: Record<Role, string> = {
  solo_pathfinder: 'M12 3l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z',
  scout: 'M3 14l12-6 3 6-12 6zM15 8l5-2M7 17l-2 3',
  signal_keeper: 'M9 9h6v10H9zM8 9l4-5 4 5M12 19v2M5 12h2M17 12h2',
  cartographer: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14',
  trail_maker: 'M3 15h18M5 15v4M19 15v4M3 11h18M7 11V8M12 11V8M17 11V8',
  archivist: 'M5 5h11l3 3v11H5zM9 11h6M9 15h6',
};
export const PERK_GLYPH: Record<Perk, string> = {
  route_lamp: 'M12 3v2M5.6 6l1.4 1.4M18.4 6L17 7.4M8 14a4 4 0 1 1 8 0c0 2-1 2.5-1 4H9c0-1.5-1-2-1-4zM9.5 21h5',
  fast_map: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14',
  extra_signal: 'M12 12v.01M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.5 5.5a9 9 0 0 0 0 13M18.5 5.5a9 9 0 0 1 0 13',
  scout_echo: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
};
export const FORMAT_GLYPH: Record<Format, string> = {
  split_route: 'M12 21v-8M12 13L6 6M12 13l6-7M6 6H3M6 6v3M18 6h3M18 6v3',
  signal_relay: 'M6 21V4M6 5h11l-2 4 2 4H6',
  atlas_circuit: 'M12 21s-6-5.5-6-10a6 6 0 0 1 12 0c0 4.5-6 10-6 10zM12 8.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5',
};
export const PERK_NAME: Record<Perk, string> = { route_lamp: 'Route Lamp', fast_map: 'Fast Map', extra_signal: 'Extra Signal', scout_echo: 'Scout Echo' };

export function teamMark(g: CanvasRenderingContext2D, shape: TeamShape, x: number, y: number, r: number) {
  g.beginPath();
  if (shape === 'circle') g.arc(x, y, r, 0, Math.PI * 2);
  else if (shape === 'square') g.rect(x - r * 0.88, y - r * 0.88, r * 1.76, r * 1.76);
  else if (shape === 'triangle') { g.moveTo(x, y - r * 1.05); g.lineTo(x + r, y + r * 0.8); g.lineTo(x - r, y + r * 0.8); g.closePath(); }
  else { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const rr = i % 2 ? r * 0.48 : r * 1.12; if (i) g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); }
}
const glyphCache = new Map<string, Path2D>();
export function glyph(g: CanvasRenderingContext2D, d: string, x: number, y: number, size: number, stroke: string, width = 2.2) {
  let p = glyphCache.get(d); if (!p) { p = new Path2D(d); glyphCache.set(d, p); }
  g.save(); g.translate(x - size / 2, y - size / 2); g.scale(size / 24, size / 24); g.lineWidth = width; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = stroke; g.stroke(p); g.restore();
}
/** The role set suggested for a team of this size (teams of one always play the Solo Pathfinder). */
export const ROLE_SETS: Record<number, readonly Role[]> = {
  1: ['solo_pathfinder'], 2: ['scout', 'cartographer'], 3: ['scout', 'cartographer', 'signal_keeper'], 4: ['scout', 'cartographer', 'signal_keeper', 'trail_maker'], 5: ['scout', 'cartographer', 'signal_keeper', 'trail_maker', 'archivist'],
};
