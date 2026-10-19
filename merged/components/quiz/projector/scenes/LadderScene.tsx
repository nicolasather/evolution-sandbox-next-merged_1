'use client';
import { LEDGES, type LedgeShape } from '@/lib/quiz/projector/content/ladder-tiers';
import { branchTier, type LadderG } from '@/lib/quiz/projector/reducers/ladder';
import type { Core, Locale } from '@/lib/quiz/projector/types';
import { tr } from '../i18n';
import { Defs, Flag, INK } from './shared';

const W = 1280, H = 720; const COBALT = '#183c72', SKY = '#6cd2e3', SUN = '#ffd65e', SCARLET = '#f15b48', CREAM = '#fff1ce';

function Ledge({ shape, x, y, w }: { shape: LedgeShape; x: number; y: number; w: number }) {
  const s = { stroke: INK, strokeWidth: 3.2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }; const c = x + w / 2;
  switch (shape) {
    case 'camp': return <path d={`M${c - 22} ${y}L${c} ${y - 34}L${c + 22} ${y}Z`} fill="#e9a23b" {...s} />;
    case 'rope': return <path d={`M${x} ${y - 6}Q${c} ${y + 18} ${x + w} ${y - 6}M${x + 6} ${y - 24}V${y}M${x + w - 6} ${y - 24}V${y}`} fill="none" {...s} />;
    case 'watch': return <g><rect x={c - 12} y={y - 44} width="24" height="44" fill="#a47a4a" {...s} /><path d={`M${c - 18} ${y - 44}L${c} ${y - 62}L${c + 18} ${y - 44}Z`} fill={SCARLET} {...s} /></g>;
    case 'steps': return <path d={`M${c - 30} ${y}V${y - 8}H${c - 15}V${y - 16}H${c}V${y - 24}H${c + 15}V${y - 32}H${c + 30}V${y}Z`} fill="#b9c3cf" {...s} />;
    case 'pennant': return <path d={`M${c} ${y}V${y - 50}L${c + 34} ${y - 40}L${c} ${y - 30}`} fill={SCARLET} {...s} />;
    case 'lift': return <g><path d={`M${x - 20} ${y - 70}L${x + w + 20} ${y - 90}`} {...s} fill="none" /><rect x={c - 16} y={y - 70} width="32" height="26" rx="4" fill="#f0b25a" {...s} /></g>;
    case 'gear': return <circle cx={c} cy={y - 22} r="20" fill="#d6a24a" stroke={INK} strokeWidth="3.2" strokeDasharray="6 4" />;
    case 'cloud': return <path d={`M${c - 34} ${y - 4}a16 16 0 0 1 8 -28a20 20 0 0 1 38 -4a16 16 0 0 1 14 32Z`} fill="#fff" {...s} />;
    case 'signal': return <g><path d={`M${c} ${y}V${y - 58}`} {...s} fill="none" strokeWidth="5" /><circle cx={c} cy={y - 62} r="9" fill={SCARLET} {...s} /><path d={`M${c - 22} ${y - 74}a30 30 0 0 1 44 0`} {...s} fill="none" /></g>;
    case 'span': return <path d={`M${x + 6} ${y}V${y - 22}L${c} ${y - 36}L${x + w - 6} ${y - 22}V${y}M${x + 24} ${y - 28}V${y}M${c} ${y - 36}V${y}M${x + w - 24} ${y - 28}V${y}`} fill="none" {...s} />;
    case 'gate': return <path d={`M${c - 26} ${y}V${y - 52}H${c + 26}V${y}M${c - 26} ${y - 52}Q${c} ${y - 78} ${c + 26} ${y - 52}`} fill="none" {...s} strokeWidth="5" />;
    case 'ice': return <path d={`M${c - 30} ${y}L${c - 14} ${y - 40}L${c} ${y - 14}L${c + 14} ${y - 52}L${c + 30} ${y}Z`} fill="#d9f4ff" {...s} />;
    case 'beacon': return <g><path d={`M${c} ${y}V${y - 46}`} {...s} fill="none" strokeWidth="5" /><path d={`M${c - 10} ${y - 46}L${c} ${y - 70}L${c + 10} ${y - 46}Z`} fill={SUN} {...s} /></g>;
    case 'sky': return <path d={`M${c - 32} ${y - 6}H${c + 32}M${c - 20} ${y - 18}H${c + 20}`} {...s} fill="none" />;
    default: return <g><path d={`M${c - 26} ${y}V${y - 34}H${c + 26}V${y}`} fill="#d6a24a" {...s} /><path d={`M${c} ${y - 34}V${y - 68}L${c + 34} ${y - 58}L${c} ${y - 48}`} fill={SCARLET} {...s} /></g>;
  }
}

export type LadderProps = { core: Core; g: LadderG; locale: Locale };
export default function LadderScene({ core, g, locale }: LadderProps) {
  const S = g.summit; const left = 120, right = W - 200; const top = 120, bottom = H - 70;
  const px = (k: number) => left + ((right - left) * k) / S + (k % 2 ? 18 : -10);
  const py = (k: number) => bottom - ((bottom - top) * k) / S;
  const pw = Math.min(150, (right - left) / S + 40);
  const checkpoints = new Set(core.teams.map((t) => g.teams[t.id]?.checkpoint ?? 0));
  const fxTeam = core.fx?.team;
  return (
    <svg className="pj-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${tr(locale, 'summit')}: ${S}`} preserveAspectRatio="xMidYMid meet">
      <Defs id="pj" />
      <rect width={W} height={H} fill={SKY} />
      {Array.from({ length: 6 }, (_, i) => <path key={i} d={`M-40 ${80 + i * 120}q160 -70 320 0t320 0t320 0t320 0t320 0`} fill="none" stroke="#fff" strokeWidth="26" opacity=".35" />)}
      <rect width={W} height={H} fill="url(#pj-dots)" opacity=".5" />
      <circle cx={W - 110} cy="100" r="54" fill={SUN} stroke={INK} strokeWidth="6" />{Array.from({ length: 14 }, (_, i) => <path key={i} d="M0 -64V-80" stroke={SUN} strokeWidth="6" strokeLinecap="round" transform={`translate(${W - 110} 100) rotate(${i * (360 / 14)})`} />)}
      {/* mountain mass behind the climb */}
      <path d={`M${left - 90} ${H}L${px(S) + 40} ${py(S) + 30}L${W - 80} ${H}Z`} fill={COBALT} opacity=".28" />
      <path d={`M${px(0)} ${py(0) + 30}${Array.from({ length: S }, (_, k) => `L${px(k + 1)} ${py(k + 1) + 30}`).join('')}`} fill="none" stroke={CREAM} strokeWidth="6" strokeDasharray="2 12" strokeLinecap="round" opacity=".9" />
      {Array.from({ length: S + 1 }, (_, k) => {
        const x = px(k) - pw / 2, y = py(k); const led = LEDGES[Math.min(LEDGES.length - 1, k === S ? LEDGES.length - 1 : k % (LEDGES.length - 1))]!;
        return (
          <g key={k} aria-label={`${tr(locale, 'summit')} ${k}`}>
            <path d={`M${x + 6} ${y + 6}h${pw}l-8 24h-${pw - 16}z`} fill={INK} opacity=".45" />
            <path d={`M${x} ${y}h${pw}l-8 26h-${pw - 16}z`} fill={k === S ? SUN : CREAM} stroke={INK} strokeWidth="4.5" strokeLinejoin="round" />
            <path d={`M${x + 4} ${y + 18}h${pw - 8}`} stroke={COBALT} strokeWidth="2.5" opacity=".5" />
            <Ledge shape={led.shape} x={x} y={y} w={pw} />
            <text x={x + pw / 2} y={y + 21} textAnchor="middle" fontSize="19" fontWeight="900" fill={COBALT} fontFamily="var(--qz-display)">{k === 0 ? '0' : k}</text>
            {checkpoints.has(k) && k > 0 && <g transform={`translate(${x + pw - 6} ${y + 4})`}><circle r="13" fill={SCARLET} stroke={INK} strokeWidth="3.5" /><path d="M-6 0L-2 5L6 -5" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" /></g>}
            {branchTier(g, k) && <g><path d={`M${x + pw / 2} ${y - 4}L${x + pw / 2 + 36} ${y - 54}`} stroke={INK} strokeWidth="4" strokeDasharray="6 5" fill="none" /><rect x={x + pw / 2 + 18} y={y - 82} width="48" height="20" fill={CREAM} stroke={INK} strokeWidth="3.5" /><text x={x + pw / 2 + 42} y={y - 67} textAnchor="middle" fontSize="13" fontWeight="800" fill={INK} fontFamily="var(--qz-display)">{tr(locale, 'steep').toUpperCase().slice(0, 9)}</text></g>}
          </g>
        );
      })}
      {core.teams.map((t, i) => {
        const gt = g.teams[t.id]; if (!gt) return null; const k = Math.min(gt.tier, S);
        const same = core.teams.slice(0, i).filter((o) => (g.teams[o.id]?.tier ?? -1) === gt.tier).length;
        const x = px(k) - pw / 2 + 28 + same * 30, y = py(k) + 2;
        return <g key={t.id} className={fxTeam === t.id ? 'pj-bob' : undefined}><Flag i={i} x={x} y={y} s={0.95} label={t.name} />{gt.shield > 0 && <circle cx={x} cy={y - 62} r="9" fill="#28d1d4" stroke={INK} strokeWidth="3.5" />}</g>;
      })}
      <g transform="translate(40 52)"><text fontSize="40" fontWeight="900" fontStyle="italic" fill={CREAM} stroke={INK} strokeWidth="8" paintOrder="stroke" fontFamily="var(--qz-display)">{tr(locale, 'summit').toUpperCase()} · {S}</text></g>
    </svg>
  );
}
