'use client';
import type { EmpireG, Tile } from '@/lib/quiz/projector/reducers/empire';
import { hexXY, ek, neighborsOf } from '@/lib/quiz/projector/reducers/empire';
import type { Core, Locale } from '@/lib/quiz/projector/types';
import { tr } from '../i18n';
import { Defs, Flag, INK, Pulse } from './shared';

const W = 1280, H = 720;
const BIOME: Record<string, { fill: string; deco: 'tree' | 'hill' | 'dune' | 'wave' | 'house' | 'palm' | 'ruin' | 'reed' | 'crop' }> = {
  coast: { fill: '#efdba6', deco: 'wave' }, forest: { fill: '#c9d79d', deco: 'tree' }, harbor: { fill: '#ecd3a0', deco: 'house' }, hills: { fill: '#dcc58d', deco: 'hill' },
  farmland: { fill: '#e6dc9c', deco: 'crop' }, marsh: { fill: '#b9d1a4', deco: 'reed' }, dune: { fill: '#f1d89a', deco: 'dune' }, oasis: { fill: '#cfe0a0', deco: 'palm' }, mesa: { fill: '#e2b987', deco: 'hill' }, ruins: { fill: '#dcc9a0', deco: 'ruin' },
};
const WORLD_SEA: Record<string, string> = { archipelago: '#147d91', river_kingdom: '#2e7f6b', desert_crossing: '#b4793f' };

function hexPath(cx: number, cy: number, s: number) {
  const pts = Array.from({ length: 6 }, (_, k) => { const a = (Math.PI / 180) * (60 * k - 30); return `${(cx + s * Math.cos(a)).toFixed(1)},${(cy + s * Math.sin(a)).toFixed(1)}`; });
  return `M${pts.join('L')}Z`;
}
function Deco({ kind, x, y, s }: { kind: string; x: number; y: number; s: number }) {
  const k = s / 40;
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`} stroke={INK} strokeWidth={2.4 / Math.max(k, 0.5)} strokeLinejoin="round" strokeLinecap="round">
      {kind === 'tree' && <><path d="M-12 6L0 -16L12 6Z" fill="#4f8a55" /><path d="M-9 14L0 -6L9 14Z" fill="#3f7a4c" /></>}
      {kind === 'hill' && <><path d="M-18 10L-4 -12L8 4L14 -4L22 10Z" fill="#9a8f78" /><path d="M-4 -12L0 -4L-8 -2Z" fill="#fff" opacity=".7" /></>}
      {kind === 'dune' && <path d="M-20 10Q-8 -14 4 2Q10 -6 20 10Z" fill="#e8b865" />}
      {kind === 'wave' && <path d="M-16 4Q-8 -6 0 4T16 4M-12 12Q-4 4 4 12T20 12" fill="none" stroke="#2b8aa0" />}
      {kind === 'house' && <><path d="M-12 10V-2L0 -12L12 -2V10Z" fill="#f0b25a" /><rect x="-3" y="2" width="6" height="8" fill="#6b3f26" /></>}
      {kind === 'palm' && <><path d="M0 12V-4" fill="none" /><path d="M0 -4Q-14 -10 -18 -2M0 -4Q14 -10 18 -2M0 -4Q-6 -16 -12 -14M0 -4Q6 -16 12 -14" fill="none" stroke="#3f7a4c" strokeWidth={3.4} /></>}
      {kind === 'ruin' && <><rect x="-14" y="-6" width="8" height="16" fill="#bfa97c" /><rect x="2" y="-12" width="8" height="22" fill="#bfa97c" /><path d="M-16 10H14" /></>}
      {kind === 'reed' && <path d="M-10 10V-8M-4 10V-14M2 10V-6M8 10V-12" fill="none" stroke="#5f8f5a" strokeWidth={3} />}
      {kind === 'crop' && <path d="M-16 -6H16M-16 2H16M-16 10H16" fill="none" stroke="#b79a3a" strokeWidth={3} />}
    </g>
  );
}

export type EmpireProps = { core: Core; g: EmpireG; locale: Locale; selected: number | null; onTile?: (id: number) => void; sel?: { a: number; b: number } | null };
export default function EmpireScene({ core, g, locale, selected, onTile }: EmpireProps) {
  const pos = g.tiles.map((t) => hexXY(t));
  const xs = pos.map((p) => p.x), ys = pos.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const spanX = maxX - minX + Math.sqrt(3), spanY = maxY - minY + 2;
  const S = Math.min((W - 220) / spanX, (H - 150) / spanY);
  const ox = W / 2 - ((minX + maxX) / 2) * S, oy = H / 2 + 10 - ((minY + maxY) / 2) * S;
  const C = (t: Tile) => ({ x: ox + hexXY(t).x * S, y: oy + hexXY(t).y * S });
  const teamIdx = (id: string | null) => core.teams.findIndex((t) => t.id === id);
  const named = (id: string | null) => core.teams.find((t) => t.id === id)?.name ?? '';
  const fxTile = core.fx && (core.fx.kind === 'claim' || core.fx.kind === 'target' || core.fx.kind === 'fort') ? Number(core.fx.ref) : null;
  const edges: { a: number; b: number; bridged: boolean }[] = g.blocked.map((k) => { const [a, b] = k.split('-').map(Number) as [number, number]; return { a, b, bridged: g.bridges.includes(ek(a, b)) }; });
  const sea = WORLD_SEA[g.world] ?? '#147d91';
  return (
    <svg className="pj-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${tr(locale, 'tile', { n: '' })} map`} preserveAspectRatio="xMidYMid meet">
      <Defs id="pj" />
      <rect width={W} height={H} fill={sea} />
      {g.world === 'desert_crossing'
        ? <g opacity=".35" stroke="#fff" strokeWidth="2" fill="none">{Array.from({ length: 9 }, (_, i) => <path key={i} d={`M0 ${60 + i * 78}Q${200} ${40 + i * 78} 400 ${64 + i * 78}T800 ${60 + i * 78}T1280 ${66 + i * 78}`} />)}</g>
        : <g opacity=".4" stroke="#fff" strokeWidth="2" fill="none">{Array.from({ length: 12 }, (_, i) => <path key={i} d={`M${-20 + (i % 3) * 40} ${30 + i * 60}q30 -14 60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0`} />)}</g>}
      <rect width={W} height={H} fill="url(#pj-dots)" opacity=".5" />
      {/* land: draw all hexes, then ownership overlays, then rivers, then props */}
      {g.tiles.map((t) => {
        const { x, y } = C(t); const b = BIOME[t.biome] ?? BIOME.coast!; const own = teamIdx(t.owner);
        const sel = selected === t.id;
        return (
          <g key={t.id} onClick={onTile ? () => onTile(t.id) : undefined} style={onTile ? { cursor: 'pointer' } : undefined} role={onTile ? 'button' : undefined} tabIndex={onTile ? 0 : undefined}
            onKeyDown={onTile ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTile(t.id); } } : undefined}
            aria-label={`${tr(locale, 'tile', { n: t.id + 1 })}. ${t.owner ? tr(locale, 'owner', { team: named(t.owner) }) : tr(locale, 'unclaimed')}${t.capital ? '. ' + tr(locale, 'capital') : ''}${t.fort ? '. fort' : ''}`}>
            <path d={hexPath(x + 4, y + 5, S * 0.99)} fill={INK} opacity=".55" />
            <path d={hexPath(x, y, S * 0.98)} fill={t.hidden && !t.owner ? '#a8b0b8' : b.fill} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
            <path d={hexPath(x, y, S * 0.98)} fill="url(#pj-hatch)" />
            {own >= 0 && <path d={hexPath(x, y, S * 0.8)} fill={`url(#pj-tp${own % 8})`} opacity=".6" stroke={INK} strokeWidth="2.5" strokeDasharray="7 5" />}
            {t.hidden && !t.owner ? <text x={x} y={y + 14} textAnchor="middle" fontSize={S * 0.55} fontWeight="900" fill={INK} opacity=".55" fontFamily="var(--qz-display)">?</text>
              : own < 0 && <Deco kind={b.deco} x={x - S * 0.28} y={y + S * 0.2} s={S * 0.6} />}
            {t.capital && <g transform={`translate(${x} ${y - S * 0.05})`}><path d={`M${-S * 0.34} ${S * 0.3}V${-S * 0.1}L${-S * 0.18} ${-S * 0.2}V${-S * 0.34}H${-S * 0.05}V${-S * 0.22}L${S * 0.05} ${-S * 0.22}V${-S * 0.34}H${S * 0.18}V${-S * 0.2}L${S * 0.34} ${-S * 0.1}V${S * 0.3}Z`} fill="#f4e3b8" stroke={INK} strokeWidth="3.4" strokeLinejoin="round" /><rect x={-S * 0.07} y={S * 0.08} width={S * 0.14} height={S * 0.22} fill={INK} /></g>}
            {t.fort && <path d={hexPath(x, y, S * 0.9)} fill="none" stroke={INK} strokeWidth="9" strokeDasharray="12 6" opacity=".9" />}
            {t.fort && <path d={hexPath(x, y, S * 0.9)} fill="none" stroke="#f4e3b8" strokeWidth="4" strokeDasharray="12 6" />}
            {t.owner && !t.capital && <Flag i={own} x={x - S * 0.08} y={y + S * 0.32} s={Math.max(0.6, S / 70)} label={named(t.owner)} />}
            {t.relic > 0 && !t.hidden && <g transform={`translate(${x + S * 0.4} ${y - S * 0.38})`}><path d="M0 -12L9 0L0 12L-9 0Z" fill="#7be0ff" stroke={INK} strokeWidth="3" /></g>}
            {t.review && <g transform={`translate(${x - S * 0.45} ${y - S * 0.4})`}><circle r="11" fill="#fff" stroke={INK} strokeWidth="3" /><path d="M-5 0L-1 4L6 -4" fill="none" stroke={INK} strokeWidth="3" /></g>}
            <text x={x + S * 0.5} y={y + S * 0.72} textAnchor="middle" fontSize={Math.max(13, S * 0.26)} fontWeight="800" fill="#fff" stroke={INK} strokeWidth="4" paintOrder="stroke" fontFamily="var(--qz-display)">{t.id + 1}</text>
            {(sel || fxTile === t.id) && <path d={hexPath(x, y, S * 1.03)} fill="none" stroke="#ffd52f" strokeWidth="6" className="pj-pulse" />}
            {t.value >= 2 && <g>{Array.from({ length: t.value }, (_, k) => <circle key={k} cx={x - S * 0.5 + k * 11} cy={y - S * 0.62} r="4.2" fill="#ffd52f" stroke={INK} strokeWidth="2" />)}</g>}
          </g>
        );
      })}
      {/* rivers: drawn on the shared side of every blocked edge; a plank bridge on bridged ones */}
      {edges.map(({ a, b, bridged }) => {
        const A = C(g.tiles[a]!), B = C(g.tiles[b]!); const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2; const dx = B.x - A.x, dy = B.y - A.y; const len = Math.hypot(dx, dy) || 1;
        const px = (-dy / len) * S * 0.5, py = (dx / len) * S * 0.5;
        return (
          <g key={`${a}-${b}`} pointerEvents="none">
            <path d={`M${mx - px} ${my - py}L${mx + px} ${my + py}`} stroke={INK} strokeWidth="13" strokeLinecap="round" />
            <path d={`M${mx - px} ${my - py}L${mx + px} ${my + py}`} stroke="#58b7e6" strokeWidth="8" strokeLinecap="round" />
            {bridged && <g transform={`translate(${mx} ${my}) rotate(${(Math.atan2(dy, dx) * 180) / Math.PI})`}><rect x={-S * 0.2} y={-S * 0.1} width={S * 0.4} height={S * 0.2} rx="2" fill="#b27a43" stroke={INK} strokeWidth="3" /><path d={`M${-S * 0.08} ${-S * 0.1}V${S * 0.1}M${S * 0.08} ${-S * 0.1}V${S * 0.1}`} stroke={INK} strokeWidth="2" /></g>}
          </g>
        );
      })}
      {g.duel && (() => { const t = g.tiles[g.duel.tile]!; const { x, y } = C(t); return <g pointerEvents="none"><Pulse cx={x} cy={y} r={S * 0.95} color="#ff386a" /><text x={x} y={y - S * 0.95} textAnchor="middle" fontSize="22" fontWeight="900" fill="#fff" stroke={INK} strokeWidth="5" paintOrder="stroke" fontFamily="var(--qz-display)">{named(g.duel.attacker)} ⚔ {named(g.duel.defender)}</text></g>; })()}
      <g pointerEvents="none" aria-hidden>
        <path d={`M${W - 110} 66L${W - 70} 46L${W - 30} 66L${W - 70} 86Z`} fill="#f4e3b8" stroke={INK} strokeWidth="3.5" /><path d={`M${W - 70} 46V86M${W - 110} 66H${W - 30}`} stroke={INK} strokeWidth="2.5" /><path d={`M${W - 70} 40L${W - 66} 24L${W - 74} 24Z`} fill="#ff386a" stroke={INK} strokeWidth="2.5" />
      </g>
      {neighborsOf(g, 0).length < 0 && null}
    </svg>
  );
}
