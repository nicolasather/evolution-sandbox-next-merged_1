'use client';
import { BOSSES } from '@/lib/quiz/projector/content/bosses';
import type { BossG } from '@/lib/quiz/projector/reducers/boss';
import { CLASS_HP, SHIELD_CAP } from '@/lib/quiz/projector/reducers/boss';
import type { Core, Locale } from '@/lib/quiz/projector/types';
import { L, tr } from '../i18n';
import { Defs, INK, teamStyle } from './shared';

const W = 1280, H = 720;
const KIND_LABEL = { attack: { en: 'Heavy strike' }, surge: { en: 'Surge' }, barrier: { en: 'Barrier' }, weakness: { en: 'Weak point opens' } } as const;
const pct = (a: number, b: number) => Math.max(0, Math.min(1, b ? a / b : 0));

function Gear({ cx, cy, r, teeth = 12, fill = '#d6a24a', rot = 0, spin = false }: { cx: number; cy: number; r: number; teeth?: number; fill?: string; rot?: number; spin?: boolean }) {
  const pts: string[] = [];
  for (let i = 0; i < teeth; i++) { const a0 = (i / teeth) * Math.PI * 2, a1 = ((i + 0.3) / teeth) * Math.PI * 2, a2 = ((i + 0.5) / teeth) * Math.PI * 2, a3 = ((i + 0.8) / teeth) * Math.PI * 2; const R = r * 1.18; pts.push(`${(cx + r * Math.cos(a0)).toFixed(1)},${(cy + r * Math.sin(a0)).toFixed(1)}`, `${(cx + R * Math.cos(a1)).toFixed(1)},${(cy + R * Math.sin(a1)).toFixed(1)}`, `${(cx + R * Math.cos(a2)).toFixed(1)},${(cy + R * Math.sin(a2)).toFixed(1)}`, `${(cx + r * Math.cos(a3)).toFixed(1)},${(cy + r * Math.sin(a3)).toFixed(1)}`); }
  return <g className={spin ? 'pj-spin' : undefined} style={{ transformOrigin: `${cx}px ${cy}px`, transform: `rotate(${rot}deg)` }}><polygon points={pts.join(' ')} fill={fill} stroke={INK} strokeWidth="4" strokeLinejoin="round" /><circle cx={cx} cy={cy} r={r * 0.4} fill="#14233a" stroke={INK} strokeWidth="4" /><circle cx={cx} cy={cy} r={r * 0.15} fill={fill} stroke={INK} strokeWidth="3" /></g>;
}

function Leviathan({ b, hit }: { b: BossG['boss']; hit: boolean }) {
  return (
    <g>
      <path d="M200 520Q260 330 520 300Q760 270 920 330Q1040 370 1080 470L1040 540H240Z" fill="#6f7f8e" stroke={INK} strokeWidth="6" strokeLinejoin="round" />
      <path d="M200 520Q260 330 520 300Q760 270 920 330Q1040 370 1080 470L1040 540H240Z" fill="url(#pj-hatch)" />
      <path d="M1080 470Q1150 430 1180 360Q1130 360 1110 330Q1100 400 1040 430Z" fill="#b8742b" stroke={INK} strokeWidth="5" strokeLinejoin="round" />
      <path d="M260 340Q220 250 160 240Q190 290 180 350Z" fill="#b8742b" stroke={INK} strokeWidth="5" strokeLinejoin="round" />
      {b.armor > 0 && !b.exposed && Array.from({ length: Math.min(b.armor, 8) }, (_, i) => <path key={i} d={`M${330 + i * 85} ${380 - Math.sin(i / 2) * 22}h74l12 70h-98z`} fill="#c9923f" stroke={INK} strokeWidth="5" strokeLinejoin="round" />)}
      <Gear cx={640} cy={430} r={78} spin teeth={14} fill="#e7b655" />
      <Gear cx={780} cy={380} r={42} spin teeth={9} fill="#c98f3a" rot={20} />
      <circle cx={640} cy={430} r={26} fill={b.exposed ? '#7be0ff' : '#34475e'} stroke={INK} strokeWidth="5" className={b.exposed ? 'pj-glow' : undefined} />
      <g transform="translate(0 4)">{Array.from({ length: 7 }, (_, i) => <circle key={i} cx={300 + i * 110} cy={490} r="9" fill="#cfd8e0" stroke={INK} strokeWidth="3.5" />)}</g>
      {hit && <path d="M560 360l30-60 22 50 40-40-4 70 56-10-50 46z" fill="#fff4d6" stroke={INK} strokeWidth="5" strokeLinejoin="round" className="pj-hit" />}
    </g>
  );
}
function Colossus({ b, hit }: { b: BossG['boss']; hit: boolean }) {
  const shelves = [[470, 250, 340, 60], [450, 320, 380, 60], [430, 390, 420, 60], [430, 460, 420, 60]];
  return (
    <g>
      <rect x="380" y="505" width="520" height="40" fill="#46506b" stroke={INK} strokeWidth="5" />
      {shelves.map(([x, y, w, h], i) => (
        <g key={i}><rect x={x} y={y} width={w} height={h} fill="#8d6b4a" stroke={INK} strokeWidth="5" />{Array.from({ length: Math.floor(w! / 26) }, (_, k) => <rect key={k} x={x! + 6 + k * 26} y={y! + 8} width="18" height={h! - 14} fill={['#d9534f', '#e8b04a', '#4f8fc0', '#5aa66a'][(k + i) % 4]} stroke={INK} strokeWidth="3" />)}</g>
      ))}
      <path d="M440 300H330L290 440H380M840 300H950L990 440H900" fill="none" stroke={INK} strokeWidth="26" strokeLinecap="round" strokeLinejoin="round" /><path d="M440 300H330L290 440H380M840 300H950L990 440H900" fill="none" stroke="#a27d56" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
      <g>{[560, 640, 720].map((x, i) => <g key={i}><circle cx={x} cy="190" r="34" fill={b.exposed ? '#ffe27b' : '#2b3550'} stroke={INK} strokeWidth="5" /><path d={`M${x - 10} 190h20M${x} 180v20`} stroke={INK} strokeWidth="4" /></g>)}</g>
      <rect x="520" y="130" width="240" height="26" fill="#6f4f34" stroke={INK} strokeWidth="5" />
      {b.armor > 0 && !b.exposed && <rect x="470" y="250" width="340" height="60" fill="url(#pj-dots)" opacity=".7" />}
      {hit && <path d="M560 360l30-60 22 50 40-40-4 70 56-10-50 46z" fill="#fff4d6" stroke={INK} strokeWidth="5" strokeLinejoin="round" className="pj-hit" />}
    </g>
  );
}
function StormEngine({ b, hit }: { b: BossG['boss']; hit: boolean }) {
  return (
    <g>
      <path d="M450 540L500 420H780L830 540Z" fill="#3a4a63" stroke={INK} strokeWidth="6" strokeLinejoin="round" />
      <path d="M520 420L560 250H720L760 420Z" fill="#6e7d91" stroke={INK} strokeWidth="6" strokeLinejoin="round" />
      <polygon points="640,170 720,215 720,305 640,350 560,305 560,215" fill="#d8a447" stroke={INK} strokeWidth="6" strokeLinejoin="round" />
      <circle cx="640" cy="260" r="40" fill={b.exposed ? '#eafcff' : '#28d1d4'} stroke={INK} strokeWidth="5" className="pj-glow" />
      <circle cx="640" cy="260" r="18" fill="#0b1831" stroke={INK} strokeWidth="4" />
      {[[-1, 0], [1, 0]].map(([s], i) => <g key={i} transform={`translate(${640 + s! * 230} 330) scale(${s} 1)`}><path d="M-110 -40L-30 -90L40 -60L10 40L-80 60Z" fill="#c4584a" stroke={INK} strokeWidth="6" strokeLinejoin="round" /><path d="M-80 -20L-20 -60L20 -40" fill="none" stroke={INK} strokeWidth="4" /></g>)}
      {Array.from({ length: 5 }, (_, i) => <path key={i} d={`M${420 + i * 110} 130l-18 44h22l-16 48`} fill="none" stroke="#ffe27b" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" opacity=".85" className="pj-flicker" />)}
      {hit && <path d="M560 360l30-60 22 50 40-40-4 70 56-10-50 46z" fill="#fff4d6" stroke={INK} strokeWidth="5" strokeLinejoin="round" className="pj-hit" />}
    </g>
  );
}

export default function BossScene({ core, g, locale }: { core: Core; g: BossG; locale: Locale }) {
  const b = g.boss; const def = BOSSES[b.id];
  const hit = core.fx?.kind === 'hit' || core.fx?.kind === 'strike';
  const sky = b.id === 'storm_engine' ? ['#0b1831', '#162a4f'] : b.id === 'library_colossus' ? ['#1d1730', '#2c2147'] : ['#0b1d33', '#10304a'];
  const form = def.forms[Math.min(b.phase, 3) - 1]!;
  const tel = b.telegraph;
  return (
    <svg className="pj-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${L(locale, def.name)}. ${tr(locale, 'bossHp')} ${b.hp}/${b.maxHp}. ${tr(locale, 'phase', { n: b.phase })}`} preserveAspectRatio="xMidYMid meet">
      <Defs id="pj" />
      <rect width={W} height={H} fill={sky[0]} /><rect y="260" width={W} height="460" fill={sky[1]} />
      <rect width={W} height={H} fill="url(#pj-dots)" opacity=".6" />
      {Array.from({ length: 9 }, (_, i) => <path key={i} d={`M${60 + i * 150} 0L${20 + i * 150} 720`} stroke="#fff" strokeWidth="2" opacity=".06" />)}
      <path d="M0 560L90 520L200 560L330 510L470 565L620 520L760 560L900 505L1060 560L1180 520L1280 560V720H0Z" fill="#1c2a45" stroke={INK} strokeWidth="5" />
      <path d="M0 620L140 590L300 625L480 590L690 630L900 590L1100 625L1280 595V720H0Z" fill="#26375a" stroke={INK} strokeWidth="5" />
      {b.id === 'clockwork_leviathan' ? <Leviathan b={b} hit={hit} /> : b.id === 'library_colossus' ? <Colossus b={b} hit={hit} /> : <StormEngine b={b} hit={hit} />}
      {b.barrier > 0 && <g className="pj-glow"><polygon points="640,110 880,250 880,500 640,640 400,500 400,250" fill="#28d1d4" opacity=".16" stroke="#28d1d4" strokeWidth="6" strokeDasharray="14 8" /><text x="640" y="104" textAnchor="middle" fontSize="22" fontWeight="800" fill="#bff7ff" stroke={INK} strokeWidth="5" paintOrder="stroke" fontFamily="var(--qz-display)">{b.barrier}/{b.barrierMax}</text></g>}
      {(b.exposed || b.weakTopic) && (
        <g transform="translate(900 190)"><circle r="40" fill="none" stroke="#ffe27b" strokeWidth="6" className="pj-pulse" /><circle r="22" fill="none" stroke="#ffe27b" strokeWidth="5" /><circle r="7" fill="#ffe27b" stroke={INK} strokeWidth="3" /><path d="M-52 0H-30M30 0H52M0 -52V-30M0 30V52" stroke="#ffe27b" strokeWidth="5" /></g>
      )}
      {/* header: name, phase, HP */}
      <g transform="translate(40 36)">
        <text fontSize="44" fontWeight="900" fontStyle="italic" fill="#fff4d6" stroke={INK} strokeWidth="8" paintOrder="stroke" fontFamily="var(--qz-display)" letterSpacing="1">{L(locale, def.name).toUpperCase()}</text>
        <text y="30" fontSize="20" fontWeight="700" fill="#28d1d4" stroke={INK} strokeWidth="5" paintOrder="stroke" fontFamily="var(--qz-display)" letterSpacing="2">{tr(locale, 'phase', { n: b.phase }).toUpperCase()} / {b.phases} · {L(locale, form).toUpperCase()}</text>
      </g>
      <g transform="translate(40 96)"><rect width="620" height="30" fill="#0b1018" stroke={INK} strokeWidth="5" /><rect x="3" y="3" width={614 * pct(b.hp, b.maxHp)} height="24" fill="#ff664a" />
        {b.phases > 1 && Array.from({ length: b.phases - 1 }, (_, i) => <path key={i} d={`M${620 * (1 - (i + 1) / b.phases)} -4V34`} stroke="#fff4d6" strokeWidth="4" />)}
        <text x="310" y="23" textAnchor="middle" fontSize="20" fontWeight="800" fill="#fff" stroke={INK} strokeWidth="5" paintOrder="stroke" fontFamily="var(--qz-display)">{b.hp} / {b.maxHp}</text></g>
      {/* telegraph */}
      <g transform="translate(40 150)"><rect width="300" height="48" fill="#fff4d6" stroke={INK} strokeWidth="5" /><path d="M0 0H48V48H0Z" fill="#ff664a" stroke={INK} strokeWidth="5" />
        <path d={tel.kind === 'attack' ? 'M10 36L38 12M24 12H38V26' : tel.kind === 'surge' ? 'M26 8L14 28H24L20 42L36 20H26Z' : tel.kind === 'barrier' ? 'M24 8L40 16V30L24 42L8 30V16Z' : 'M24 10a14 14 0 1 0 .1 0M24 18a6 6 0 1 0 .1 0'} fill="none" stroke={INK} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
        <text x="60" y="22" fontSize="14" fontWeight="800" fill={INK} fontFamily="var(--qz-display)" letterSpacing="1.5">{tr(locale, 'telegraph', { k: '' }).toUpperCase()}</text>
        <text x="60" y="41" fontSize="21" fontWeight="800" fill={INK} fontFamily="var(--qz-display)">{L(locale, KIND_LABEL[tel.kind]).toUpperCase()}{tel.topic ? ` · ${tel.topic}` : ''}</text></g>
      {b.weakTopic && <g transform="translate(900 244)"><text textAnchor="middle" fontSize="22" fontWeight="800" fill="#ffe27b" stroke={INK} strokeWidth="5" paintOrder="stroke" fontFamily="var(--qz-display)">{tr(locale, 'weakPoint', { t: b.weakTopic })}</text></g>}
      {/* class resources */}
      <g transform="translate(40 600)">
        <text fontSize="18" fontWeight="800" fill="#fff4d6" stroke={INK} strokeWidth="5" paintOrder="stroke" fontFamily="var(--qz-display)" letterSpacing="1.5">{tr(locale, 'classHp').toUpperCase()}</text>
        {Array.from({ length: g.shared.hpMax || CLASS_HP }, (_, i) => <g key={i} transform={`translate(${i * 36} 10)`}><rect width="30" height="30" rx="4" fill={i < g.shared.hp ? '#5fd38d' : '#1b2a3d'} stroke={INK} strokeWidth="4" /><path d="M8 15H22M15 8V22" stroke={i < g.shared.hp ? INK : '#42546b'} strokeWidth="4" /></g>)}
        <text y="76" fontSize="18" fontWeight="800" fill="#fff4d6" stroke={INK} strokeWidth="5" paintOrder="stroke" fontFamily="var(--qz-display)" letterSpacing="1.5">{tr(locale, 'shield').toUpperCase()}</text>
        {Array.from({ length: SHIELD_CAP }, (_, i) => <g key={i} transform={`translate(${i * 36} 86)`}><path d="M0 0H30V18L15 32L0 18Z" fill={i < g.shared.shield ? '#28d1d4' : '#1b2a3d'} stroke={INK} strokeWidth="4" strokeLinejoin="round" /></g>)}
      </g>
      {/* team roles */}
      <g transform="translate(1240 640)" textAnchor="end">
        {core.teams.map((t, i) => { const bt = g.teams[t.id]; if (!bt) return null; const st = teamStyle(i); return <g key={t.id} transform={`translate(${-i * 0} ${-i * 38})`}><rect x="-250" y="-26" width="250" height="32" fill={`url(#pj-tp${i % 8})`} stroke={INK} strokeWidth="4" /><text x="-8" y="-3" fontSize="18" fontWeight="800" fill="#fff" stroke={INK} strokeWidth="4" paintOrder="stroke" fontFamily="var(--qz-display)">{i + 1} · {t.name} · {bt.chosen ? tr(locale, bt.chosen) : bt.role}</text><title>{st.n}</title></g>; })}
      </g>
    </svg>
  );
}
