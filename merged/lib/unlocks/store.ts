/* ============================================================================
   UNLOCK MEMORY — which unlocks the player has already been TOLD about and
   which they have already OPENED. Both are only about presentation (the
   announcement and the "this is new" glow); whether something is unlocked is
   always derived from real progress (see registry.ts), never stored.

   Persisted in the browser under `evo.unlocks.v1`. It is not part of any game
   save, so it can never corrupt progress; losing it only means a glow shows
   again.
   ========================================================================== */

import type { FeatureId } from './registry';

export const UNLOCKS_KEY = 'evo.unlocks.v1';

export interface UnlockMemory { v: 1; told: FeatureId[]; opened: FeatureId[] }

const EMPTY: UnlockMemory = { v: 1, told: [], opened: [] };

type Listener = () => void;
let current: UnlockMemory = EMPTY;
let loaded = false;
const listeners = new Set<Listener>();

/** Defensive parse: anything unexpected is "nothing remembered". */
export function parseUnlockMemory(raw: string | null): UnlockMemory {
  if (!raw) return EMPTY;
  try {
    const j = JSON.parse(raw) as { told?: unknown; opened?: unknown };
    const arr = (x: unknown): FeatureId[] => (Array.isArray(x) ? x.filter((s): s is FeatureId => typeof s === 'string') : []);
    return { v: 1, told: arr(j.told), opened: arr(j.opened) };
  } catch { return EMPTY; }
}

function load(): void {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try { current = parseUnlockMemory(window.localStorage.getItem(UNLOCKS_KEY)); } catch { current = EMPTY; }
}

function commit(next: UnlockMemory): void {
  current = next;
  try { window.localStorage.setItem(UNLOCKS_KEY, JSON.stringify(next)); } catch { /* private mode: still works for this visit */ }
  listeners.forEach(l => l());
}

const withAll = (list: FeatureId[], ids: FeatureId[]): FeatureId[] => {
  const s = new Set(list);
  let changed = false;
  for (const id of ids) if (!s.has(id)) { s.add(id); changed = true; }
  return changed ? Array.from(s) : list;
};

export const unlockMemory = {
  /** Stable snapshot (the same object until something changes). */
  get(): UnlockMemory { load(); return current; },
  /** Server render and first hydration pass: nothing remembered. */
  getServer(): UnlockMemory { return EMPTY; },
  subscribe(l: Listener): () => void { listeners.add(l); return () => { listeners.delete(l); }; },
  /** The player has been shown the "unlocked" notice for these. */
  markTold(ids: FeatureId[]): void {
    load();
    const told = withAll(current.told, ids);
    if (told !== current.told) commit({ ...current, told });
  },
  /** The player has opened this feature at least once: its "new" glow ends for good. */
  markOpened(id: FeatureId): void {
    load();
    const opened = withAll(current.opened, [id]);
    if (opened !== current.opened) commit({ ...current, opened });
  },
  /** Both at once, for returning players whose earlier progress should not be announced. */
  markSeenQuietly(ids: FeatureId[]): void {
    load();
    const told = withAll(current.told, ids), opened = withAll(current.opened, ids);
    if (told !== current.told || opened !== current.opened) commit({ v: 1, told, opened });
  },
  /** "Start over": everything is locked again, so everything is new again. */
  reset(): void { load(); commit(EMPTY); },
  /** Test helper. */
  _reset(): void { current = EMPTY; loaded = false; listeners.clear(); },
};
