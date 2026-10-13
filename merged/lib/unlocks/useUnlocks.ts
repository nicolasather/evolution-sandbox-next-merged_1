'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { Engine } from '@/lib/engine';
import { FEATURES, featureOf, unlockedFor, type Feature, type FeatureId, type Progress } from './registry';
import { unlockMemory } from './store';

/** What the player has done, read straight from the engine. */
export function progressOf(engine: Engine): Progress {
  const eras = engine.db.eras;
  const cur = engine.currentEra();
  return {
    made: Math.max(0, engine.found.size - engine.db.primitives.length),
    eraIndex: Math.max(0, eras.findIndex(e => e.id === cur.id)),
  };
}

export interface Unlocks {
  /** Is this open yet? */
  has: (id: FeatureId) => boolean;
  /** Open, but never opened by the player yet: it glows and says "new". */
  fresh: (id: FeatureId) => boolean;
  /** The player opened it (ends its glow for good). */
  opened: (id: FeatureId) => void;
  /** The notice being shown right now, if any. */
  notice: Feature | null;
  /** The notice has been read. */
  dismissNotice: () => void;
}

/** More than this many unlocking in one step means "a save was loaded", not "the player earned them". */
const BULK = 3;

/**
 * Derives what is unlocked from the engine (so it can never drift from real
 * progress), remembers what the player has been told / has opened, and queues
 * one notice at a time for things earned during play.
 */
export function useUnlocks(engine: Engine, version: number, enabled: boolean): Unlocks {
  const memory = useSyncExternalStore(unlockMemory.subscribe, unlockMemory.get, unlockMemory.getServer);
  const unlocked = useMemo(() => {
    void version; // the engine is mutable: its version is what says "re-derive"
    return unlockedFor(progressOf(engine));
  }, [engine, version]);

  const [queue, setQueue] = useState<FeatureId[]>([]);
  const prev = useRef<Set<FeatureId>>(new Set());
  useEffect(() => {
    if (!enabled) return;
    const before = prev.current;
    const fresh = FEATURES.map(f => f.id).filter(id => unlocked.has(id) && !before.has(id));
    prev.current = unlocked;
    if (fresh.length === 0) return;
    const toTell = fresh.filter(id => !memory.told.includes(id));
    if (toTell.length === 0) return;
    if (toTell.length > BULK) {
      // a loaded save (or a first visit after this feature shipped): no fanfare, no glow storm
      unlockMemory.markSeenQuietly(toTell);
      return;
    }
    unlockMemory.markTold(toTell);
    setQueue(q => [...q, ...toTell]);
  }, [unlocked, enabled, memory.told]);

  const has = useCallback((id: FeatureId) => unlocked.has(id), [unlocked]);
  const fresh = useCallback((id: FeatureId) => unlocked.has(id) && !memory.opened.includes(id), [unlocked, memory.opened]);
  const opened = useCallback((id: FeatureId) => unlockMemory.markOpened(id), []);
  const dismissNotice = useCallback(() => setQueue(q => q.slice(1)), []);
  const notice = queue.length ? featureOf(queue[0]) : null;
  return useMemo(() => ({ has, fresh, opened, notice, dismissNotice }), [has, fresh, opened, notice, dismissNotice]);
}

/** Everything open, nothing new: for callers that do not take part in the unlock system (and tests). */
export const NO_LOCKS: Pick<Unlocks, 'has' | 'fresh' | 'opened'> = {
  has: () => true,
  fresh: () => false,
  opened: () => {},
};
