/* ============================================================================
   GUIDE PREFERENCES — whether the lightweight "glowing control" guide is on, per
   mode. Persisted in the browser (key `evo.guide.v1`); nothing here is part of a
   game save, so switching the guide on or off can never touch progress.

   Per-mode state:
     auto  — never touched: the guide runs only while the mode says the player is
             a beginner there (the mode computes `eligible`)
     on    — the player switched it back on from Help: runs regardless of progress
     off   — "Guide off" / "Skip guide"
     done  — the beginner guide reached its end; it never restarts by itself
   ========================================================================== */

export type GuideState = 'auto' | 'on' | 'off' | 'done';

export interface GuidePrefs { v: 1; modes: Record<string, GuideState> }

export const GUIDE_KEY = 'evo.guide.v1';
const EMPTY: GuidePrefs = { v: 1, modes: {} };

const STATES: GuideState[] = ['auto', 'on', 'off', 'done'];

/** Defensive parse: anything unexpected falls back to "never touched". */
export function parseGuidePrefs(raw: string | null): GuidePrefs {
  if (!raw) return EMPTY;
  try {
    const j = JSON.parse(raw) as { modes?: Record<string, unknown> };
    const modes: Record<string, GuideState> = {};
    for (const [k, v] of Object.entries(j?.modes ?? {})) {
      if (typeof v === 'string' && (STATES as string[]).includes(v)) modes[k] = v as GuideState;
    }
    return { v: 1, modes };
  } catch { return EMPTY; }
}

/** Whether the guide should currently run in a mode. `eligible` = the mode thinks this player is a beginner. */
export function isGuideActive(prefs: GuidePrefs, mode: string, eligible: boolean): boolean {
  const s = prefs.modes[mode] ?? 'auto';
  if (s === 'on') return true;
  if (s === 'auto') return eligible;
  return false;
}

type Listener = () => void;
let current: GuidePrefs = EMPTY;
let loaded = false;
const listeners = new Set<Listener>();

function load(): void {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try { current = parseGuidePrefs(window.localStorage.getItem(GUIDE_KEY)); } catch { current = EMPTY; }
}

function commit(next: GuidePrefs): void {
  current = next;
  try { window.localStorage.setItem(GUIDE_KEY, JSON.stringify(next)); } catch { /* private mode: keeps working for this visit */ }
  listeners.forEach(l => l());
}

export const guidePrefs = {
  /** Stable snapshot (the same object until something changes). */
  get(): GuidePrefs { load(); return current; },
  /** Server render and first hydration pass: never touched. */
  getServer(): GuidePrefs { return EMPTY; },
  subscribe(l: Listener): () => void { listeners.add(l); return () => { listeners.delete(l); }; },
  set(mode: string, state: GuideState): void {
    load();
    if ((current.modes[mode] ?? 'auto') === state) return;
    commit({ v: 1, modes: { ...current.modes, [mode]: state } });
  },
  /** "Guide off" / "Skip guide". */
  skip(mode: string): void { this.set(mode, 'off'); },
  /** The beginner guide reached its end. */
  complete(mode: string): void { this.set(mode, 'done'); },
  /** Help → "Guide on": runs again whatever the progress. */
  enable(mode: string): void { this.set(mode, 'on'); },
  /** Test helper: forget everything (and re-read storage next time). */
  _reset(): void { current = EMPTY; loaded = false; listeners.clear(); },
};
