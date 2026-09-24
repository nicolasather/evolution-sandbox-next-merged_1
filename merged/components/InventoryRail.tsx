'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Glyph } from './Glyph';
import { armItemDrag } from '@/lib/dragcraft';
import { cn } from '@/lib/utils';
import type { Engine } from '@/lib/engine';
import type { Discovery } from '@/lib/types';

const RARITY_LABEL: Record<string, string> = {
  common: 'Common', uncommon: 'Uncommon', rare: 'Rare', hidden: 'Hidden find',
};
const HIDE_DONE_KEY = 'evo.inv.hideDone';
const HIDE_DONE_EVENT = 'evo:hide-done';

// a per-browser convenience, read through a tiny external store so the server
// render (always "show everything") and the client agree during hydration
const subscribeHideDone = (cb: () => void) => {
  window.addEventListener(HIDE_DONE_EVENT, cb);
  return () => window.removeEventListener(HIDE_DONE_EVENT, cb);
};
const readHideDone = () => { try { return window.localStorage.getItem(HIDE_DONE_KEY) === '1'; } catch { return false; } };
const setHideDoneStored = (v: boolean) => {
  try { window.localStorage.setItem(HIDE_DONE_KEY, v ? '1' : '0'); } catch { /* ignore */ }
  window.dispatchEvent(new Event(HIDE_DONE_EVENT));
};

/* The inventory folds away. First visit it is open — that is where the
   materials are — and after that the player's own choice is remembered. */
const OPEN_KEY = 'evo.inv.open';
const OPEN_EVENT = 'evo:inv-open';
const subscribeOpen = (cb: () => void) => {
  window.addEventListener(OPEN_EVENT, cb);
  return () => window.removeEventListener(OPEN_EVENT, cb);
};
const readOpen = () => { try { return window.localStorage.getItem(OPEN_KEY) !== '0'; } catch { return true; } };
const setOpenStored = (v: boolean) => {
  try { window.localStorage.setItem(OPEN_KEY, v ? '1' : '0'); } catch { /* ignore */ }
  window.dispatchEvent(new Event(OPEN_EVENT));
  // the bench re-measures once the tray has finished moving
  window.setTimeout(() => window.dispatchEvent(new Event('evo:layout')), 340);
};

export function InventoryRail({
  engine, slotA, slotB, highlightId, onPick, onDrop, onBenchDrop, onContextMenu, onInspect,
}: {
  engine: Engine;
  slotA: string | null;
  slotB: string | null;
  /** Item a hint or the onboarding line points at. */
  highlightId: string | null;
  onPick: (id: string) => void;
  onDrop: (which: 'a' | 'b', id: string) => void;
  onBenchDrop: (id: string, clientX: number, clientY: number) => void;
  onContextMenu: (x: number, y: number, id: string) => void;
  /** Read about a discovery — only ever from an explicit press. */
  onInspect: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const [era, setEra] = useState<string | null>(null);
  const slots = useRef({ a: slotA, b: slotB });
  useEffect(() => { slots.current = { a: slotA, b: slotB }; }, [slotA, slotB]);
  const hideDone = useSyncExternalStore(subscribeHideDone, readHideDone, () => false);
  const toggleDone = () => setHideDoneStored(!hideDone);
  const open = useSyncExternalStore(subscribeOpen, readOpen, () => true);

  const all = engine.inventory();
  const potential = new Map(all.map(n => [n.id, engine.potential(n.id)]));
  const doneCount = all.filter(n => potential.get(n.id) === 'done').length;
  let list = all;
  if (era) list = list.filter(n => n.era === era);
  if (hideDone) list = list.filter(n => potential.get(n.id) !== 'done');
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
    <>
    {!open && (
      <button type="button" id="rail-tab" className="mono" aria-expanded="false" aria-controls="rail"
        onClick={() => setOpenStored(true)}>
        Inventory · {all.length}
      </button>
    )}
    <aside id="rail" aria-label="Your discoveries" data-open={open ? 'true' : 'false'} data-wb-avoid={open ? '' : 'off'}>
      <div className="rail-head">
        <span className="mono">Inventory · {all.length}</span>
        <button type="button" className="rail-hide mono" aria-expanded={open} aria-controls="inv"
          onClick={() => setOpenStored(false)}>Hide</button>
      </div>

      <div className="rail-tools">
        <div className="searchbox">
          <svg width="12" height="12" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.5" fill="none"
            style={{ color: 'var(--bone-4)', flex: 'none' }} aria-hidden="true">
            <circle cx="7" cy="7" r="5" /><path d="M11 11l4 4" />
          </svg>
          <input
            type="search" value={q} placeholder="Filter" aria-label="Filter inventory"
            autoComplete="off" onChange={e => setQ(e.target.value)}
          />
        </div>
        {doneCount > 0 && (
          <button className="chip" aria-pressed={hideDone} onClick={toggleDone}
            title="Items that have nothing left to make">
            Hide used up · {doneCount}
          </button>
        )}
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
            <div key={e.id} className="inv-group">
              <div className="inv-era mono">{e.name} · {g.length}</div>
              <div className="inv-items">
                {g.map(n => {
                  const p = potential.get(n.id);
                  return (
                    <div key={n.id} className="item-wrap">
                    <button
                      data-id={n.id}
                      className={cn(
                        'item',
                        engine.isFresh(n.id) && 'is-new',
                        (slotA === n.id || slotB === n.id) && 'picked',
                        p === 'done' && 'is-done',
                        highlightId === n.id && 'hinted',
                      )}
                      style={{ touchAction: 'none' }}
                      onPointerDown={ev => armItemDrag(ev, {
                        id: n.id,
                        originEl: ev.currentTarget,
                        engine,
                        getSlots: () => slots.current,
                        onDrop,
                        onBenchDrop,
                        onLongPress: (x, y) => onContextMenu(x, y, n.id),
                      })}
                      onClick={() => onPick(n.id)}
                      onContextMenu={ev => { ev.preventDefault(); onContextMenu(ev.clientX, ev.clientY, n.id); }}
                      aria-label={`${n.n}. ${RARITY_LABEL[n.rar]}.${p === 'done' ? ' Used up.' : ''} Put on the bench.`}
                    >
                      <Glyph node={n} />
                      <span className="nm">{n.n}</span>
                      <span className={`dot r-${n.rar}`} aria-hidden="true" />
                    </button>
                    <button type="button" className="item-i mono" onClick={() => onInspect(n.id)}
                      aria-label={`Inspect ${n.n}`} title="Inspect: read about it">i</button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
    </>
  );
}
