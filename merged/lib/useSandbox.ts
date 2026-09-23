'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import rawDb from '@/data/db.json';
import { Engine } from './engine';
import type { CombineResult, Db, Discovery, ViewId } from './types';

export const db = rawDb as unknown as Db;

export type ToastKind = 'new' | 'rare' | 'hidden' | 'route' | 'tier' | 'solved' | 'reopen';
export interface Toast { key: number; kind: ToastKind; title: string; sub: string; node?: Discovery }

/** Server and first client render see a fresh engine; saved progress arrives after. */
const SERVER_VERSION = () => 0;

/** How long the pair stays on the slots before they clear for the next try. */
const SETTLE_MS = 520;

/**
 * The engine is mutable and lives outside React. Rather than mirroring its
 * state into hooks (two sources of truth, guaranteed to drift), components
 * read the engine directly and re-render when its version changes — through
 * useSyncExternalStore, which is also what keeps hydration honest.
 */
export function useSandbox() {
  const [engine] = useState(() => new Engine(db));
  const version = useSyncExternalStore(engine.subscribe, engine.getVersion, SERVER_VERSION);

  // Saved progress lives in localStorage, which the server cannot see. Loading
  // it after mount lets hydration match; the engine then announces the change.
  useEffect(() => { engine.load(); }, [engine]);

  const [view, setView] = useState<ViewId>('work');
  const [slotA, setSlotA] = useState<string | null>(null);
  const [slotB, setSlotB] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  /** The last outcome. It stays on the bench until the next item is placed —
   *  feedback is never taken away on a timer. */
  const [result, setResult] = useState<(CombineResult & { key: number }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [ending, setEnding] = useState<Discovery | null>(null);
  const [entered, setEntered] = useState(false);
  const [hintError, setHintError] = useState<string | null>(null);
  const seq = useRef(0);
  const timers = useRef<number[]>([]);
  useEffect(() => () => { timers.current.forEach(t => window.clearTimeout(t)); }, []);
  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  const pushToast = useCallback((t: Omit<Toast, 'key'>, ms = 3200) => {
    const key = ++seq.current;
    setToasts(list => [...list.slice(-2), { ...t, key }]);
    later(() => setToasts(list => list.filter(x => x.key !== key)), ms);
  }, [later]);

  const clearSlots = useCallback(() => { setSlotA(null); setSlotB(null); }, []);

  const open = useCallback((id: string) => {
    setFocusId(id);
    if (engine.has(id)) engine.markSeen(id);
  }, [engine]);

  const fire = useCallback((a: string, b: string) => {
    const res = engine.combine(a, b);
    if (res.status === 'error') { clearSlots(); return; }
    setResult({ ...res, key: ++seq.current });
    setHintError(null);
    setBusy(true);
    later(() => { clearSlots(); setBusy(false); }, SETTLE_MS);

    if (res.status === 'new' || res.status === 'known') {
      const n = res.node;
      setFocusId(n.id);
      engine.markSeen(n.id);
      if (res.status === 'new') {
        if (n.hidden) pushToast({ kind: 'hidden', title: n.n, sub: 'Hidden find', node: n });
        else if (n.rar === 'rare') pushToast({ kind: 'rare', title: n.n, sub: 'Rare discovery', node: n });
        if (res.solvedHint) pushToast({ kind: 'solved', title: 'You figured it out.', sub: n.n, node: n });
        if (ENDPOINTS.has(n.id)) later(() => setEnding(n), 1400);
      } else if (res.newRoute) {
        pushToast({ kind: 'route', title: 'New route', sub: `${n.n} · ${res.routes.found} of ${res.routes.total} ways found`, node: n });
      }
      res.opened.forEach(t => pushToast({
        kind: 'tier', title: `${engine.tierName(t)} opened`, sub: 'More combinations work now',
      }, 4200));
      if (res.reopened.length) {
        const [x, y] = res.reopened[0];
        pushToast({
          kind: 'reopen', title: 'Try it again',
          sub: `${engine.get(x)?.n} + ${engine.get(y)?.n} works now`,
        }, 6000);
      }
    }
  }, [engine, pushToast, clearSlots, later]);

  /** Tap-to-combine: first tap fills A, second fills B and combines at once. */
  const place = useCallback((id: string) => {
    if (busy) return;
    if (slotA && !slotB) {
      setSlotB(id);
      later(() => fire(slotA, id), 140);
      return;
    }
    // a new pair starts: the previous outcome gives way to it
    setResult(null);
    setSlotA(id); setSlotB(null);
  }, [busy, slotA, slotB, fire, later]);

  const drop = useCallback((which: 'a' | 'b', id: string) => {
    if (busy) return;
    const a = which === 'a' ? id : slotA;
    const b = which === 'b' ? id : slotB;
    if (!(a && b)) setResult(null);
    setSlotA(a); setSlotB(b);
    if (a && b) later(() => fire(a, b), 140);
  }, [busy, slotA, slotB, fire, later]);

  const clearSlot = useCallback((which: 'a' | 'b') => {
    // clearing the first slot slides the second one across
    if (which === 'a') { setSlotA(slotB); setSlotB(null); } else { setSlotB(null); }
  }, [slotB]);

  const reset = useCallback(() => {
    engine.reset(); clearSlots(); setFocusId(null); setEnding(null); setResult(null); setHintError(null);
  }, [engine, clearSlots]);

  const enter = useCallback(() => setEntered(true), []);

  const requestHint = useCallback((targetId?: string) => {
    const r = engine.requestHint(targetId);
    if ('error' in r) { setHintError(r.error); return false; }
    setHintError(null);
    return true;
  }, [engine]);

  const dismissResult = useCallback(() => setResult(null), []);

  const focus = useMemo(() => (focusId ? engine.get(focusId) ?? null : null), [focusId, engine]);

  return {
    engine, db, version, view, setView, slotA, slotB,
    focus, open, place, drop, clearSlot, clearSlots, fire, reset,
    result, dismissResult, busy, toasts, ending, setEnding, entered, enter,
    requestHint, hintError, setHintError,
  };
}

/** Reaching one of these is the reflective ending, not a win screen. */
export const ENDPOINTS = new Set(['grand_theft_auto_vi', 'virtual_world']);

/** The world tint per era — dark theme values; the light theme scales them down in CSS. */
export const ERA_TINT: Record<string, string> = {
  origins: '18,17,16', fire: '30,19,13', settlement: '19,20,19', agriculture: '19,24,19',
  civilization: '28,24,18', trade: '27,23,17', metallurgy: '31,22,15', science: '17,21,25', industry: '23,21,19',
  electric: '18,22,28', computing: '14,21,23', network: '13,19,26', games: '21,16,23',
  simulation: '24,17,17',
};
