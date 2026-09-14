'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import rawDb from '@/data/db.json';
import { Engine } from './engine';
import type { CombineResult, Db, Discovery, ViewId } from './types';

export const db = rawDb as unknown as Db;

export interface Toast { key: number; node: Discovery; kind: '' | 'rare' | 'hidden' }

/** Server and first client render see a fresh engine; saved progress arrives after. */
const SERVER_VERSION = () => 0;

/**
 * The engine is mutable and lives outside React. Rather than mirroring its
 * state into hooks (two sources of truth, guaranteed to drift), components
 * read the engine directly and re-render when its version changes — through
 * useSyncExternalStore, which is also what keeps hydration honest.
 */
export function useSandbox(options: {
  /** Called when a combination puts an entry in front of the player — the
   *  sandbox uses it to raise the exhibit sheet on a phone. */
  onReveal?: (id: string) => void;
} = {}) {
  const [engine] = useState(() => new Engine(db));
  const onReveal = useRef(options.onReveal);
  useEffect(() => { onReveal.current = options.onReveal; });
  const version = useSyncExternalStore(engine.subscribe, engine.getVersion, SERVER_VERSION);

  // Saved progress lives in localStorage, which the server cannot see. Loading
  // it during the first render made the client's markup differ from the
  // server's for every returning player (a hydration error). Loading after
  // mount lets hydration match, then the engine announces the change itself.
  useEffect(() => { engine.load(); }, [engine]);

  const [view, setView] = useState<ViewId>('work');
  const [slotA, setSlotA] = useState<string | null>(null);
  const [slotB, setSlotB] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [result, setResult] = useState<CombineResult | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [ending, setEnding] = useState<Discovery | null>(null);
  const [hint, setHint] = useState(true);
  const [entered, setEntered] = useState(false);
  const toastKey = useRef(0);

  const pushToast = useCallback((node: Discovery) => {
    const kind: Toast['kind'] = node.hidden ? 'hidden' : node.rar === 'rare' ? 'rare' : '';
    const key = ++toastKey.current;
    setToasts(t => [...t, { key, node, kind }]);
    window.setTimeout(() => setToasts(t => t.filter(x => x.key !== key)), 2900);
  }, []);

  const clearSlots = useCallback(() => { setSlotA(null); setSlotB(null); }, []);

  const open = useCallback((id: string) => {
    setFocusId(id);
    if (engine.has(id)) engine.markSeen(id);
  }, [engine]);

  const fire = useCallback((a: string, b: string) => {
    const res = engine.combine(a, b);
    setResult(res);
    setHint(false);
    if (res.status === 'new' || res.status === 'known') {
      if (res.status === 'new') pushToast(res.node);
      // the result goes straight into the exhibit, as in the single-file build —
      // which also counts as having seen it
      setFocusId(res.node.id);
      engine.markSeen(res.node.id);
      onReveal.current?.(res.node.id);
      if (res.status === 'new' && ENDPOINTS.has(res.node.id)) window.setTimeout(() => setEnding(res.node), 1200);
    }
    window.setTimeout(() => { setResult(null); clearSlots(); }, res.status === 'fail' || res.status === 'tier_locked' ? 1500 : 1250);
  }, [engine, pushToast, clearSlots]);

  const place = useCallback((id: string) => {
    if (result) return;
    if (!slotA) { setSlotA(id); return; }
    if (!slotB) {
      setSlotB(id);
      window.setTimeout(() => fire(slotA, id), 210);
      return;
    }
    // both full: the newest two are what get combined
    setSlotA(slotB); setSlotB(id);
    window.setTimeout(() => fire(slotB, id), 210);
  }, [result, slotA, slotB, fire]);

  const drop = useCallback((which: 'a' | 'b', id: string) => {
    if (result) return;
    const a = which === 'a' ? id : slotA;
    const b = which === 'b' ? id : slotB;
    setSlotA(a); setSlotB(b);
    if (a && b) window.setTimeout(() => fire(a, b), 210);
  }, [result, slotA, slotB, fire]);

  const reset = useCallback(() => {
    engine.reset(); clearSlots(); setFocusId(null); setEnding(null); setHint(true);
  }, [engine, clearSlots]);

  const enter = useCallback(() => setEntered(true), []);

  const focus = useMemo(() => (focusId ? engine.get(focusId) ?? null : null), [focusId, engine]);

  return {
    engine, db, version, view, setView, slotA, slotB, setSlotA, setSlotB,
    focus, open, place, drop, clearSlots, fire, reset, hint,
    result, toasts, ending, setEnding, entered, enter,
  };
}

/** Reaching one of these is the reflective ending, not a win screen. */
export const ENDPOINTS = new Set(['grand_theft_auto_vi', 'virtual_world']);

export const ERA_TINT: Record<string, string> = {
  origins: '18,17,16', fire: '30,19,13', settlement: '19,20,19', agriculture: '19,24,19',
  civilization: '28,24,18', metallurgy: '31,22,15', science: '17,21,25', industry: '23,21,19',
  electric: '18,22,28', computing: '14,21,23', network: '13,19,26', games: '21,16,23',
  simulation: '24,17,17',
};
