'use client';
/** Illustrated scenes for the five newer projector games. Pure SVG, object and environment art, no faces. Everything drawn comes from the PUBLIC state,
 *  so the projector can never show a hidden lot value, a sealed paddle or an uncharted chest. 3-6px ink strokes, team colour AND pattern AND number. */
import type { Core } from '@/lib/quiz/projector/types';
import type { AuctionG, LotKind } from '@/lib/quiz/projector/reducers/auction';
import { COLLECTION_BONUS } from '@/lib/quiz/projector/reducers/auction';
import { legalTargets, supplied, WALL_MAX, type TerritoryG, type TerritoryCell } from '@/lib/quiz/projector/reducers/territory';
import { MACHINE_KINDS, OUTPUT, breakdownVictim, previewShift, type FactoryG, type FactoryEvent, type MachineKind } from '@/lib/quiz/projector/reducers/factory';
import type { PirateG } from '@/lib/quiz/projector/reducers/pirate';
import { STAGES, BASE, isTrailing, type ShowdownG, type ShowdownStage } from '@/lib/quiz/projector/reducers/showdown';
import { Defs, Flag, INK, Pulse, teamStyle } from './shared';

const actorId = (core: Core) => (core.askMode === 'all' ? null : core.teams[core.actor % core.teams.length]!.id);
const idx = (core: Core, id: string) => core.teams.findIndex((t) => t.id === id);
const Plate = ({ x, y, w, children, fill = '#fff6d8', size = 20 }: { x: number; y: number; w: number; children: React.ReactNode; fill?: string; size?: number }) => (
  <g><rect x={x - w / 2} y={y - size * 0.85} width={w} height={size * 1.5} rx={8} fill={fill} stroke={INK} strokeWidth="4" /><text x={x} y={y + size * 0.2} textAnchor="middle" fontSize={size} fontWeight="900" fill={INK} fontFamily="var(--qz-display)">{children}</text></g>
);
const Chip = ({ i, x, y, r = 16 }: { i: number; x: number; y: number; r?: number }) => (
  <g><circle cx={x} cy={y} r={r} fill={`url(#pj-tp${i % 8})`} stroke={INK} strokeWidth="4" /><text x={x} y={y + r * 0.35} textAnchor="middle" fontSize={r * 1.05} fontWeight="900" fill="#fff" stroke={INK} strokeWidth="3" paintOrder="stroke" fontFamily="var(--qz-display)">{i + 1}</text></g>
);

/* ───────────────────────── AUCTION HOUSE ───────────────────────── */
const KIND_NAME: Record<LotKind, string> = { relic: 'Relic', artifact: 'Artifact', blueprint: 'Blueprint', wildcard: 'Wildcard' };
function LotArt({ kind, x, y }: { kind: LotKind; x: number; y: number }) {
  const s = { stroke: INK, strokeWidth: 4, strokeLinejoin: 'round' as const };
  if (kind === 'relic') return <g transform={`translate(${x} ${y})`}><path d="M-34 38C-52 4 -30 -22 -12 -30V-44H12V-30C30 -22 52 4 34 38Z" fill="#e9a23b" {...s} /><path d="M-24 8Q0 22 24 8" fill="none" stroke={INK} strokeWidth="4" /><path d="M-30 -48H30" stroke={INK} strokeWidth="8" strokeLinecap="round" /></g>;
  if (kind === 'artifact') return <g transform={`translate(${x} ${y})`}><path d="M0 -50L36 -14L0 46L-36 -14Z" fill="#6fd6f0" {...s} /><path d="M-36 -14H36M0 -50V46M-18 -14L0 46L18 -14" fill="none" stroke={INK} strokeWidth="3" /><path d="M-14 -34L-6 -24" stroke="#fff" strokeWidth="5" strokeLinecap="round" /></g>;
  if (kind === 'blueprint') return <g transform={`translate(${x} ${y})`}><rect x="-44" y="-30" width="88" height="62" rx="6" fill="#4d8ef0" {...s} /><path d="M-30 -14H30M-30 2H12M-30 18H24" stroke="#fff" strokeWidth="4" strokeLinecap="round" /><circle cx="26" cy="2" r="9" fill="none" stroke="#fff" strokeWidth="4" /><rect x="-48" y="-36" width="16" height="74" rx="8" fill="#e9d6a6" {...s} /></g>;
  return <g transform={`translate(${x} ${y})`}><rect x="-38" y="-30" width="76" height="66" rx="8" fill="#b57bf0" {...s} /><path d="M-38 -6H38M0 -30V36" stroke={INK} strokeWidth="4" /><path d="M0 -6C-26 -44 -42 -22 0 -6C42 -22 26 -44 0 -6Z" fill="#ffd23f" {...s} /></g>;
}
export function AuctionScene({ core, g, selected, onLot }: { core: Core; g: AuctionG; selected?: number | null; onLot?: (id: number) => void }) {
  const n = g.lineup.length; const slot = 1080 / Math.max(n, 1); const latest = g.latest; const act = actorId(core);
  const bids = Object.entries(g.bids);
  return (
    <svg viewBox="0 0 1280 720" role="img" aria-label={`Auction house, round ${g.round}. ${n} lots on the stage.`} className="pj-svg">
      <Defs id="pj" />
      <rect width="1280" height="720" fill="#402355" />
      <rect y="470" width="1280" height="250" fill="#2a1540" />
      <path d="M0 0H1280V60C1180 100 1090 40 980 90S760 100 640 70 400 100 300 80 90 100 0 60Z" fill="#c43a52" stroke={INK} strokeWidth="5" />
      {[100, 330, 560, 790, 1020, 1180].map((x, i) => <path key={i} d={`M${x} 0V${78 + (i % 2) * 14}`} stroke={INK} strokeWidth="4" opacity=".4" />)}
      <rect x="90" y="150" width="1100" height="270" rx="26" fill="#6b3a86" stroke={INK} strokeWidth="6" />
      <rect x="110" y="170" width="1060" height="230" rx="18" fill="#7d4a9c" stroke={INK} strokeWidth="4" strokeDasharray="14 10" />
      <text x="640" y="136" textAnchor="middle" fontSize="38" fontWeight="900" fill="#ffd23f" stroke={INK} strokeWidth="7" paintOrder="stroke" fontFamily="var(--qz-display)">ROUND {g.round} · {n} LOTS</text>
      {g.lineup.map((l, i) => {
        const x = 100 + slot * (i + 0.5); const sel = selected === l.id; const mine = bids.filter(([, b]) => b.lot === l.id);
        return (
          <g key={l.id} role={onLot ? 'button' : undefined} tabIndex={onLot ? 0 : undefined} aria-label={`Lot ${l.id}, ${KIND_NAME[l.kind]}, appraised ${l.low} to ${l.high}`} style={{ cursor: onLot ? 'pointer' : undefined }}
            onClick={() => onLot?.(l.id)} onKeyDown={(e) => { if (onLot && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onLot(l.id); } }}>
            <ellipse cx={x} cy={366} rx={slot * 0.36} ry="18" fill="#2a1540" stroke={INK} strokeWidth="4" />
            <rect x={x - slot * 0.34} y="320" width={slot * 0.68} height="48" rx="10" fill="#e8d2a0" stroke={sel ? '#ffd23f' : INK} strokeWidth={sel ? 8 : 4} />
            <LotArt kind={l.kind} x={x} y={262} />
            {sel && <Pulse cx={x} cy={262} r={74} />}
            <Plate x={x} y={348} w={slot * 0.6} size={19}>LOT {l.id}</Plate>
            <text x={x} y={398} textAnchor="middle" fontSize="19" fontWeight="800" fill="#fff" stroke={INK} strokeWidth="4" paintOrder="stroke">{KIND_NAME[l.kind]}{l.income > 0 ? ` +${l.income}/win` : ''}</text>
            <Plate x={x} y={204} w={170} fill="#ffd23f" size={18}>WORTH {l.low}–{l.high}</Plate>
            {mine.map(([team], k) => <Chip key={team} i={idx(core, team)} x={x - ((mine.length - 1) * 20) + k * 40} y={426} r={15} />)}
          </g>
        );
      })}
      {/* auctioneer's podium with the gavel */}
      <g transform="translate(640 560)">
        <path d="M-120 140L-96 0H96L120 140Z" fill="#8a5a2b" stroke={INK} strokeWidth="6" strokeLinejoin="round" />
        <rect x="-110" y="-12" width="220" height="24" rx="8" fill="#b57a3c" stroke={INK} strokeWidth="5" />
        <g transform="translate(36 -48) rotate(-24)"><rect x="-8" y="-6" width="16" height="64" rx="5" fill="#e0a85a" stroke={INK} strokeWidth="4" /><rect x="-30" y="-30" width="60" height="30" rx="8" fill="#e0a85a" stroke={INK} strokeWidth="5" /></g>
        <text y="82" textAnchor="middle" fontSize="26" fontWeight="900" fill="#fff6d8" stroke={INK} strokeWidth="5" paintOrder="stroke" fontFamily="var(--qz-display)">GAVEL AT END OF ROUND</text>
      </g>
      {/* bid paddles per team: sealed until the gavel */}
      {core.teams.map((t, i) => {
        const b = g.bids[t.id]; const at = g.teams[t.id]; const x = 70 + (i + 0.5) * (1140 / core.teams.length);
        return (
          <g key={t.id} opacity={act && act !== t.id ? 0.78 : 1}>
            <rect x={x - 6} y="508" width="12" height="70" rx="5" fill="#e8d2a0" stroke={INK} strokeWidth="4" />
            <rect x={x - 46} y="450" width="92" height="66" rx="14" fill={`url(#pj-tp${i % 8})`} stroke={act === t.id ? '#ffd23f' : INK} strokeWidth={act === t.id ? 8 : 5} />
            <text x={x} y="496" textAnchor="middle" fontSize="38" fontWeight="900" fill="#fff" stroke={INK} strokeWidth="6" paintOrder="stroke" fontFamily="var(--qz-display)">{i + 1}</text>
            <text x={x} y="604" textAnchor="middle" fontSize="18" fontWeight="800" fill="#fff" stroke={INK} strokeWidth="4" paintOrder="stroke">{b ? (b.amount > 0 ? `${b.amount} on lot ${b.lot}` : `lot ${b.lot} · sealed`) : at?.passed ? 'passed' : 'no bid yet'}</text>
            <text x={x} y="628" textAnchor="middle" fontSize="17" fontWeight="700" fill="#ffe9a8" stroke={INK} strokeWidth="4" paintOrder="stroke">{at ? `${at.points} pts${at.reserved ? ` (+${at.reserved} held)` : ''}` : ''}</text>
          </g>
        );
      })}
      {latest && (
        <g><rect x="250" y="654" width="780" height="50" rx="16" fill="#fff6d8" stroke={INK} strokeWidth="5" />
          <text x="640" y="688" textAnchor="middle" fontSize="23" fontWeight="900" fill={INK} fontFamily="var(--qz-display)">
            {latest.winner ? `SOLD · Lot ${latest.lot.id} ${KIND_NAME[latest.lot.kind]} to ${core.teams.find((t) => t.id === latest.winner)?.name ?? 'a team'} for ${latest.price}` : `NO SALE · Lot ${latest.lot.id} ${KIND_NAME[latest.lot.kind]} returns to the vault`}
          </text></g>
      )}
      <text x="1230" y="440" textAnchor="end" fontSize="16" fontWeight="800" fill="#ffe9a8" stroke={INK} strokeWidth="4" paintOrder="stroke">One of each kind = +{COLLECTION_BONUS}</text>
    </svg>
  );
}

/* ───────────────────────── TERRITORY WAR ───────────────────────── */
const TERRAIN_FILL: Record<TerritoryCell['terrain'], string> = { plain: '#cde99a', forest: '#7cc27a', hill: '#d6bd8a', water: '#59b6e6' };
export function TerritoryScene({ core, g, selected, onCell, locale: _l }: { core: Core; g: TerritoryG; selected?: number | null; onCell?: (id: number) => void; locale?: string }) {
  void _l;
  const act = actorId(core) ?? core.teams[0]!.id; const legal = core.phase === 'planning' ? legalTargets(g, act) : {};
  const sup = new Map(core.teams.map((t) => [t.id, supplied(g, t.id)]));
  const size = Math.min(1180 / g.width, 600 / g.height); const ox = (1280 - size * g.width) / 2; const oy = 70 + (600 - size * g.height) / 2;
  const mark: Record<string, string> = { capture: 'Capture', breach: 'Breach', seize: 'Seize', fortify: 'Fortify', landing: 'Land' };
  return (
    <svg viewBox="0 0 1280 720" role="img" aria-label={`Territory War, ${g.board} map, ${g.width} by ${g.height} squares`} className="pj-svg">
      <Defs id="pj" />
      <rect width="1280" height="720" fill="#204d48" />
      <rect x="20" y="20" width="1240" height="680" rx="26" fill="#2c6a60" stroke={INK} strokeWidth="6" />
      <text x="640" y="58" textAnchor="middle" fontSize="30" fontWeight="900" fill="#fff6d8" stroke={INK} strokeWidth="6" paintOrder="stroke" fontFamily="var(--qz-display)">{g.board === 'frontier' ? 'FRONTIER PLAINS' : g.board === 'canyon' ? 'CANYON CROSSING' : 'RIVER DELTA'}</text>
      {g.cells.map((c) => {
        const x = ox + c.x * size, y = oy + c.y * size; const cx = x + size / 2, cy = y + size / 2; const ti = c.owner ? idx(core, c.owner) : -1;
        const cut = c.owner ? !sup.get(c.owner)!.has(c.id) : false; const mv = legal[c.id]; const sel = selected === c.id;
        return (
          <g key={c.id} role={onCell && c.terrain !== 'water' ? 'button' : undefined} tabIndex={onCell && c.terrain !== 'water' ? 0 : undefined}
            aria-label={`Square ${c.x + 1},${c.y + 1}, ${c.terrain}${c.owner ? `, held by ${core.teams[ti]?.name}` : ', unclaimed'}${c.objective ? ', objective' : ''}${mv ? `, can ${mv}` : ''}`}
            style={{ cursor: onCell && c.terrain !== 'water' ? 'pointer' : undefined }} onClick={() => c.terrain !== 'water' && onCell?.(c.id)}
            onKeyDown={(e) => { if (onCell && c.terrain !== 'water' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onCell(c.id); } }}>
            <rect x={x + 2} y={y + 2} width={size - 4} height={size - 4} rx="9" fill={TERRAIN_FILL[c.terrain]} stroke={INK} strokeWidth="4" />
            {c.terrain === 'water' && <path d={`M${x + size * 0.2} ${cy}q${size * 0.15} -10 ${size * 0.3} 0t${size * 0.3} 0M${x + size * 0.25} ${cy + 16}q${size * 0.12} -8 ${size * 0.24} 0t${size * 0.24} 0`} fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".8" />}
            {c.terrain === 'forest' && [[-0.22, 0.12], [0.18, 0.16], [0, -0.18]].map(([a, b], k) => <path key={k} d={`M${cx + a! * size} ${cy + b! * size - 18}l14 28h-28z`} fill="#2f8a4c" stroke={INK} strokeWidth="3" />)}
            {c.terrain === 'hill' && <path d={`M${cx - size * 0.3} ${cy + size * 0.2}Q${cx} ${cy - size * 0.32} ${cx + size * 0.3} ${cy + size * 0.2}Z`} fill="#b99a5f" stroke={INK} strokeWidth="4" />}
            {c.owner && <rect x={x + 8} y={y + 8} width={size - 16} height={size - 16} rx="7" fill={`url(#pj-tp${ti % 8})`} opacity={cut ? 0.45 : 0.9} stroke={INK} strokeWidth="3" strokeDasharray={cut ? '8 6' : undefined} />}
            {c.owner && cut && <path d={`M${x + 14} ${y + 14}L${x + size - 14} ${y + size - 14}`} stroke={INK} strokeWidth="4" opacity=".5" />}
            {c.hq && <Flag i={idx(core, c.hq)} x={cx - 8} y={cy + 24} s={size / 80} label={`${core.teams[idx(core, c.hq)]?.name} headquarters`} />}
            {c.objective && <path d={`M${cx} ${y + 14}l7 14 16 2-12 11 3 16-14-8-14 8 3-16-12-11 16-2z`} transform={`translate(${size * 0.18} ${size * 0.04})`} fill="#ffd23f" stroke={INK} strokeWidth="3" strokeLinejoin="round" />}
            {c.wall > 0 && <g>{Array.from({ length: Math.min(c.wall, WALL_MAX) }, (_, k) => <rect key={k} x={x + 10 + k * 17} y={y + size - 20} width="14" height="12" rx="2" fill="#a59a8c" stroke={INK} strokeWidth="3" />)}</g>}
            {mv && <g><rect x={x + 3} y={y + 3} width={size - 6} height={size - 6} rx="9" fill="none" stroke="#fff" strokeWidth="6" strokeDasharray="10 7" className="pj-pulse" /><Plate x={cx} y={y + size - 8} w={size - 14} size={Math.max(11, size / 7)} fill="#ffd23f">{mark[mv]}</Plate></g>}
            {sel && <rect x={x} y={y} width={size} height={size} rx="11" fill="none" stroke="#ffd23f" strokeWidth="8" />}
          </g>
        );
      })}
      <g transform="translate(40 670)" fontSize="15" fontWeight="800" fill="#fff6d8" stroke={INK} strokeWidth="4" paintOrder="stroke">
        <text>Dashed square = cut off from its headquarters (worth 1) · Star = objective (worth 4) · Bricks = wall</text>
      </g>
    </svg>
  );
}

/* ───────────────────────── LUCKY FACTORY ───────────────────────── */
const EVENT_TXT: Record<FactoryEvent, { t: string; d: string; c: string }> = {
  clear: { t: 'Clear shift', d: 'Normal output', c: '#8bdfad' }, bonus: { t: 'Bonus shift', d: 'Output ×1.5', c: '#ffd23f' },
  shortage: { t: 'Parts shortage', d: 'Output halved', c: '#ff9a4a' }, breakdown: { t: 'Breakdown', d: 'One machine fails', c: '#ff5d4a' },
};
export const MACHINE_NAME: Record<MachineKind, string> = { conveyor: 'Conveyor', press: 'Press', reactor: 'Reactor', printer: 'Printer' };
function MachineArt({ kind, level, broken, x, y, targeted }: { kind: MachineKind; level: number; broken: boolean; x: number; y: number; targeted: boolean }) {
  const s = { stroke: INK, strokeWidth: 4, strokeLinejoin: 'round' as const }; const body = broken ? '#8b8f99' : '#52e6c4';
  return (
    <g transform={`translate(${x} ${y})`}>
      {kind === 'conveyor' && <g><rect x="-60" y="-10" width="120" height="46" rx="22" fill={body} {...s} />{[-34, 0, 34].map((a) => <circle key={a} cx={a} cy="13" r="10" fill="#fff6d8" {...s} />)}</g>}
      {kind === 'press' && <g><rect x="-44" y="22" width="88" height="22" rx="6" fill="#7e8aa0" {...s} /><rect x="-12" y="-52" width="24" height="52" fill="#7e8aa0" {...s} /><rect x="-46" y="-6" width="92" height="30" rx="8" fill={body} {...s} /><rect x="-52" y="-60" width="104" height="18" rx="8" fill={body} {...s} /></g>}
      {kind === 'reactor' && <g><rect x="-36" y="-10" width="72" height="54" rx="14" fill="#7e8aa0" {...s} /><path d="M-36 -10Q0 -76 36 -10Z" fill={body} {...s} /><circle cx="0" cy="22" r="14" fill={broken ? '#444' : '#ffd23f'} {...s} /></g>}
      {kind === 'printer' && <g><rect x="-54" y="-20" width="108" height="62" rx="12" fill={body} {...s} /><rect x="-36" y="-50" width="72" height="30" rx="6" fill="#fff6d8" {...s} /><path d="M-26 42V54H26V42" fill="#fff" {...s} /><circle cx="36" cy="2" r="7" fill="#ff5d4a" {...s} /></g>}
      {Array.from({ length: level }, (_, k) => <path key={k} d={`M${-26 + k * 26} 74l8 -14 8 14z`} fill="#ffd23f" {...s} />)}
      {broken && <g><path d="M-30 -30L30 40M30 -30L-30 40" stroke="#ff5d4a" strokeWidth="9" strokeLinecap="round" /><circle cx="22" cy="-64" r="12" fill="#555" opacity=".6" /><circle cx="36" cy="-84" r="9" fill="#555" opacity=".45" /></g>}
      {targeted && !broken && <g><circle r="76" fill="none" stroke="#ff5d4a" strokeWidth="6" strokeDasharray="10 7" className="pj-pulse" /><text y="-92" textAnchor="middle" fontSize="19" fontWeight="900" fill="#ffd8d0" stroke={INK} strokeWidth="5" paintOrder="stroke">WILL FAIL</text></g>}
    </g>
  );
}
export function FactoryScene({ core, g, selected, onMachine }: { core: Core; g: FactoryG; selected?: number | null; onMachine?: (i: number) => void }) {
  const act = actorId(core) ?? core.teams[0]!.id; const ti = idx(core, act); const t = g.teams[act]!; const pv = previewShift(g, t, ti);
  const victim = g.events[0] === 'breakdown' && !t.inspected ? breakdownVictim(t, ti, g.shift) : null;
  const step = 1040 / g.slots;
  return (
    <svg viewBox="0 0 1280 720" role="img" aria-label={`Lucky Factory, shift ${g.shift}. ${EVENT_TXT[g.events[0]!].t}.`} className="pj-svg">
      <Defs id="pj" />
      <rect width="1280" height="720" fill="#244950" />
      <path d="M0 150L120 90L240 150L360 90L480 150L600 90L720 150L840 90L960 150L1080 90L1200 150L1280 120V0H0Z" fill="#2f6a73" stroke={INK} strokeWidth="5" />
      <rect x="40" y="170" width="1200" height="430" rx="24" fill="#355f6a" stroke={INK} strokeWidth="6" />
      <rect x="64" y="194" width="1152" height="382" rx="14" fill="#2b4a55" stroke={INK} strokeWidth="4" strokeDasharray="16 10" />
      {/* event strip: this shift and the public forecast */}
      {g.events.map((e, i) => (
        <g key={i} transform={`translate(${50 + i * 405} 14)`}><rect width="385" height="62" rx="14" fill={EVENT_TXT[e].c} stroke={i === 0 ? '#fff' : INK} strokeWidth={i === 0 ? 7 : 4} opacity={i === 0 ? 1 : 0.85} />
          <text x="192" y="26" textAnchor="middle" fontSize="19" fontWeight="900" fill={INK} fontFamily="var(--qz-display)">{i === 0 ? `SHIFT ${g.shift}` : `SHIFT ${g.shift + i} FORECAST`}</text>
          <text x="192" y="50" textAnchor="middle" fontSize="19" fontWeight="800" fill={INK}>{EVENT_TXT[e].t} · {EVENT_TXT[e].d}</text></g>
      ))}
      <text x="640" y="238" textAnchor="middle" fontSize="26" fontWeight="900" fill="#fff6d8" stroke={INK} strokeWidth="6" paintOrder="stroke" fontFamily="var(--qz-display)">{core.teams[ti]!.name.toUpperCase()}’S LINE · {t.machines.length}/{g.slots} MACHINES</text>
      {/* conveyor belt */}
      <rect x="80" y="430" width="1120" height="34" rx="17" fill="#3a3f4a" stroke={INK} strokeWidth="5" />
      {Array.from({ length: 28 }, (_, k) => <rect key={k} x={96 + k * 40} y="438" width="22" height="18" rx="4" fill="#59606f" />)}
      {Array.from({ length: g.slots }, (_, i) => {
        const m = t.machines[i]; const x = 80 + step * (i + 0.5); const sel = selected === i;
        return (
          <g key={i} role={onMachine ? 'button' : undefined} tabIndex={onMachine ? 0 : undefined} aria-label={m ? `Machine ${i + 1}, ${MACHINE_NAME[m.kind]}, level ${m.level}${m.broken ? ', broken' : ''}` : `Empty slot ${i + 1}`}
            style={{ cursor: onMachine ? 'pointer' : undefined }} onClick={() => onMachine?.(i)} onKeyDown={(e) => { if (onMachine && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onMachine(i); } }}>
            <rect x={x - step * 0.45} y="270" width={step * 0.9} height="150" rx="14" fill={m ? '#4c7885' : '#3a5560'} stroke={sel ? '#ffd23f' : INK} strokeWidth={sel ? 8 : 4} strokeDasharray={m ? undefined : '10 8'} />
            {m ? <MachineArt kind={m.kind} level={m.level} broken={m.broken} x={x} y={340} targeted={victim === i} /> : <text x={x} y="350" textAnchor="middle" fontSize="19" fontWeight="800" fill="#cfe6ea">free slot</text>}
            {m && <text x={x} y="412" textAnchor="middle" fontSize="16" fontWeight="900" fill="#fff6d8" stroke={INK} strokeWidth="4" paintOrder="stroke">{MACHINE_NAME[m.kind]} L{m.level} · {m.broken ? 'broken' : `${OUTPUT[m.kind] * m.level}/shift`}</text>}
          </g>
        );
      })}
      {/* goods crate with the exact projected output */}
      <g transform="translate(1100 500)"><rect x="-70" y="-6" width="140" height="70" rx="10" fill="#d9a85a" stroke={INK} strokeWidth="5" /><path d="M-70 24H70M0 -6V64" stroke={INK} strokeWidth="4" /></g>
      <Plate x={640} y={520} w={760} size={23} fill={EVENT_TXT[g.events[0]!].c}>{`THIS SHIFT SHIPS ${pv.output}`}{pv.bonusPct ? `  ·  line bonus +${pv.bonusPct}%` : ''}{pv.saved ? '  ·  safety check on' : ''}</Plate>
      <text x="640" y="566" textAnchor="middle" fontSize="18" fontWeight="800" fill="#fff6d8" stroke={INK} strokeWidth="4" paintOrder="stroke">Four different working kinds = +25% · three kinds = +10% · goods ship only when the turn ends</text>
      {/* shipped scoreboard */}
      {core.teams.map((tm, i) => { const x = 70 + (i + 0.5) * (1140 / core.teams.length); const ft = g.teams[tm.id]!; return (
        <g key={tm.id} opacity={act === tm.id ? 1 : 0.85}><Chip i={i} x={x - 52} y={640} r={17} /><text x={x - 28} y="633" fontSize="21" fontWeight="900" fill="#fff6d8" stroke={INK} strokeWidth="5" paintOrder="stroke">{ft.shipped} shipped</text><text x={x - 28} y="658" fontSize="16" fontWeight="800" fill="#bfeee0" stroke={INK} strokeWidth="4" paintOrder="stroke">{ft.points} parts · {ft.machines.length} machines</text></g>
      ); })}
      {g.latest && <text x="640" y="688" textAnchor="middle" fontSize="17" fontWeight="800" fill="#ffe9a8" stroke={INK} strokeWidth="4" paintOrder="stroke">Last shipment: {core.teams.find((x) => x.id === g.latest!.team)?.name} shipped {g.latest.produced}{g.latest.broke !== null ? ` · machine ${g.latest.broke + 1} broke` : ''}{g.latest.saved ? ' · safety check saved a machine' : ''}</text>}
      {MACHINE_KINDS.length === 0 && null}
    </svg>
  );
}

/* ───────────────────────── PIRATE VOYAGE ───────────────────────── */
export function PirateScene({ core, g, selected, onIsland }: { core: Core; g: PirateG; selected?: number | null; onIsland?: (id: number) => void }) {
  const act = actorId(core) ?? core.teams[0]!.id; const here = g.teams[act]!.position;
  const edges = new Set<string>(); g.islands.forEach((a) => a.neighbors.forEach((b) => edges.add(a.id < b ? `${a.id}-${b}` : `${b}-${a.id}`)));
  const shipsAt = (id: number) => core.teams.filter((t) => g.teams[t.id]!.position === id);
  return (
    <svg viewBox="0 0 1280 720" role="img" aria-label={`Pirate Voyage chart with ${g.islands.length} islands, round ${g.round}`} className="pj-svg">
      <Defs id="pj" />
      <rect width="1280" height="720" fill="#174a6a" />
      <rect x="18" y="18" width="1244" height="684" rx="26" fill="#1f6d96" stroke={INK} strokeWidth="6" />
      {[0, 1, 2, 3, 4, 5].map((k) => <path key={k} d={`M${60 + k * 210} ${660 - (k % 2) * 30}q22 -14 44 0t44 0`} fill="none" stroke="#9fe0ff" strokeWidth="4" strokeLinecap="round" opacity=".5" />)}
      <path d="M1100 80l16 -26 16 26-16 8z" fill="none" />
      <g transform="translate(1210 90)"><circle r="44" fill="#fff6d8" stroke={INK} strokeWidth="5" /><path d="M0 -38L10 0L0 38L-10 0Z" fill="#e8453c" stroke={INK} strokeWidth="3" /><path d="M-38 0L0 -10L38 0L0 10Z" fill="#fff" stroke={INK} strokeWidth="3" /><text y="-48" textAnchor="middle" fontSize="18" fontWeight="900" fill="#fff6d8" stroke={INK} strokeWidth="4" paintOrder="stroke">N</text></g>
      {[...edges].map((e) => { const [a, b] = e.split('-').map(Number) as [number, number]; const A = g.islands[a]!, B = g.islands[b]!; const hot = (a === here || b === here); return <path key={e} d={`M${A.x} ${A.y}L${B.x} ${B.y}`} stroke={hot ? '#ffd23f' : '#fff6d8'} strokeWidth={hot ? 6 : 4} strokeDasharray="4 12" strokeLinecap="round" opacity={hot ? 1 : 0.55} />; })}
      {g.islands.map((isl) => {
        const sel = selected === isl.id; const adj = g.islands[here]!.neighbors.includes(isl.id); const storm = g.storms.includes(isl.id); const next = g.nextStorms.includes(isl.id); const ships = shipsAt(isl.id);
        return (
          <g key={isl.id} role={onIsland ? 'button' : undefined} tabIndex={onIsland ? 0 : undefined} aria-label={`${isl.name}${isl.id === 0 ? ', home harbour' : isl.charted ? `, chest of ${isl.treasure}` : ', chest unknown'}${storm ? ', storm now' : next ? ', storm next round' : ''}`}
            style={{ cursor: onIsland ? 'pointer' : undefined }} onClick={() => onIsland?.(isl.id)} onKeyDown={(e) => { if (onIsland && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onIsland(isl.id); } }}>
            <ellipse cx={isl.x} cy={isl.y + 8} rx="64" ry="42" fill={isl.id === 0 ? '#e8d2a0' : '#f2dc9a'} stroke={sel ? '#ffd23f' : INK} strokeWidth={sel ? 8 : 5} />
            <ellipse cx={isl.x} cy={isl.y - 2} rx="46" ry="26" fill={isl.id === 0 ? '#9a6a3a' : '#5fbf6b'} stroke={INK} strokeWidth="4" />
            {isl.id === 0 ? <g><path d={`M${isl.x - 28} ${isl.y + 6}h56v-20l-28 -20-28 20z`} fill="#c43a52" stroke={INK} strokeWidth="4" strokeLinejoin="round" /><rect x={isl.x - 8} y={isl.y - 8} width="16" height="14" fill="#fff6d8" stroke={INK} strokeWidth="3" /></g>
              : <path d={`M${isl.x - 16} ${isl.y - 4}l16 -26 16 26z`} fill="#2f8a4c" stroke={INK} strokeWidth="4" strokeLinejoin="round" />}
            {adj && <ellipse cx={isl.x} cy={isl.y + 8} rx="76" ry="52" fill="none" stroke="#fff" strokeWidth="5" strokeDasharray="10 8" className="pj-pulse" />}
            {storm && <g><path d={`M${isl.x - 48} ${isl.y - 56}q-20 -4 -16 -22q4 -22 28 -16q10 -22 36 -8q26 -2 24 22q22 4 14 20z`} fill="#4a4f6a" stroke={INK} strokeWidth="4" /><path d={`M${isl.x} ${isl.y - 74}l-10 20h12l-8 20 20 -26h-12l8 -14z`} fill="#ffd23f" stroke={INK} strokeWidth="2.5" /></g>}
            {next && !storm && <path d={`M${isl.x - 48} ${isl.y - 56}q-20 -4 -16 -22q4 -22 28 -16q10 -22 36 -8q26 -2 24 22q22 4 14 20z`} fill="none" stroke="#c9ccdf" strokeWidth="4" strokeDasharray="8 7" />}
            <text x={isl.x} y={isl.y + 70} textAnchor="middle" fontSize="19" fontWeight="900" fill="#fff6d8" stroke={INK} strokeWidth="5" paintOrder="stroke" fontFamily="var(--qz-display)">{isl.name}</text>
            {isl.id !== 0 && <Plate x={isl.x + 46} y={isl.y - 26} w={isl.charted ? 62 : 40} size={16} fill={isl.charted ? '#ffd23f' : '#cfd6e6'}>{isl.charted ? `${isl.treasure}` : '?'}</Plate>}
            {ships.map((t, k) => { const i = idx(core, t.id); return <g key={t.id} transform={`translate(${isl.x - (ships.length - 1) * 21 + k * 42} ${isl.y + 32})`}><path d="M-18 -4H18L12 12H-12Z" fill={`url(#pj-tp${i % 8})`} stroke={act === t.id ? '#ffd23f' : INK} strokeWidth={act === t.id ? 6 : 4} strokeLinejoin="round" /><path d="M0 -4V-30L16 -8Z" fill="#fff6d8" stroke={INK} strokeWidth="3" strokeLinejoin="round" /><text y="8" textAnchor="middle" fontSize="12" fontWeight="900" fill="#fff" stroke={INK} strokeWidth="3" paintOrder="stroke">{i + 1}</text></g>; })}
          </g>
        );
      })}
      <g transform="translate(34 40)" fontSize="16" fontWeight="800" fill="#fff6d8" stroke={INK} strokeWidth="4" paintOrder="stroke">
        <text>Round {g.round} · solid storm = costs 5 now · dashed cloud = storm next round · “?” = chest unknown until charted or visited</text>
      </g>
    </svg>
  );
}

/* ───────────────────────── FINAL SHOWDOWN ───────────────────────── */
const STAGE_TXT: Record<ShowdownStage, { n: string; d: string }> = {
  qualifiers: { n: 'Qualifiers', d: 'No penalties · streak bonus' }, pressure: { n: 'Pressure', d: 'Wrong answers cost 3' },
  comeback: { n: 'Comeback', d: 'Trailing teams get +5' }, final: { n: 'Final', d: 'Wrong costs 6 · right +6' },
};
export function ShowdownScene({ core, g }: { core: Core; g: ShowdownG }) {
  const act = actorId(core); const rank = [...core.teams].map((t, i) => ({ t, i, p: g.teams[t.id]!.points })).sort((a, b) => b.p - a.p); const max = Math.max(20, ...rank.map((r) => r.p));
  const bottom = rank.length > 2 ? rank[rank.length - 1]!.t.id : null; const step = 760 / rank.length;
  return (
    <svg viewBox="0 0 1280 720" role="img" aria-label={`Final Showdown, ${STAGE_TXT[g.stage].n} stage`} className="pj-svg">
      <Defs id="pj" />
      <rect width="1280" height="720" fill="#402460" />
      <path d="M0 0H1280V250Q640 350 0 250Z" fill="#552f7d" stroke={INK} strokeWidth="5" />
      {[160, 420, 640, 860, 1120].map((x, i) => <g key={x}><path d={`M${x} 0L${x - 70 + i * 6} 330H${x + 70 - i * 6}Z`} fill="#fff6d8" opacity=".09" /></g>)}
      {/* stage track */}
      {STAGES.map((s, i) => { const x = 130 + i * 300; const cur = g.stage === s; const done = STAGES.indexOf(g.stage) > i; return (
        <g key={s}>{i > 0 && <path d={`M${x - 150} 78H${x - 100}`} stroke={INK} strokeWidth="6" strokeLinecap="round" />}
          <rect x={x - 100} y="40" width="200" height="78" rx="16" fill={cur ? '#ffd23f' : done ? '#8bdfad' : '#6e4a96'} stroke={cur ? '#fff' : INK} strokeWidth={cur ? 7 : 4} />
          <text x={x} y="74" textAnchor="middle" fontSize="24" fontWeight="900" fill={INK} fontFamily="var(--qz-display)">{STAGE_TXT[s].n.toUpperCase()}</text>
          <text x={x} y="100" textAnchor="middle" fontSize="14" fontWeight="800" fill={INK}>{STAGE_TXT[s].d}</text></g>
      ); })}
      <text x="640" y="170" textAnchor="middle" fontSize="22" fontWeight="900" fill="#fff6d8" stroke={INK} strokeWidth="5" paintOrder="stroke">Base score {BASE[g.stage]} per correct answer · nobody is eliminated</text>
      {/* podium bars, sorted live */}
      <rect x="150" y="200" width="980" height="420" rx="22" fill="#2d1a47" stroke={INK} strokeWidth="6" />
      {rank.map((r, k) => { const x = 260 + step * (k + 0.5) - 40; const h = 40 + (r.p / max) * 290; const ft = g.teams[r.t.id]!; const trailing = g.stage === 'comeback' && isTrailing(g, r.t.id) && ft.comebackUsed < 2;
        return (
          <g key={r.t.id} opacity={act && act !== r.t.id ? 0.82 : 1}>
            <rect x={x} y={590 - h} width="80" height={h} rx="10" fill={`url(#pj-tp${r.i % 8})`} stroke={act === r.t.id ? '#ffd23f' : INK} strokeWidth={act === r.t.id ? 8 : 5} />
            <text x={x + 40} y={590 - h - 12} textAnchor="middle" fontSize="30" fontWeight="900" fill="#fff6d8" stroke={INK} strokeWidth="6" paintOrder="stroke" fontFamily="var(--qz-display)">{r.p}</text>
            <text x={x + 40} y={624 - 2} textAnchor="middle" fontSize="16" fontWeight="900" fill="#fff6d8" stroke={INK} strokeWidth="4" paintOrder="stroke">{r.t.name.slice(0, 11)}</text>
            <text x={x + 40} y={590 - h / 2 + 8} textAnchor="middle" fontSize="34" fontWeight="900" fill="#fff" stroke={INK} strokeWidth="6" paintOrder="stroke">{r.i + 1}</text>
            {ft.shields > 0 && Array.from({ length: ft.shields }, (_, s) => <path key={s} d={`M${x + 12 + s * 30} ${590 - h - 64}h24v18q0 14 -12 20q-12 -6 -12 -20z`} fill="#6fd6f0" stroke={INK} strokeWidth="4" />)}
            {ft.choice && <text x={x + 40} y={590 - h - 74 - (ft.shields ? 20 : 0)} textAnchor="middle" fontSize="15" fontWeight="900" fill="#ffd23f" stroke={INK} strokeWidth="4" paintOrder="stroke">{ft.choice === 'double' ? 'DOUBLE' : ft.choice === 'shield' ? 'SHIELD' : 'STEADY'}</text>}
            {trailing && <text x={x + 40} y="190" textAnchor="middle" fontSize="14" fontWeight="900" fill="#8bdfad" stroke={INK} strokeWidth="4" paintOrder="stroke">comeback +5</text>}
            {bottom === r.t.id && <text x={x + 40} y="650" textAnchor="middle" fontSize="14" fontWeight="900" fill="#ffb4a8" stroke={INK} strokeWidth="4" paintOrder="stroke">danger zone</text>}
          </g>
        ); })}
      {g.last && <text x="640" y="690" textAnchor="middle" fontSize="20" fontWeight="900" fill="#ffe9a8" stroke={INK} strokeWidth="5" paintOrder="stroke">{core.teams.find((t) => t.id === g.last!.team)?.name}: {g.last.delta > 0 ? `+${g.last.delta}` : g.last.delta < 0 ? `${g.last.delta}` : 'no change'}{g.last.note === 'shield' ? ' · shield absorbed the setback' : g.last.note === 'comeback' ? ' · comeback bonus' : ''}</text>}
      <rect x="1150" y="200" width="100" height="420" rx="16" fill="none" />
    </svg>
  );
}
export { teamStyle };
