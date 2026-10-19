import type { ReactNode } from 'react';
import type { Shape } from '@/lib/quiz/projector/content/vault-doors';

export const INK = '#0b1018';
/** Eight team identities. Colour AND a pattern AND a number, so a team is never identified by colour alone. */
export const TEAM = [
  { c: '#e8453c', n: 'red', p: 'dots' }, { c: '#2f7fd8', n: 'blue', p: 'diag' }, { c: '#3fae6a', n: 'green', p: 'cross' }, { c: '#f2a900', n: 'amber', p: 'horiz' },
  { c: '#8e5bd6', n: 'violet', p: 'vert' }, { c: '#e0609b', n: 'pink', p: 'check' }, { c: '#1fb5b5', n: 'teal', p: 'waves' }, { c: '#7a8696', n: 'slate', p: 'plain' },
] as const;
export const teamStyle = (i: number) => TEAM[((i % 8) + 8) % 8]!;

/** Shared <defs>: team fill patterns, ink hatching, paper grain. Render once per scene. */
export function Defs({ id }: { id: string }) {
  return (
    <defs>
      {TEAM.map((t, i) => (
        <pattern key={i} id={`${id}-tp${i}`} width="10" height="10" patternUnits="userSpaceOnUse">
          <rect width="10" height="10" fill={t.c} />
          {t.p === 'dots' && <circle cx="5" cy="5" r="1.6" fill="#fff" opacity=".55" />}
          {t.p === 'diag' && <path d="M-2 12L12 -2M-2 6L6 -2M4 12L12 4" stroke="#fff" strokeWidth="1.4" opacity=".5" />}
          {t.p === 'cross' && <path d="M0 5H10M5 0V10" stroke="#fff" strokeWidth="1.2" opacity=".5" />}
          {t.p === 'horiz' && <path d="M0 3H10M0 8H10" stroke="#fff" strokeWidth="1.4" opacity=".5" />}
          {t.p === 'vert' && <path d="M3 0V10M8 0V10" stroke="#fff" strokeWidth="1.4" opacity=".5" />}
          {t.p === 'check' && <path d="M0 0H5V5H0ZM5 5H10V10H5Z" fill="#fff" opacity=".4" />}
          {t.p === 'waves' && <path d="M0 5Q2.5 1 5 5T10 5" stroke="#fff" strokeWidth="1.3" fill="none" opacity=".55" />}
        </pattern>
      ))}
      <pattern id={`${id}-hatch`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><path d="M0 0V7" stroke={INK} strokeWidth="1.1" opacity=".22" /></pattern>
      <pattern id={`${id}-dots`} width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.1" fill={INK} opacity=".16" /></pattern>
      <filter id={`${id}-rough`} x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="3" result="n" /><feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" /></filter>
    </defs>
  );
}

/** Team banner: pole + pennant carrying the team number, filled with the team pattern. */
export function Flag({ i, x, y, s = 1, label }: { i: number; x: number; y: number; s?: number; label?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} aria-label={label}>
      <path d="M0 0V-46" stroke={INK} strokeWidth="5" strokeLinecap="round" />
      <path d="M0 -46H30L22 -34L30 -22H0Z" fill={`url(#pj-tp${i % 8})`} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <text x="9" y="-29" fontSize="13" fontWeight="800" fill="#fff" stroke={INK} strokeWidth="3" paintOrder="stroke" fontFamily="var(--qz-display)">{i + 1}</text>
    </g>
  );
}

/** Key shapes for the Treasure Vault: distinct SILHOUETTES (not colours) so they work in grayscale. */
export function ShapeGlyph({ shape, x, y, r = 12, fill = '#f2c565', dim = false }: { shape: Shape; x: number; y: number; r?: number; fill?: string; dim?: boolean }) {
  const common = { fill: dim ? 'none' : fill, stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' as const, opacity: dim ? 0.55 : 1, strokeDasharray: dim ? '4 3' : undefined };
  const p = (pts: [number, number][]) => pts.map(([a, b]) => `${x + a * r},${y + b * r}`).join(' ');
  switch (shape) {
    case 'circle': return <circle cx={x} cy={y} r={r} {...common} />;
    case 'square': return <rect x={x - r * 0.9} y={y - r * 0.9} width={r * 1.8} height={r * 1.8} rx={2} {...common} />;
    case 'triangle': return <polygon points={p([[0, -1.05], [1.05, 0.85], [-1.05, 0.85]])} {...common} />;
    case 'diamond': return <polygon points={p([[0, -1.15], [0.9, 0], [0, 1.15], [-0.9, 0]])} {...common} />;
    case 'hex': return <polygon points={p([[1, 0], [0.5, 0.87], [-0.5, 0.87], [-1, 0], [-0.5, -0.87], [0.5, -0.87]])} {...common} />;
    default: return <polygon points={p([[0, -1.1], [0.3, -0.35], [1.05, -0.3], [0.48, 0.2], [0.65, 0.95], [0, 0.55], [-0.65, 0.95], [-0.48, 0.2], [-1.05, -0.3], [-0.3, -0.35]])} {...common} />;
  }
}

export function Sr({ children }: { children: ReactNode }) { return <title>{children}</title>; }
/** Pulse ring for the thing the teacher just touched. Respects reduced motion via CSS (.pj-pulse). */
export function Pulse({ cx, cy, r, color = '#ffd52f' }: { cx: number; cy: number; r: number; color?: string }) {
  return <circle className="pj-pulse" cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="5" />;
}
