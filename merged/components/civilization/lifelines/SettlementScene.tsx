'use client';
import { useMemo, type KeyboardEvent } from 'react';
import { linkLabel, districtView } from '@/lib/civilization/lifelines/selectors';
import { SERVICE_LABEL } from '@/lib/civilization/lifelines/rules';
import type { ContentIndex, District, LifelinesState, ResourceId } from '@/lib/civilization/lifelines/schema';
import { RES_GLYPH, resColor } from './ui';

const R = 64;
const hex = (x: number, y: number) =>
  [[-R, 0], [-R / 2, -R * 0.86], [R / 2, -R * 0.86], [R, 0], [R / 2, R * 0.86], [-R / 2, R * 0.86]].map(([dx, dy]) => `${x + dx},${y + dy}`).join(' ');

/** Nearest district in an arrow direction, or null. */
export function neighbourInDirection(districts: District[], fromId: string, dir: 'left' | 'right' | 'up' | 'down'): string | null {
  const from = districts.find(d => d.id === fromId);
  if (!from) return districts[0]?.id ?? null;
  let best: { id: string; score: number } | null = null;
  for (const d of districts) {
    if (d.id === fromId) continue;
    const dx = d.anchor.x - from.anchor.x, dy = d.anchor.y - from.anchor.y;
    const along = dir === 'left' ? -dx : dir === 'right' ? dx : dir === 'up' ? -dy : dy;
    const across = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
    if (along <= 4) continue;
    const score = along + across * 1.6;
    if (!best || score < best.score || (score === best.score && d.id < best.id)) best = { id: d.id, score };
  }
  return best?.id ?? null;
}

export interface SceneProps {
  index: ContentIndex;
  run: LifelinesState;
  selectedId: string | null;
  onSelect: (id: string) => void;
  overlay: ResourceId | 'none';
  reduced: boolean;
  highlightIds?: string[];
  highlightProgramme?: { districtId: string; name: string } | null;
}

export function SettlementScene({ index, run, selectedId, onSelect, overlay, reduced, highlightIds = [], highlightProgramme = null }: SceneProps) {
  const { districts, links, potentialLinks } = run.layout;
  const flowByLink = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of run.report?.flows ?? []) m.set(f.linkId, (m.get(f.linkId) ?? 0) + f.amount);
    return m;
  }, [run.report]);
  const pos = (id: string) => districts.find(d => d.id === id)?.anchor ?? { x: 0, y: 0 };
  const needsBy = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of run.report?.needs ?? []) if (n.unmet + n.upkeepUnmet > 0) m.set(n.districtId, (m.get(n.districtId) ?? 0) + 1);
    return m;
  }, [run.report]);
  const overlayAmount = (id: string) => (overlay === 'none' ? 0 : (run.report?.needs ?? []).filter(n => n.districtId === id && n.resource === overlay).reduce((a, n) => a + n.unmet + n.upkeepUnmet, 0));

  const onKey = (e: KeyboardEvent<SVGGElement>, id: string) => {
    const map: Record<string, 'left' | 'right' | 'up' | 'down'> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
    if (map[e.key]) {
      const next = neighbourInDirection(districts, id, map[e.key]);
      if (next) {
        e.preventDefault();
        onSelect(next);
        const el = (e.currentTarget.ownerSVGElement ?? e.currentTarget.parentElement)?.querySelector<SVGGElement>(`[data-district="${next}"]`);
        el?.focus();
      }
    } else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(id); }
  };

  return (
    <svg className={'ll-scene' + (reduced ? ' still' : '')} viewBox="0 0 1000 560" role="group" aria-label="Settlement map: districts and the links between them" preserveAspectRatio="xMidYMid meet">
      <defs>
        <pattern id="ll-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="currentColor" strokeOpacity=".07" /></pattern>
      </defs>
      <rect width="1000" height="560" fill="url(#ll-grid)" />
      {links.map(l => {
        const a = pos(l.a), b = pos(l.b);
        const worn = l.condition < 450;
        const flow = flowByLink.get(l.id) ?? 0;
        const hot = run.report?.warnings.some(w => w.bottleneckLinkId === l.id);
        const label = `${linkLabel(l.type, run.era)}${l.condition < 1000 ? ` ${Math.round(l.condition / 10)}%` : ''}`;
        return (
          <g key={l.id} className={`ll-link t-${l.type}${worn ? ' worn' : ''}${hot ? ' hot' : ''}`}>
            <title>{`${label}: ${districts.find(d => d.id === l.a)?.name} to ${districts.find(d => d.id === l.b)?.name}`}</title>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth={2 + l.capacity / 6000} />
            {flow > 0 && <line className="ll-flow" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />}
            <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 7} textAnchor="middle" className="ll-link-label">{label}</text>
            {flow > 0 && (
              <polygon className="ll-arrow" points="0,-5 9,0 0,5" transform={`translate(${(a.x + b.x) / 2 + (b.x - a.x) * 0.14},${(a.y + b.y) / 2 + (b.y - a.y) * 0.14 + 8}) rotate(${(Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI})`} />
            )}
          </g>
        );
      })}
      {potentialLinks.filter(p => !links.some(l => l.id === p.id)).map(p => {
        const a = pos(p.a), b = pos(p.b);
        return <line key={p.id} className="ll-potential" x1={a.x} y1={a.y} x2={b.x} y2={b.y}><title>A possible second route</title></line>;
      })}
      {districts.map(d => {
        const view = districtView(index, run, d.id, run.report);
        const sel = selectedId === d.id;
        const hl = highlightIds.includes(d.id);
        const needs = needsBy.get(d.id) ?? 0;
        const ov = overlayAmount(d.id);
        const building = view?.queue ?? [];
        const aria = `${d.name}${d.storage ? ', shared reserve' : ''}. ${view?.built.length ?? 0} established, ${building.length} in progress.${needs ? ` ${needs} unmet need${needs > 1 ? 's' : ''}.` : ''}`;
        return (
          <g key={d.id} className={'ll-district' + (sel ? ' sel' : '') + (needs ? ' stress' : '') + (hl ? ' hl' : '')}
            data-district={d.id} tabIndex={0} role="button" aria-pressed={sel} aria-label={aria}
            onClick={() => onSelect(d.id)} onKeyDown={e => onKey(e, d.id)}>
            <polygon points={hex(d.anchor.x, d.anchor.y)} style={overlay !== 'none' && ov > 0 ? { fill: resColor(overlay), fillOpacity: Math.min(0.55, 0.12 + ov / 20000) } : undefined} />
            <text x={d.anchor.x} y={d.anchor.y - 26} textAnchor="middle" className="ll-dname">{d.name}</text>
            {d.storage && <text x={d.anchor.x} y={d.anchor.y - 12} textAnchor="middle" className="ll-dtag">RESERVE</text>}
            {(view?.built ?? []).slice(0, 6).map((b, i) => {
              const p = index.projects.get(b.projectId);
              return (
                <g key={b.instanceId} transform={`translate(${d.anchor.x - 36 + i * 14},${d.anchor.y + 2})`} opacity={0.45 + (b.condition / 1000) * 0.55}>
                  <rect width="12" height="12" fill={p ? resColor(p.sector) : 'currentColor'} />
                  <title>{`${b.name}${b.condition < 1000 ? ` (condition ${Math.round(b.condition / 10)}%)` : ''}`}</title>
                </g>
              );
            })}
            {building.slice(0, 2).map((q, i) => (
              <g key={q.queueId} transform={`translate(${d.anchor.x - 40},${d.anchor.y + 24 + i * 9})`}>
                <rect width="80" height="5" className="ll-bar-bg" /><rect width={Math.max(2, q.percent * 0.8)} height="5" className="ll-bar" />
                <title>{`${q.name}: ${q.percent}% (${q.status})`}</title>
              </g>
            ))}
            {highlightProgramme?.districtId === d.id && (
              <g className="ll-ghost" transform={`translate(${d.anchor.x + 26},${d.anchor.y - 4})`}><rect width="14" height="14" /><title>{`Preview: ${highlightProgramme.name}`}</title></g>
            )}
            {needs > 0 && <text x={d.anchor.x + R - 14} y={d.anchor.y - R * 0.5} className="ll-warn-mark" aria-hidden="true">!</text>}
            {overlay !== 'none' && ov > 0 && <text x={d.anchor.x} y={d.anchor.y + 46} textAnchor="middle" className="ll-dtag">{RES_GLYPH[overlay]} short</text>}
          </g>
        );
      })}
      <desc>{`Overlay: ${overlay === 'none' ? 'none' : SERVICE_LABEL[overlay]}`}</desc>
    </svg>
  );
}
