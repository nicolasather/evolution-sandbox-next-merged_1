'use client';

import { useState } from 'react';
import { Glyph } from './Glyph';
import { cn } from '@/lib/utils';
import type { Engine } from '@/lib/engine';
import type { Discovery } from '@/lib/types';

const RARITY_LABEL: Record<string, string> = {
  common: 'Common', uncommon: 'Uncommon', rare: 'Rare', hidden: 'Hidden find',
};

export function InventoryRail({
  engine, open, slotA, slotB, onPick, onDragStart,
}: {
  engine: Engine;
  open: boolean;
  slotA: string | null;
  slotB: string | null;
  onPick: (id: string) => void;
  onDragStart: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const [era, setEra] = useState<string | null>(null);

  const all = engine.inventory();
  let list = all;
  if (era) list = list.filter(n => n.era === era);
  if (q.trim()) {
    const needle = q.trim().toLowerCase();
    list = list.filter(n => n.n.toLowerCase().includes(needle) || n.tags?.some(t => t.includes(needle)));
  }

  const groups = new Map<string, Discovery[]>();
  list.forEach(n => {
    if (!groups.has(n.era)) groups.set(n.era, []);
    groups.get(n.era)!.push(n);
  });

  return (
    <aside id="rail" className={cn(open && 'open')} aria-label="Discovered items">
      <div className="rail-head">
        <span className="mono">Inventory</span>
        <span className="mono">{all.length} held</span>
      </div>

      <div className="searchbox" style={{ padding: '9px 15px', borderBottom: '1px solid var(--line)' }}>
        <input
          type="search" value={q} placeholder="Filter" aria-label="Filter inventory"
          autoComplete="off" onChange={e => setQ(e.target.value)}
        />
      </div>

      <div className="rail-filters">
        <button className="chip" aria-pressed={!era} onClick={() => setEra(null)}>All</button>
        {engine.erasReached().map(e => (
          <button key={e.id} className="chip" aria-pressed={era === e.id} onClick={() => setEra(e.id)}>
            {e.name}
          </button>
        ))}
      </div>

      <div id="inv">
        {groups.size === 0 && <div className="inv-era mono">No match</div>}
        {engine.db.eras.map(e => {
          const g = groups.get(e.id);
          if (!g?.length) return null;
          return (
            <div key={e.id}>
              <div className="inv-era mono">{e.name} · {g.length}</div>
              {g.map(n => (
                <button
                  key={n.id}
                  data-id={n.id}
                  className={cn('item', engine.isFresh(n.id) && 'is-new', (slotA === n.id || slotB === n.id) && 'picked')}
                  draggable
                  onDragStart={ev => { ev.dataTransfer.setData('text/plain', n.id); onDragStart(n.id); }}
                  onClick={() => onPick(n.id)}
                  aria-label={`${n.n}. ${RARITY_LABEL[n.rar]}. Select to place on the bench.`}
                >
                  <Glyph node={n} />
                  <span className="nm">{n.n}</span>
                  <span className={`dot ${n.rar}`} aria-hidden="true" />
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
