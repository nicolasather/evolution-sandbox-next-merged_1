/** Illustrated mini-posters for the map pickers of the four individual-device games (the counterpart of Tower Defense's `Poster`).
 *  Pure inline SVG: sky, layered hills or water, a winding route to a flag, and a few landmarks drawn from small shared shapes. Original art, no downloads, no client code.
 *  Decorative: the card's text already names the map, so the picture is aria-hidden. */
import type { ReactNode } from 'react';

export type PosterTheme = 'meadow' | 'carnival' | 'lagoon' | 'orchard' | 'harbor' | 'clockwork' | 'sky' | 'chalk' | 'canyon' | 'lantern' | 'commons' | 'night';
const INK = '#17253A';
type Spec = { sky: [string, string]; far: string; mid: string; near: string; route: string; flag: string; sun?: string; stars?: boolean; items: [Shape, number, number, number, string?][] };
type Shape = 'tree' | 'pine' | 'tent' | 'gear' | 'crystal' | 'tower' | 'lantern' | 'mesa' | 'island' | 'wave' | 'hut' | 'clock' | 'block' | 'balloon' | 'bush';

const SPECS: Record<PosterTheme, Spec> = {
  meadow: { sky: ['#8FD8F5', '#E6F7D6'], far: '#A9E08E', mid: '#8FD37E', near: '#6BC06C', route: '#F5E6BC', flag: '#F7CD61', sun: '#FFF2A8', items: [['tree', 40, 108, 1, '#4FB286'], ['tree', 82, 100, .8, '#6DD7B0'], ['hut', 250, 100, 1, '#F56F59'], ['tree', 284, 112, 1.1, '#4FB286'], ['bush', 150, 132, 1, '#5FBB6E']] },
  carnival: { sky: ['#6A4FB0', '#FFB870'], far: '#F4A15D', mid: '#F9C967', near: '#EF8B57', route: '#FFF0C8', flag: '#64CBBA', sun: '#FFE08A', items: [['tent', 64, 100, 1.2, '#F56F59'], ['gear', 252, 98, 1, '#F7CD61'], ['tent', 214, 112, .8, '#64CBBA'], ['balloon', 150, 52, 1, '#F56F59'], ['gear', 110, 126, .6, '#F7CD61']] },
  lagoon: { sky: ['#A8E8F2', '#E9F8F4'], far: '#B89AE9', mid: '#76D9D2', near: '#3CA9C6', route: '#E8F8F4', flag: '#FFD36A', sun: '#FFF6C8', items: [['crystal', 60, 102, 1.2, '#B89AE9'], ['crystal', 92, 112, .8, '#8E83DC'], ['crystal', 250, 98, 1.1, '#B89AE9'], ['wave', 160, 146, 1, '#FFFFFF'], ['wave', 70, 150, .8, '#FFFFFF']] },
  orchard: { sky: ['#9DDDF2', '#F7F0C4'], far: '#A5DE98', mid: '#8BD79A', near: '#6FC585', route: '#F2D9A0', flag: '#F6A04D', sun: '#FFEFA0', items: [['tree', 36, 104, 1.1, '#F6A04D'], ['tree', 76, 112, .9, '#2F7A5B'], ['lantern', 210, 96, 1, '#F6A04D'], ['tree', 270, 106, 1.1, '#F6A04D'], ['bush', 130, 134, 1, '#2F7A5B']] },
  harbor: { sky: ['#8ED8EE', '#FCEFD2'], far: '#65C9D6', mid: '#F6E4BE', near: '#C98F5E', route: '#EBD3A2', flag: '#F47F79', sun: '#FFF2A8', items: [['tower', 262, 84, 1.2, '#F47F79'], ['wave', 70, 62, 1, '#FFFFFF'], ['hut', 200, 108, .9, '#F47F79'], ['wave', 140, 70, .8, '#FFFFFF'], ['block', 60, 128, .8, '#C98F5E']] },
  clockwork: { sky: ['#F6CFA0', '#FFF0D8'], far: '#E2B785', mid: '#EDC9A0', near: '#B9744A', route: '#FFE7B8', flag: '#7FB6D6', sun: '#FFF6C8', items: [['clock', 60, 90, 1.2, '#7FB6D6'], ['gear', 250, 100, 1, '#B9744A'], ['gear', 282, 116, .6, '#7A4A33'], ['hut', 200, 108, 1, '#7FB6D6'], ['block', 120, 130, .8, '#7A4A33']] },
  sky: { sky: ['#6FC8F0', '#F4FBFF'], far: '#FFFFFF', mid: '#BFE8FA', near: '#8FD3F0', route: '#FFFFFF', flag: '#FFC86B', sun: '#FFF6C8', items: [['island', 70, 96, 1.2, '#8FD37E'], ['island', 250, 82, 1, '#B89AE9'], ['balloon', 160, 48, 1, '#F47F79'], ['island', 160, 132, .8, '#8FD37E']] },
  chalk: { sky: ['#7FD0F2', '#FFF4C8'], far: '#BFE7A0', mid: '#8FD37E', near: '#5FBB6E', route: '#FFF7E8', flag: '#F56F59', sun: '#FFF2A8', items: [['block', 60, 112, 1, '#F7D96B'], ['block', 90, 122, .7, '#6BBFE8'], ['tree', 250, 104, 1, '#4FB286'], ['block', 200, 128, .9, '#F56F59'], ['tree', 288, 112, .8, '#6DD7B0']] },
  canyon: { sky: ['#FFC48A', '#FFEFD0'], far: '#E08F5A', mid: '#F2A56A', near: '#C86A3F', route: '#FFE7B8', flag: '#6DD7B0', sun: '#FFF2A8', items: [['mesa', 60, 100, 1.3, '#E08F5A'], ['mesa', 260, 94, 1.1, '#C86A3F'], ['mesa', 160, 112, .7, '#F2A56A'], ['bush', 110, 136, .8, '#4FB286']] },
  lantern: { sky: ['#3A3270', '#F59C7A'], far: '#4B5C9A', mid: '#2F6F8F', near: '#1F4A63', route: '#F7D96B', flag: '#F56F59', sun: '#FFE9A8', stars: true, items: [['lantern', 54, 96, 1.2, '#F7D96B'], ['tower', 262, 86, 1.1, '#F56F59'], ['lantern', 210, 108, .9, '#F56F59'], ['wave', 120, 70, .9, '#9FD3F0']] },
  commons: { sky: ['#9FD8F2', '#FFF0D0'], far: '#D9B98A', mid: '#B9A07A', near: '#8A6A4A', route: '#F7E6C0', flag: '#6BBFE8', sun: '#FFF6C8', items: [['clock', 262, 88, 1.1, '#6BBFE8'], ['gear', 58, 104, 1, '#B9744A'], ['hut', 200, 108, 1, '#F6A04D'], ['gear', 94, 122, .6, '#7A4A33']] },
  night: { sky: ['#0E1E3A', '#25584F'], far: '#1B3C46', mid: '#16313A', near: '#10262E', route: '#3E7C6F', flag: '#F7D96B', stars: true, items: [['pine', 50, 110, 1.2, '#10262E'], ['pine', 86, 118, 1, '#16313A'], ['pine', 262, 108, 1.3, '#10262E'], ['crystal', 160, 130, .7, '#F7D96B']] },
};

function draw(s: Shape, x: number, y: number, k: number, c = '#888'): ReactNode {
  const sw = 2.5;
  const g = (kids: ReactNode) => <g transform={`translate(${x} ${y}) scale(${k})`} stroke={INK} strokeWidth={sw} strokeLinejoin="round">{kids}</g>;
  switch (s) {
    case 'tree': return g(<><rect x={-3} y={0} width={6} height={20} fill="#7A5230" /><circle cx={0} cy={-4} r={16} fill={c} /><circle cx={-8} cy={4} r={10} fill={c} opacity={.9} /></>);
    case 'pine': return g(<><rect x={-3} y={6} width={6} height={14} fill="#4A3320" /><path d="M0 -26 L16 6 H-16Z" fill={c} /><path d="M0 -14 L20 16 H-20Z" fill={c} /></>);
    case 'bush': return g(<><circle cx={-8} cy={0} r={9} fill={c} /><circle cx={6} cy={-2} r={11} fill={c} /><circle cx={0} cy={4} r={8} fill={c} /></>);
    case 'tent': return g(<><path d="M-22 18 L0 -22 L22 18Z" fill={c} /><path d="M-8 18 L0 -4 L8 18Z" fill="#FFF7E8" /><path d="M0 -22 V-32 L10 -28 L0 -24" fill="#F7D96B" /></>);
    case 'gear': return g(<><circle r={14} fill={c} /><circle r={5} fill="#FFF7E8" />{[0, 45, 90, 135].map((a) => <rect key={a} x={-3} y={-19} width={6} height={38} rx={2} fill={c} transform={`rotate(${a})`} stroke="none" />)}<circle r={14} fill="none" /></>);
    case 'crystal': return g(<><path d="M0 -26 L12 -4 L6 18 H-6 L-12 -4Z" fill={c} /><path d="M0 -26 L0 18 M-12 -4 H12" fill="none" strokeOpacity={.5} strokeWidth={1.5} /></>);
    case 'tower': return g(<><path d="M-9 20 L-6 -18 H6 L9 20Z" fill="#FFF7E8" /><path d="M-8 4 H8 L7 -6 H-7Z" fill={c} /><rect x={-8} y={-26} width={16} height={9} fill={c} /><path d="M-9 -26 L0 -34 L9 -26Z" fill="#17253A" /></>);
    case 'lantern': return g(<><rect x={-2} y={-24} width={4} height={40} fill="#4A3320" /><rect x={-8} y={-22} width={16} height={18} rx={4} fill={c} /><circle cx={0} cy={-13} r={9} fill="#FFF3B0" opacity={.5} stroke="none" /></>);
    case 'mesa': return g(<><path d="M-30 20 L-24 -14 H24 L30 20Z" fill={c} /><path d="M-24 -14 H24" stroke={INK} /><path d="M-18 2 H18 M-22 10 H22" fill="none" strokeOpacity={.35} strokeWidth={2} /></>);
    case 'island': return g(<><path d="M-28 0 H28 Q18 22 0 24 Q-18 22 -28 0Z" fill="#B88B5A" /><path d="M-28 0 Q0 -14 28 0Z" fill={c} /><circle cx={-8} cy={-8} r={7} fill="#4FB286" /></>);
    case 'wave': return g(<path d="M-22 0 q6 -9 12 0 t12 0 t12 0 t12 0" fill="none" stroke={c} strokeWidth={3} strokeLinecap="round" />);
    case 'hut': return g(<><rect x={-16} y={-4} width={32} height={22} fill="#FFF7E8" /><path d="M-20 -4 L0 -24 L20 -4Z" fill={c} /><rect x={-4} y={4} width={8} height={14} fill="#8A5A2B" /></>);
    case 'clock': return g(<><rect x={-13} y={-14} width={26} height={34} fill="#FFF7E8" /><path d="M-16 -14 L0 -30 L16 -14Z" fill={c} /><circle cx={0} cy={-2} r={8} fill="#fff" /><path d="M0 -2 V-8 M0 -2 L5 0" stroke={INK} fill="none" /></>);
    case 'block': return g(<><rect x={-12} y={-12} width={24} height={24} rx={3} fill={c} /><path d="M-12 -4 H12" stroke="#fff" strokeOpacity={.5} fill="none" /></>);
    case 'balloon': return g(<><ellipse cx={0} cy={0} rx={13} ry={16} fill={c} /><path d="M-13 0 Q0 10 13 0 M0 -16 V16" fill="none" strokeOpacity={.4} /><rect x={-5} y={22} width={10} height={7} fill="#8A5A2B" /><path d="M-7 15 L-4 22 M7 15 L4 22" fill="none" /></>);
  }
}

export default function MapPoster({ theme, seed = 1, className = '' }: { theme: PosterTheme; seed?: number; className?: string }) {
  const s = SPECS[theme]; const id = `mp-${theme}-${seed}`; const r = (n: number) => ((seed * 9301 + n * 49297) % 233280) / 233280;
  const flip = seed % 2 === 1;
  const path = flip ? 'M16 160 C70 130 90 170 150 148 S250 112 292 120' : 'M16 150 C74 168 110 128 160 144 S250 160 296 108';
  const end = flip ? [292, 120] : [296, 108];
  return (
    <svg className={`mp ${className}`} viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs><linearGradient id={`${id}-s`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={s.sky[0]} /><stop offset="1" stopColor={s.sky[1]} /></linearGradient></defs>
      <rect width="320" height="180" fill={`url(#${id}-s)`} />
      {s.stars && Array.from({ length: 18 }, (_, i) => <circle key={i} cx={r(i) * 320} cy={r(i + 40) * 70} r={0.8 + r(i + 7) * 1.1} fill="#FFF6C8" opacity={0.5 + r(i + 3) * 0.4} />)}
      {s.sun && <circle cx={flip ? 40 : 276} cy={34} r={16} fill={s.sun} stroke={INK} strokeWidth={2.5} />}
      {!s.stars && [[60, 28, 1], [190, 20, .8], [250, 46, .6]].map(([x, y, k], i) => <g key={i} fill="#fff" fillOpacity={.9} transform={`translate(${x! + (r(i) * 20 - 10)} ${y}) scale(${k})`}><ellipse rx={26} ry={8} /><ellipse cx={14} cy={-6} rx={16} ry={9} /></g>)}
      <path d="M0 96 Q60 62 130 92 T260 84 T320 78 V180 H0Z" fill={s.far} stroke={INK} strokeWidth={2.5} />
      <path d="M0 122 Q80 92 160 118 T320 106 V180 H0Z" fill={s.mid} stroke={INK} strokeWidth={2.5} />
      <path d="M0 150 Q90 132 170 148 T320 140 V180 H0Z" fill={s.near} stroke={INK} strokeWidth={2.5} />
      <path d={path} fill="none" stroke={INK} strokeWidth={13} strokeLinecap="round" />
      <path d={path} fill="none" stroke={s.route} strokeWidth={8} strokeLinecap="round" />
      <path d={path} fill="none" stroke={INK} strokeOpacity={.35} strokeWidth={2} strokeDasharray="3 9" strokeLinecap="round" />
      {s.items.map(([sh, x, y, k, c], i) => <g key={i}>{draw(sh, flip ? 320 - x : x, y, k, c)}</g>)}
      <g stroke={INK} strokeWidth={2.5} strokeLinejoin="round"><path d={`M${end[0]} ${end[1]} V${end[1]! - 30}`} fill="none" /><path d={`M${end[0]} ${end[1]! - 30} l22 7 l-22 8Z`} fill={s.flag} /></g>
    </svg>
  );
}

export const CR_THEME: Record<string, PosterTheme> = { sunleaf_passage: 'orchard', tideglass_harbor: 'harbor', copperwind_borough: 'clockwork', starpetal_heights: 'sky' };
export const ARENA_THEME: Record<string, PosterTheme> = { meadow_mosaic: 'meadow', clockwork_carnival: 'carnival', crystal_lagoon: 'lagoon' };
export const OS_THEME: Record<string, PosterTheme> = { chalkyard_circuit: 'chalk', paperfold_canyon: 'canyon', lantern_harbor: 'lantern', clockwork_commons: 'commons' };
