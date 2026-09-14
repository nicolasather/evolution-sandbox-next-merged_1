'use client';

import { useState } from 'react';
import { Glyph } from './Glyph';
import { cn } from '@/lib/utils';
import type { Engine } from '@/lib/engine';
import type { CombineResult } from '@/lib/types';

function Slot({
  which, id, engine, onDrop, onClear,
}: {
  which: 'a' | 'b';
  id: string | null;
  engine: Engine;
  onDrop: (which: 'a' | 'b', id: string) => void;
  onClear: (which: 'a' | 'b') => void;
}) {
  const [over, setOver] = useState(false);
  const node = id ? engine.get(id) : undefined;

  return (
    <div
      className={cn('slot', over && 'over', node && 'full')}
      aria-label={which === 'a' ? 'First ingredient' : 'Second ingredient'}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={e => {
        e.preventDefault(); setOver(false);
        const dropped = e.dataTransfer.getData('text/plain');
        if (dropped && engine.has(dropped)) onDrop(which, dropped);
      }}
    >
      {!node ? (
        <span className="ph mono">
          {which === 'a' ? <>Drag or tap<br />an item here</> : <>and a second<br />one here</>}
        </span>
      ) : (
        <>
          <Glyph node={node} />
          <span className="lbl">{node.n}</span>
          <button className="clear" aria-label={`Remove ${node.n}`} onClick={() => onClear(which)}>
            <svg width="11" height="11" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <path d="M1 1l10 10M11 1L1 11" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}

export function Bench({
  engine, slotA, slotB, result, hint, onDrop, onClear, onOpen,
}: {
  engine: Engine;
  slotA: string | null;
  slotB: string | null;
  result: CombineResult | null;
  /** Shown until the first combination is tried, and again after a reset. */
  hint: boolean;
  onDrop: (which: 'a' | 'b', id: string) => void;
  onClear: (which: 'a' | 'b') => void;
  onOpen: (id: string) => void;
}) {
  const trail = engine.path().slice(-26);

  return (
    <div id="bench">
      <div id="bench-stage">
        <div className="slots">
          <Slot which="a" id={slotA} engine={engine} onDrop={onDrop} onClear={onClear} />
          <div className="slot-op" aria-hidden="true">+</div>
          <Slot which="b" id={slotB} engine={engine} onDrop={onDrop} onClear={onClear} />
        </div>

        <div id="burst" aria-live="polite">
          {result?.status === 'fail' && (
            <div className="rz fail show"><div className="nm">{result.message}</div></div>
          )}
          {(result?.status === 'new' || result?.status === 'known') && (
            <div className="rz show">
              <Glyph node={result.node} />
              <div className="nm">{result.node.n}</div>
              <div className="tag mono">
                {result.status === 'new'
                  ? (result.node.hidden ? 'Hidden find' : 'New discovery')
                  : 'Already known'}
              </div>
            </div>
          )}
        </div>

        <p className="hint mono" style={{ opacity: hint ? 1 : 0 }}>
          Tap two things. See what happens.
        </p>
      </div>

      <div id="trail">
        <span className="trail-lbl mono">Your path</span>
        <div id="trail-items" style={{ display: 'flex', alignItems: 'center', gap: 9, overflowX: 'auto' }}>
          {trail.map((n, i) => (
            <span key={n.id} style={{ display: 'contents' }}>
              {i > 0 && <span className="trail-sep">→</span>}
              <button className="trail-item" title={n.n} onClick={() => onOpen(n.id)}>
                <Glyph node={n} />
                <span className="mono">{n.n}</span>
              </button>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
