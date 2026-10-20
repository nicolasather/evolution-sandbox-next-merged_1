/** Arena Clash art tokens: the four team colours (each with a distinct SHAPE, so colour is never the only cue), the five role glyphs (original line icons, no faces), and map palettes.
 *  Glyph paths are 24×24 SVG path strings so the very same data draws on the canvas (Path2D) and in DOM <svg> cards. */
import type { Helper, Role } from '@/lib/quiz/arena/domain';

export const TEAM_COLORS = ['#F56F59', '#4AA8E0', '#E6B422', '#3DBE8B'] as const;
export const TEAM_DARK = ['#B8402E', '#2B78AD', '#A57C0C', '#1F8B63'] as const;
export const TEAM_SHAPE = ['circle', 'square', 'triangle', 'star'] as const;
export const TEAM_MARK = ['●', '■', '▲', '★'] as const;
export const TEAM_WORD = ['Coral', 'Sky', 'Gold', 'Mint'] as const;
export type TeamShape = (typeof TEAM_SHAPE)[number];

export const ROLE_INFO: Record<Role, { name: string; ability: string; short: string; how: string; color: string; seconds: number }> = {
  runner: { name: 'Runner', ability: 'Dash Trail', short: 'Quick bursts across the map.', how: 'Dash Trail: a 1.5 s sprint (60% faster). Great for grabbing a far zone or racing a banner home.', color: '#F56F59', seconds: 18 },
  sentinel: { name: 'Sentinel', ability: 'Shelter Flag', short: 'Keeps a spot safe for your team.', how: 'Shelter Flag: guards the live zone beside you for 3 s. Rivals cannot flip it meanwhile.', color: '#4AA8E0', seconds: 26 },
  builder: { name: 'Builder', ability: 'Quick Bridge', short: 'Opens a path for everyone.', how: 'Quick Bridge: opens the nearest gate for 7 s so your whole team can walk through.', color: '#E6B422', seconds: 24 },
  trickster: { name: 'Trickster', ability: 'Decoy Beacon', short: 'Sends rivals the wrong way.', how: 'Decoy Beacon: leaves a fake blip on rival radars for 2 s. It never blocks, hurts or slows anyone.', color: '#9B7BE0', seconds: 30 },
  navigator: { name: 'Navigator', ability: 'Route Scan', short: 'Sees what is about to happen.', how: 'Route Scan: shows your team the next zone rotation or crystal respawn 5 s early.', color: '#3DBE8B', seconds: 24 },
};
export const ROLE_GLYPH: Record<Role, string> = {
  runner: 'M5 5l7 7-7 7M12 5l7 7-7 7',
  sentinel: 'M12 3l7 3v5c0 5-3.2 8.2-7 10-3.8-1.8-7-5-7-10V6z',
  builder: 'M3 18h18M5 18v-4a7 7 0 0 1 14 0v4M9 18v-3M15 18v-3',
  trickster: 'M12 3l8 9-8 9-8-9zM12 8l3.5 4-3.5 4-3.5-4z',
  navigator: 'M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z',
};
export const HELPER_GLYPH: Record<Helper, string> = {
  trail_speed: 'M4 15c3-1 3-6 8-6l3-3 3 4-3 2c0 4-4 6-8 5zM4 19h16',
  capture_marker: 'M6 21V4M6 5h11l-2 4 2 4H6',
  route_reveal: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  deposit_guidance: 'M12 3v14M6 11l6 6 6-6M5 21h14',
};
export const FORMAT_GLYPH = {
  control: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
  relay: 'M6 21V4M6 5h11l-2 4 2 4H6',
  crystal: 'M12 2l6 7-6 13-6-13z M6 9h12',
} as const;
export const INK = '#17253A'; export const PAPER = '#FFF7E8';

/** Draws a team's shape mark (centered, radius r). */
export function teamMark(g: CanvasRenderingContext2D, shape: TeamShape, x: number, y: number, r: number) {
  g.beginPath();
  if (shape === 'circle') g.arc(x, y, r, 0, Math.PI * 2);
  else if (shape === 'square') g.rect(x - r * 0.88, y - r * 0.88, r * 1.76, r * 1.76);
  else if (shape === 'triangle') { g.moveTo(x, y - r * 1.05); g.lineTo(x + r * 1.0, y + r * 0.8); g.lineTo(x - r * 1.0, y + r * 0.8); g.closePath(); }
  else { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const rr = i % 2 ? r * 0.48 : r * 1.12; if (i) g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); }
}
const glyphCache = new Map<string, Path2D>();
export function glyph(g: CanvasRenderingContext2D, d: string, x: number, y: number, size: number, stroke: string, width = 2.2) {
  let p = glyphCache.get(d); if (!p) { p = new Path2D(d); glyphCache.set(d, p); }
  g.save(); g.translate(x - size / 2, y - size / 2); g.scale(size / 24, size / 24); g.lineWidth = width; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = stroke; g.stroke(p); g.restore();
}

/** Suggested role set by team size (the first role is the only one a team of one can pick). */
export const ROLE_SETS: Record<number, readonly Role[]> = { 1: ['runner'], 2: ['runner', 'navigator'], 3: ['runner', 'navigator', 'sentinel'], 4: ['runner', 'navigator', 'sentinel', 'builder'], 5: ['runner', 'navigator', 'sentinel', 'builder', 'trickster'] };
