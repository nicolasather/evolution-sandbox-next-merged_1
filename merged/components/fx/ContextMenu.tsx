'use client';

import { useEffect, useRef } from 'react';
import type { Engine } from '@/lib/engine';

export interface ContextMenuTarget { x: number; y: number; id: string }

/** A right-click's (or a touch long-press's) stand-in menu — three actions
 *  on a discovery that already exist elsewhere in the UI, just gathered
 *  under the cursor: nothing new for the engine, purely a shortcut. */
export function ContextMenu({
  target, engine, onOpen, onFindInGraph, onPlace, onClose,
}: {
  target: ContextMenuTarget | null;
  engine: Engine;
  onOpen: (id: string) => void;
  onFindInGraph: (id: string) => void;
  onPlace: (id: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });

  useEffect(() => {
    if (!target) return;
    const onDown = (ev: PointerEvent) => {
      if (ref.current && !ref.current.contains(ev.target as Node)) closeRef.current();
    };
    const onScroll = () => closeRef.current();
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('blur', onScroll);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('blur', onScroll);
    };
  }, [target]);

  if (!target) return null;
  const n = engine.get(target.id);
  if (!n) return null;

  // clamp so a menu opened near an edge never spills off-screen
  const w = 176, h = 140, pad = 8;
  const x = Math.min(target.x, (typeof window !== 'undefined' ? window.innerWidth : 0) - w - pad);
  const y = Math.min(target.y, (typeof window !== 'undefined' ? window.innerHeight : 0) - h - pad);

  const act = (fn: (id: string) => void) => { fn(n.id); onClose(); };

  return (
    <div ref={ref} className="ctxmenu" role="menu" aria-label={`Actions for ${n.n}`} style={{ left: x, top: y }}>
      <p className="ctxmenu-title mono">{n.n}</p>
      <button type="button" role="menuitem" onClick={() => act(onOpen)}>Open</button>
      <button type="button" role="menuitem" onClick={() => act(onFindInGraph)}>Find in graph</button>
      <button type="button" role="menuitem" onClick={() => act(onPlace)}>Place on bench</button>
    </div>
  );
}
