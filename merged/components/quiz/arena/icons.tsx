/** DOM icons for Arena Clash (SVG). Same glyph data as the canvas; decorative by default (the visible label carries the meaning). */
import type { Helper, Role } from '@/lib/quiz/arena/domain';
import { FORMAT_GLYPH, HELPER_GLYPH, ROLE_GLYPH, ROLE_INFO, TEAM_COLORS, TEAM_DARK, TEAM_SHAPE, INK } from './art';

const base = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
export function RoleIcon({ role, size = 28, tint }: { role: Role; size?: number; tint?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="11" fill={tint ?? ROLE_INFO[role].color} stroke={INK} strokeWidth="1.6" /><g transform="translate(4.8 4.8) scale(0.6)"><path d={ROLE_GLYPH[role]} {...base} stroke="#fff" strokeWidth="3" /><path d={ROLE_GLYPH[role]} {...base} stroke={INK} strokeWidth="1.4" /></g></svg>
  );
}
export function HelperIcon({ helper, size = 28 }: { helper: Helper; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={HELPER_GLYPH[helper]} {...base} stroke={INK} strokeWidth="1.8" /></svg>;
}
export function FormatIcon({ format, size = 28 }: { format: keyof typeof FORMAT_GLYPH; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={FORMAT_GLYPH[format]} {...base} stroke={INK} strokeWidth="1.8" /></svg>;
}
/** A team badge: the colour AND a distinct shape. */
export function TeamBadge({ index, size = 22 }: { index: number; size?: number }) {
  const i = ((index % 4) + 4) % 4; const c = TEAM_COLORS[i]; const d = TEAM_DARK[i]; const s = TEAM_SHAPE[i];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {s === 'circle' && <circle cx="12" cy="12" r="9" fill={c} stroke={d} strokeWidth="2" />}
      {s === 'square' && <rect x="3.5" y="3.5" width="17" height="17" rx="2" fill={c} stroke={d} strokeWidth="2" />}
      {s === 'triangle' && <path d="M12 3l9.5 17h-19z" fill={c} stroke={d} strokeWidth="2" strokeLinejoin="round" />}
      {s === 'star' && <path d="M12 2.5l2.9 6.2 6.6.8-4.9 4.6 1.3 6.7L12 17.4 6.1 20.8l1.3-6.7L2.5 9.5l6.6-.8z" fill={c} stroke={d} strokeWidth="1.8" strokeLinejoin="round" />}
    </svg>
  );
}
