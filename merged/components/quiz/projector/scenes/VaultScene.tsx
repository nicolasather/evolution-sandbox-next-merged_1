'use client';
import { DOORS, type DoorMech, type Shape } from '@/lib/quiz/projector/content/vault-doors';
import type { Vault, VaultG } from '@/lib/quiz/projector/reducers/vault';
import type { Core, Locale } from '@/lib/quiz/projector/types';
import { L, tr } from '../i18n';
import { Defs, INK, ShapeGlyph } from './shared';

const W = 1280, H = 720; const GOLD = '#f2c565', PATINA = '#188984', VERM = '#e96b4b', PARCH = '#f9e9c7';

function Mech({ id, cx, cy, r, open }: { id: DoorMech; cx: number; cy: number; r: number; open: boolean }) {
  const s = { stroke: INK, strokeWidth: 3.4, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  const ticks = (n: number, r1: number, r2: number) => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return `M${cx + r1 * Math.cos(a)} ${cy + r1 * Math.sin(a)}L${cx + r2 * Math.cos(a)} ${cy + r2 * Math.sin(a)}`; }).join('');
  switch (id) {
    case 'dial': return <g><circle cx={cx} cy={cy} r={r * 0.62} fill={PARCH} {...s} /><path d={ticks(16, r * 0.5, r * 0.62)} fill="none" {...s} /><path d={`M${cx} ${cy}L${cx + r * 0.32} ${cy - r * 0.3}`} fill="none" {...s} strokeWidth="5" /><circle cx={cx} cy={cy} r={r * 0.1} fill={VERM} {...s} /></g>;
    case 'geartrain': return <g>{[[-0.28, 0.1, 0.34], [0.26, -0.12, 0.25]].map(([dx, dy, rr], i) => <g key={i}><circle cx={cx + dx! * r} cy={cy + dy! * r} r={rr! * r} fill={i ? PATINA : GOLD} {...s} /><path d={ticks(10, rr! * r, rr! * r * 1.25).replace(/M([\d.-]+) ([\d.-]+)L/g, (_, a, b) => `M${+a + dx! * r - 0} ${+b + dy! * r - 0}L`)} fill="none" {...s} opacity="0" /><circle cx={cx + dx! * r} cy={cy + dy! * r} r={rr! * r * 0.3} fill={INK} /></g>)}</g>;
    case 'prism': return <g><path d={`M${cx} ${cy - r * 0.5}L${cx + r * 0.45} ${cy + r * 0.34}H${cx - r * 0.45}Z`} fill="#bfe8f4" {...s} /><path d={`M${cx + r * 0.2} ${cy - r * 0.1}l${r * 0.38} -${r * 0.1}M${cx + r * 0.24} ${cy + r * 0.05}l${r * 0.4} ${r * 0.04}M${cx + r * 0.28} ${cy + r * 0.2}l${r * 0.36} ${r * 0.16}`} fill="none" stroke={VERM} strokeWidth="4" strokeLinecap="round" /></g>;
    case 'rotor': return <g><rect x={cx - r * 0.5} y={cy - r * 0.3} width={r} height={r * 0.6} rx={r * 0.08} fill={GOLD} {...s} />{[-0.25, 0, 0.25].map((k) => <path key={k} d={`M${cx + r * k} ${cy - r * 0.3}V${cy + r * 0.3}`} {...s} fill="none" />)}</g>;
    case 'pins': return <g>{[-0.36, -0.12, 0.12, 0.36].map((k, i) => <g key={i}><rect x={cx + k * r - r * 0.06} y={cy - r * 0.42} width={r * 0.12} height={r * (0.5 + (i % 2) * 0.28)} fill={PARCH} {...s} /><circle cx={cx + k * r} cy={cy - r * 0.42} r={r * 0.07} fill={GOLD} {...s} /></g>)}</g>;
    case 'plates': return <g>{[-0.32, -0.04, 0.24].map((k, i) => <rect key={i} x={cx - r * 0.5 + (i % 2) * r * 0.22} y={cy + k * r - r * 0.1} width={r * 0.8} height={r * 0.2} fill={i === 1 ? PATINA : GOLD} {...s} />)}</g>;
    case 'cardslot': return <g><rect x={cx - r * 0.5} y={cy - r * 0.1} width={r} height={r * 0.2} rx="3" fill={INK} /><rect x={cx - r * 0.3} y={cy - r * 0.5} width={r * 0.6} height={r * 0.7} fill={PARCH} {...s} /><path d={`M${cx - r * 0.2} ${cy - r * 0.3}h${r * 0.4}M${cx - r * 0.2} ${cy - r * 0.15}h${r * 0.25}`} {...s} fill="none" /></g>;
    case 'clockwork': return <g><circle cx={cx} cy={cy} r={r * 0.5} fill={PARCH} {...s} /><path d={`M${cx} ${cy - r * 0.34}V${cy}H${cx + r * 0.22}`} fill="none" {...s} strokeWidth="5" /><path d={ticks(12, r * 0.4, r * 0.47)} fill="none" {...s} strokeWidth="2.6" /></g>;
    case 'pressure': return <g>{[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b], i) => <rect key={i} x={cx + a! * r * 0.3 - r * 0.16} y={cy + b! * r * 0.3 - r * 0.16} width={r * 0.32} height={r * 0.32} fill={open || i % 2 ? VERM : GOLD} {...s} />)}</g>;
    case 'levers': return <g>{[-0.3, 0, 0.3].map((k, i) => <g key={i}><path d={`M${cx + k * r} ${cy + r * 0.34}V${cy - r * (0.1 + (i % 2) * 0.22)}`} {...s} strokeWidth="6" fill="none" /><circle cx={cx + k * r} cy={cy - r * (0.1 + (i % 2) * 0.22)} r={r * 0.1} fill={VERM} {...s} /></g>)}</g>;
    case 'hinge': return <g>{[-0.3, 0.3].map((k, i) => <g key={i}><rect x={cx - r * 0.5} y={cy + k * r - r * 0.12} width={r} height={r * 0.24} rx={r * 0.12} fill={GOLD} {...s} /><circle cx={cx - r * 0.38} cy={cy + k * r} r={r * 0.05} fill={INK} /><circle cx={cx + r * 0.38} cy={cy + k * r} r={r * 0.05} fill={INK} /></g>)}</g>;
    default: return <g>{[0.55, 0.38, 0.2].map((k, i) => <circle key={i} cx={cx} cy={cy} r={r * k} fill={i % 2 ? PARCH : GOLD} {...s} />)}<path d={`M${cx} ${cy - r * 0.55}V${cy - r * 0.2}`} {...s} fill="none" strokeWidth="5" /></g>;
  }
}

function Door({ v, cx, cy, r, selected, locale, onPick, fx }: { v: Vault; cx: number; cy: number; r: number; selected: boolean; locale: Locale; onPick?: () => void; fx: boolean }) {
  const name = DOORS.find((d) => d.id === v.door)!.name;
  const need = v.req;
  const gap = 24;
  return (
    <g onClick={onPick} style={onPick ? { cursor: 'pointer' } : undefined} role={onPick ? 'button' : undefined} tabIndex={onPick ? 0 : undefined} onKeyDown={onPick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(); } } : undefined}
      aria-label={`${tr(locale, 'openVault')} ${v.id.toUpperCase()}: ${L(locale, name)}. ${v.opened ? tr(locale, 'opened') : tr(locale, 'locked')}. ${v.topic ?? ''}`}>
      <circle cx={cx + 4} cy={cy + 5} r={r + 8} fill={INK} opacity=".5" />
      <circle cx={cx} cy={cy} r={r + 8} fill="#31456b" stroke={INK} strokeWidth="5" />
      <circle cx={cx} cy={cy} r={r} fill={v.opened ? '#0c1b2f' : '#bd8f3a'} stroke={INK} strokeWidth="5" />
      {!v.opened && <><circle cx={cx} cy={cy} r={r * 0.86} fill="none" stroke={INK} strokeWidth="2.5" strokeDasharray="3 7" opacity=".7" /><Mech id={v.door} cx={cx} cy={cy} r={r} open={false} /></>}
      {v.opened && <g><path d={`M${cx - r * 0.9} ${cy}A${r * 0.9} ${r * 0.9} 0 0 1 ${cx + r * 0.9} ${cy}Z`} fill={GOLD} opacity=".25" /><polygon points={`${cx},${cy - r * 0.5} ${cx + r * 0.36},${cy - r * 0.1} ${cx},${cy + r * 0.42} ${cx - r * 0.36},${cy - r * 0.1}`} fill="#7be0ff" stroke={INK} strokeWidth="4" strokeLinejoin="round" /><text x={cx} y={cy + r * 0.82} textAnchor="middle" fontSize="22" fontWeight="900" fill={GOLD} stroke={INK} strokeWidth="5" paintOrder="stroke" fontFamily="var(--qz-display)">+{v.reward}</text></g>}
      {!v.opened && need.map((sh: Shape, i: number) => <g key={i}><rect x={cx - (need.length * gap) / 2 + i * gap + 1} y={cy + r + 20} width={gap - 2} height={gap - 2} rx="4" fill="#0e1a2e" stroke={INK} strokeWidth="3" /><ShapeGlyph shape={sh} x={cx - (need.length * gap) / 2 + i * gap + gap / 2} y={cy + r + 20 + gap / 2 - 1} r={7} /></g>)}
      <text x={cx} y={cy - r - 18} textAnchor="middle" fontSize="20" fontWeight="800" fill={PARCH} stroke={INK} strokeWidth="5" paintOrder="stroke" fontFamily="var(--qz-display)" letterSpacing="1.2">{v.id.toUpperCase()}{v.topic ? ` · ${v.topic}` : ''}</text>
      {(selected || fx) && <circle cx={cx} cy={cy} r={r + 18} fill="none" stroke="#ffd52f" strokeWidth="6" strokeDasharray="14 8" className="pj-pulse" />}
    </g>
  );
}

export type VaultProps = { core: Core; g: VaultG; locale: Locale; onVault?: (id: string) => void };
export default function VaultScene({ core, g, locale, onVault }: VaultProps) {
  const n = g.vaults.length; const perRow = n <= 6 ? n : Math.ceil(n / 2); const rows = n <= 6 ? 1 : 2;
  const r = Math.min(52, (W - 160) / perRow / 2 - 18);
  const fxRef = core.fx && ['vault', 'open'].includes(core.fx.kind) ? String(core.fx.ref ?? '') : '';
  const grandY = 150, grandR = 108;
  const opened = g.vaults.filter((v) => v.opened).length;
  return (
    <svg className="pj-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${tr(locale, 'grand')}. ${opened}/${g.grand.need}`} preserveAspectRatio="xMidYMid meet">
      <Defs id="pj" />
      <rect width={W} height={H} fill="#14223d" />
      {Array.from({ length: 17 }, (_, i) => <path key={`v${i}`} d={`M${i * 80} 0V${H}`} stroke="#fff" strokeWidth="1.5" opacity=".07" />)}{Array.from({ length: 10 }, (_, i) => <path key={`h${i}`} d={`M0 ${i * 80}H${W}`} stroke="#fff" strokeWidth="1.5" opacity=".07" />)}
      <rect width={W} height={H} fill="url(#pj-dots)" opacity=".6" />
      {/* side rails with riveted plates */}
      {[24, W - 76].map((x) => <g key={x}><rect x={x} y="20" width="52" height={H - 40} rx="8" fill="#8a6a3c" stroke={INK} strokeWidth="5" />{Array.from({ length: 9 }, (_, i) => <rect key={i} x={x + 10} y={40 + i * 74} width="32" height="22" rx="3" fill={GOLD} stroke={INK} strokeWidth="3.5" />)}</g>)}
      {/* grand vault */}
      <g aria-label={tr(locale, 'grand')}>
        <circle cx={W / 2 + 6} cy={grandY + 6} r={grandR + 22} fill={INK} opacity=".5" />
        <circle cx={W / 2} cy={grandY} r={grandR + 22} fill="#31456b" stroke={INK} strokeWidth="6" />
        <circle cx={W / 2} cy={grandY} r={grandR} fill={g.grand.opened ? '#0c1b2f' : GOLD} stroke={INK} strokeWidth="6" />
        {Array.from({ length: 24 }, (_, i) => { const a = (i / 24) * Math.PI * 2; return <circle key={i} cx={W / 2 + (grandR - 14) * Math.cos(a)} cy={grandY + (grandR - 14) * Math.sin(a)} r="5" fill="#d79a3c" stroke={INK} strokeWidth="2.5" />; })}
        <circle cx={W / 2} cy={grandY} r={grandR * 0.62} fill={g.grand.opened ? '#0c1b2f' : '#b9d6cf'} stroke={INK} strokeWidth="6" />
        {!g.grand.opened ? <><polygon points={`${W / 2},${grandY - 40} ${W / 2 + 40},${grandY} ${W / 2},${grandY + 40} ${W / 2 - 40},${grandY}`} fill={PATINA} stroke={INK} strokeWidth="5" /><circle cx={W / 2} cy={grandY} r="12" fill={GOLD} stroke={INK} strokeWidth="4" /></>
          : <text x={W / 2} y={grandY + 14} textAnchor="middle" fontSize="40" fontWeight="900" fill={GOLD} stroke={INK} strokeWidth="6" paintOrder="stroke" fontFamily="var(--qz-display)">+{g.grand.reward}</text>}
        <text x={W / 2} y={grandY - grandR - 34} textAnchor="middle" fontSize="26" fontWeight="900" fill={PARCH} stroke={INK} strokeWidth="6" paintOrder="stroke" fontFamily="var(--qz-display)" letterSpacing="2">{tr(locale, 'grand').toUpperCase()} · {Math.min(opened, g.grand.need)}/{g.grand.need}</text>
      </g>
      {g.vaults.map((v, i) => {
        const row = Math.floor(i / perRow); const col = i % perRow; const inRow = row === rows - 1 ? n - row * perRow : perRow;
        const sp = (W - 200) / Math.max(inRow, 1); const cx = 100 + sp * (col + 0.5) + (W - 200 - sp * inRow) / 2; const cy = (rows === 1 ? 470 : 395) + row * 165;
        return <Door key={v.id} v={v} cx={cx} cy={cy} r={r} selected={g.selected === v.id} fx={fxRef === v.id} locale={locale} onPick={onVault ? () => onVault(v.id) : undefined} />;
      })}
      <g transform="translate(40 40)" aria-hidden><text fontSize="34" fontWeight="900" fontStyle="italic" fill={PARCH} stroke={INK} strokeWidth="7" paintOrder="stroke" fontFamily="var(--qz-display)">{tr(locale, 'openVault').toUpperCase()}</text></g>
      {core.teams.length > 0 && null}
    </svg>
  );
}
