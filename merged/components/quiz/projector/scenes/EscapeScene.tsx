'use client';
import { CAMPAIGNS, hotspotNeeds, type Hotspot } from '@/lib/quiz/projector/content/escape-campaigns';
import { activeSpots, roomOf, type EscapeG } from '@/lib/quiz/projector/reducers/escape';
import type { Core, Locale } from '@/lib/quiz/projector/types';
import { L, tr } from '../i18n';
import { Defs, INK } from './shared';

const W = 1280, H = 720; const SX = 1.18, SY = 1.12; const OX = 50, OY = 40;
const PAL = {
  clockhouse: { wall: '#1d3e51', wall2: '#244b60', floor: '#4c816a', wood: '#d2a06d', accent: '#edb968', paper: '#f5eee2', motif: 'gear' },
  celestial_archive: { wall: '#1b2a52', wall2: '#243664', floor: '#3b4a7a', wood: '#9a7bd1', accent: '#ffe27b', paper: '#f1ecff', motif: 'star' },
  glass_garden: { wall: '#1f4a43', wall2: '#2a5d54', floor: '#6b8f5a', wood: '#7fd0c0', accent: '#b7f0a5', paper: '#effaf0', motif: 'leaf' },
} as const;

function Motif({ kind, x, y, r, fill }: { kind: string; x: number; y: number; r: number; fill: string }) {
  if (kind === 'gear') { const pts: string[] = []; for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2, b = a + Math.PI / 10; pts.push(`${x + r * Math.cos(a)},${y + r * Math.sin(a)}`, `${x + r * 1.28 * Math.cos(a + 0.12)},${y + r * 1.28 * Math.sin(a + 0.12)}`, `${x + r * 1.28 * Math.cos(b - 0.12)},${y + r * 1.28 * Math.sin(b - 0.12)}`, `${x + r * Math.cos(b)},${y + r * Math.sin(b)}`); } return <g><polygon points={pts.join(' ')} fill={fill} stroke={INK} strokeWidth="3.5" strokeLinejoin="round" /><circle cx={x} cy={y} r={r * 0.36} fill={INK} /></g>; }
  if (kind === 'star') return <polygon points={Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 5; const rr = i % 2 ? r * 0.48 : r * 1.1; return `${x + rr * Math.cos(a)},${y + rr * Math.sin(a)}`; }).join(' ')} fill={fill} stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />;
  return <g><path d={`M${x} ${y + r}Q${x - r * 1.3} ${y - r * 0.2} ${x} ${y - r * 1.1}Q${x + r * 1.3} ${y - r * 0.2} ${x} ${y + r}Z`} fill={fill} stroke={INK} strokeWidth="3.5" strokeLinejoin="round" /><path d={`M${x} ${y + r}V${y - r * 0.6}`} stroke={INK} strokeWidth="3" /></g>;
}

/** One object per slot, drawn in the room's palette. Everything lives inside its hit rectangle so labels never collide. */
function Prop({ h, pal, state }: { h: Hotspot; pal: (typeof PAL)[keyof typeof PAL]; state: 'idle' | 'done' | 'ready' }) {
  const x = h.x * SX + OX, y = h.y * SY + OY, w = h.w * SX, hh = h.h * SY; const cx = x + w / 2, cy = y + hh / 2; const done = state === 'done';
  const body = done ? '#6fae7e' : pal.wood;
  switch (h.slot) {
    case 'A': return <g><rect x={x} y={y} width={w} height={hh} rx="6" fill={body} stroke={INK} strokeWidth="5" /><rect x={x + 10} y={y + 12} width={w - 20} height={hh * 0.38} fill={pal.paper} stroke={INK} strokeWidth="4" /><rect x={x + 10} y={y + hh * 0.52} width={w - 20} height={hh * 0.38} fill={pal.paper} stroke={INK} strokeWidth="4" /><Motif kind={pal.motif} x={cx} y={y + 12 + hh * 0.19} r={Math.min(w, hh) * 0.13} fill={pal.accent} /><circle cx={cx} cy={y + hh * 0.71} r="7" fill={pal.accent} stroke={INK} strokeWidth="3.5" /></g>;
    case 'B': return <g><path d={`M${cx - w * 0.3} ${y + hh}L${cx} ${y + hh * 0.55}L${cx + w * 0.3} ${y + hh}Z`} fill={body} stroke={INK} strokeWidth="5" strokeLinejoin="round" /><circle cx={cx} cy={y + hh * 0.36} r={Math.min(w, hh) * 0.34} fill={done ? '#bfe8c8' : pal.paper} stroke={INK} strokeWidth="5" /><path d={`M${cx - w * 0.3} ${y + hh * 0.36}H${cx + w * 0.3}M${cx} ${y + hh * 0.02}V${y + hh * 0.7}`} stroke={INK} strokeWidth="3" opacity=".6" /><Motif kind={pal.motif} x={cx} y={y + hh * 0.36} r={Math.min(w, hh) * 0.14} fill={pal.accent} /></g>;
    case 'L': return <g><rect x={x} y={y + hh * 0.18} width={w} height={hh * 0.8} rx="10" fill={done ? '#6fae7e' : '#8a6a3c'} stroke={INK} strokeWidth="6" /><path d={`M${x + w * 0.22} ${y + hh * 0.18}V${y + hh * 0.06}a${w * 0.28} ${w * 0.28} 0 0 1 ${w * 0.56} 0V${y + hh * 0.18}`} fill="none" stroke={INK} strokeWidth="10" strokeLinecap="round" /><path d={`M${x + w * 0.22} ${y + hh * 0.18}V${y + hh * 0.06}a${w * 0.28} ${w * 0.28} 0 0 1 ${w * 0.56} 0V${y + hh * 0.18}`} fill="none" stroke="#c9d1d9" strokeWidth="4" strokeLinecap="round" /><circle cx={cx} cy={y + hh * 0.56} r={w * 0.13} fill={INK} /><path d={`M${cx} ${y + hh * 0.56}v${w * 0.16}`} stroke={INK} strokeWidth="6" strokeLinecap="round" />{done && <path d={`M${cx - 12} ${y + hh * 0.56}l8 9l16 -18`} fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />}</g>;
    case 'D': return <g><path d={`M${x} ${y + hh}V${y + hh * 0.22}Q${x} ${y} ${cx} ${y}Q${x + w} ${y} ${x + w} ${y + hh * 0.22}V${y + hh}Z`} fill={done ? '#102b20' : body} stroke={INK} strokeWidth="6" strokeLinejoin="round" />{!done && <><path d={`M${cx} ${y + 6}V${y + hh}`} stroke={INK} strokeWidth="4" /><circle cx={cx - 14} cy={y + hh * 0.58} r="6" fill={pal.accent} stroke={INK} strokeWidth="3.5" /><circle cx={cx + 14} cy={y + hh * 0.58} r="6" fill={pal.accent} stroke={INK} strokeWidth="3.5" /></>}{done && <path d={`M${x + w * 0.18} ${y + hh}V${y + hh * 0.3}Q${cx} ${y + hh * 0.1} ${x + w * 0.82} ${y + hh * 0.3}V${y + hh}`} fill={pal.accent} opacity=".45" />}<Motif kind={pal.motif} x={cx} y={y + hh * 0.26} r={Math.min(w, hh) * 0.1} fill={pal.accent} /></g>;
    case 'P': return <g><rect x={x} y={y} width={w} height={hh} rx="6" fill={done ? '#2c5f45' : '#14313d'} stroke={INK} strokeWidth="5" />{[0, 1, 2].map((k) => <Motif key={k} kind={pal.motif} x={x + w * (0.22 + k * 0.28)} y={cy} r={Math.min(w * 0.1, hh * 0.28)} fill={k === 1 || done ? pal.accent : pal.paper} />)}</g>;
    default: return <g><path d={`M${x + w * 0.1} ${y + hh}H${x + w * 0.9}L${x + w * 0.78} ${y + hh * 0.55}H${x + w * 0.22}Z`} fill={body} stroke={INK} strokeWidth="5" strokeLinejoin="round" /><path d={`M${x + w * 0.2} ${y + hh * 0.55}a${w * 0.3} ${w * 0.3} 0 0 1 ${w * 0.6} 0Z`} fill={done ? '#bfe8c8' : pal.paper} stroke={INK} strokeWidth="5" strokeLinejoin="round" /><Motif kind={pal.motif} x={cx} y={y + hh * 0.42} r={Math.min(w, hh) * 0.12} fill={pal.accent} /></g>;
  }
}

export type EscapeProps = { core: Core; g: EscapeG; locale: Locale; selected: string | null; onSpot?: (id: string) => void };
export default function EscapeScene({ core, g, locale, selected, onSpot }: EscapeProps) {
  const camp = CAMPAIGNS[g.campaign]; const room = roomOf(g); const pal = PAL[g.campaign]; const spots = activeSpots(g);
  const stateOf = (h: Hotspot): 'idle' | 'done' | 'ready' => (g.opened.includes(h.id) || g.solved.includes(h.id) ? 'done' : (hotspotNeeds(h, g.maxTier).every((i) => (g.inv[g.shared ? 'shared' : core.teams[core.actor % core.teams.length]!.id] ?? []).includes(i)) ? 'ready' : 'idle'));
  const fxRef = core.fx && ['solve', 'open', 'inspect'].includes(core.fx.kind) ? String(core.fx.ref ?? '') : '';
  return (
    <svg className="pj-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${L(locale, camp.name)} · ${L(locale, room.name)}`} preserveAspectRatio="xMidYMid meet">
      <Defs id="pj" />
      <rect width={W} height={H} fill={pal.wall} />
      <rect width={W} height="520" fill={pal.wall2} /><rect width={W} height={H} fill="url(#pj-dots)" opacity=".7" />
      {/* wainscot + floor + window light */}
      <rect y="470" width={W} height="40" fill="#0e2230" opacity=".5" /><rect y="520" width={W} height="200" fill={pal.floor} stroke={INK} strokeWidth="5" />
      {Array.from({ length: 12 }, (_, i) => <path key={i} d={`M${i * 120 + 20} 520L${i * 160 - 120} 720`} stroke={INK} strokeWidth="2" opacity=".22" />)}
      <g opacity=".55"><path d="M120 60H300V300H120Z" fill="#cfe9f3" stroke={INK} strokeWidth="6" /><path d="M210 60V300M120 180H300" stroke={INK} strokeWidth="5" /><path d="M300 60L560 520H300Z" fill={pal.accent} opacity=".18" /></g>
      {camp.id === 'clockhouse' && <g transform="translate(980 60)"><circle r="46" fill={pal.paper} stroke={INK} strokeWidth="6" /><path d="M0 -30V0L22 14" fill="none" stroke={INK} strokeWidth="6" strokeLinecap="round" />{Array.from({ length: 12 }, (_, i) => <path key={i} d={`M0 -40V-35`} stroke={INK} strokeWidth="3" transform={`rotate(${i * 30})`} />)}</g>}
      {camp.id === 'celestial_archive' && <g>{Array.from({ length: 16 }, (_, i) => <circle key={i} cx={80 + ((i * 197) % 1100)} cy={50 + ((i * 83) % 260)} r={2 + (i % 3)} fill="#ffe27b" opacity=".8" />)}</g>}
      {camp.id === 'glass_garden' && <g stroke={INK} strokeWidth="4" fill="none" opacity=".5">{Array.from({ length: 9 }, (_, i) => <path key={i} d={`M${i * 160} 0V520`} />)}<path d="M0 130H1280M0 300H1280" /></g>}
      {spots.map((h) => {
        const x = h.x * SX + OX, y = h.y * SY + OY, w = h.w * SX, hh = h.h * SY; const st = stateOf(h); const sel = selected === h.id; const hint = (g.hints[h.id] ?? 0) > 0;
        const fx = fxRef === h.id;
        return (
          <g key={h.id} onClick={onSpot ? () => onSpot(h.id) : undefined} style={onSpot ? { cursor: 'pointer' } : undefined} role={onSpot ? 'button' : undefined} tabIndex={onSpot ? 0 : undefined}
            onKeyDown={onSpot ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSpot(h.id); } } : undefined}
            aria-label={`${L(locale, h.label)}. ${st === 'done' ? (h.kind === 'puzzle' ? tr(locale, 'solved') : tr(locale, 'opened')) : h.kind === 'puzzle' ? '' : tr(locale, 'locked')}`}>
            <rect x={x - 10} y={y + hh - 4} width={w + 20} height="14" fill={INK} opacity=".35" rx="7" />
            <Prop h={h} pal={pal} state={st} />
            {st === 'ready' && h.kind !== 'puzzle' && <circle cx={x + w - 6} cy={y + 6} r="12" fill="#ffd52f" stroke={INK} strokeWidth="4" className="pj-pulse-soft" />}
            {h.kind === 'puzzle' && h.question && st !== 'done' && <g transform={`translate(${x + w - 4} ${y + 4})`}><circle r="16" fill="#ff386a" stroke={INK} strokeWidth="4" /><text y="7" textAnchor="middle" fontSize="22" fontWeight="900" fill="#fff" fontFamily="var(--qz-display)">?</text></g>}
            {st === 'done' && <g transform={`translate(${x + w - 4} ${y + 4})`}><circle r="16" fill="#5fd38d" stroke={INK} strokeWidth="4" /><path d="M-7 0L-2 6L8 -6" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /></g>}
            {hint && <text x={x + 8} y={y + 22} fontSize="20" fill="#ffe27b" stroke={INK} strokeWidth="5" paintOrder="stroke" fontWeight="900">💡</text>}
            <text x={x + w / 2} y={y + hh + 30} textAnchor="middle" fontSize="19" fontWeight="800" fill={pal.paper} stroke={INK} strokeWidth="5" paintOrder="stroke" fontFamily="var(--qz-display)" letterSpacing=".5">{L(locale, h.label).toUpperCase()}</text>
            {(sel || fx) && <rect x={x - 12} y={y - 12} width={w + 24} height={hh + 24} rx="12" fill="none" stroke="#ffd52f" strokeWidth="6" strokeDasharray="14 8" className="pj-pulse" />}
          </g>
        );
      })}
      <g transform="translate(40 36)"><text fontSize="40" fontWeight="900" fontStyle="italic" fill={pal.paper} stroke={INK} strokeWidth="8" paintOrder="stroke" fontFamily="var(--qz-display)">{L(locale, camp.name).toUpperCase()}</text>
        <text y="30" fontSize="20" fontWeight="700" fill={pal.accent} stroke={INK} strokeWidth="5" paintOrder="stroke" fontFamily="var(--qz-display)" letterSpacing="2">{tr(locale, 'room', { n: g.roomIdx + 1, m: g.rooms }).toUpperCase()} · {L(locale, room.name).toUpperCase()}</text></g>
      {(() => { const key = g.shared ? 'shared' : core.teams[core.actor % core.teams.length]!.id; const items = g.inv[key] ?? []; const labels = items.map((i) => L(locale, camp.items[i]?.label ?? { en: i })); return <g transform="translate(40 690)"><rect x="-8" y="-24" width="760" height="34" rx="6" fill="#0b1018" opacity=".8" stroke={INK} strokeWidth="3" /><text fontSize="17" fontWeight="800" fill={pal.accent} fontFamily="var(--qz-display)" letterSpacing="1">NOTEBOOK{g.shared ? '' : ` · ${core.teams[core.actor % core.teams.length]!.name}`}:</text><text x="190" fontSize="17" fontWeight="700" fill={pal.paper} fontFamily="var(--qz-display)">{labels.length ? labels.join(' · ') : 'nothing yet. Inspect objects to find items.'}</text></g>; })()}
      <g transform="translate(1240 52)" textAnchor="end"><text fontSize="20" fontWeight="800" fill={pal.paper} stroke={INK} strokeWidth="5" paintOrder="stroke" fontFamily="var(--qz-display)" letterSpacing="1.5">{tr(locale, 'hintTokens', { n: g.hintTokens }).toUpperCase()}</text>
        {Array.from({ length: Math.min(6, g.hintTokens) }, (_, i) => <circle key={i} cx={-i * 28 - 10} cy="24" r="10" fill={pal.accent} stroke={INK} strokeWidth="4" />)}</g>
    </svg>
  );
}
