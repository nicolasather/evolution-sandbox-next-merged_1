/* ============================================================================
   DECIPHER STORE — `evo.decipher.v1`, independent of every other mode's
   save. Holds at most one active puzzle+attempt pair (so leaving and
   returning resumes exactly where the player left off), whether the
   tutorial chapter has been completed, and a list of finished-puzzle
   memories the Museum gallery reads. Same shape as lib/survival/store.ts,
   lib/civilization/store.ts and lib/archaeology/store.ts.
   ========================================================================== */
import { runMigrations } from '../save/migrate';
import type { Migration } from '../save/types';
import type { DecipherAttempt, DecipherMemory, DecipherPuzzle, DecipherSave } from './types';

const KEY = 'evo.decipher.v1';
const CURRENT_VERSION = 1;
const isBrowser = () => typeof window !== 'undefined';

const migrations: Migration[] = [];

function isValid(d: unknown): d is DecipherSave {
  if (typeof d !== 'object' || d === null) return false;
  const o = d as Record<string, unknown>;
  return o.v === CURRENT_VERSION && Array.isArray(o.memories) && typeof o.tutorialCompleted === 'boolean'
    && (o.activePuzzle === null || typeof o.activePuzzle === 'object')
    && (o.activeAttempt === null || typeof o.activeAttempt === 'object');
}

function blank(): DecipherSave {
  return { v: CURRENT_VERSION, activePuzzle: null, activeAttempt: null, tutorialCompleted: false, memories: [] };
}

class DecipherStore {
  private data: DecipherSave = blank();
  private version = 0;
  private listeners = new Set<() => void>();

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };
  getVersion = (): number => this.version;
  private notify(): void { this.version++; this.listeners.forEach(cb => cb()); }

  load(): void {
    if (!isBrowser()) return;
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return;
      const out = runMigrations<DecipherSave>(JSON.parse(raw), { currentVersion: CURRENT_VERSION, migrations, isValid });
      if (out.data) { this.data = out.data; this.notify(); }
    } catch { /* storage blocked or corrupt — start blank, never crash */ }
  }

  private persist(): void {
    if (!isBrowser()) return;
    try { window.localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* best-effort */ }
  }

  get(): Readonly<DecipherSave> { return this.data; }

  setActive(puzzle: DecipherPuzzle, attempt: DecipherAttempt): void {
    this.data = { ...this.data, activePuzzle: puzzle, activeAttempt: attempt };
    this.persist();
    this.notify();
  }

  markTutorialCompleted(): void {
    this.data = { ...this.data, tutorialCompleted: true };
    this.persist();
    this.notify();
  }

  /** Moves the active puzzle into memories (only meaningful once solved
   *  or revealed) and clears it, ready for a new one. */
  archiveActive(memory: DecipherMemory): void {
    this.data = { ...this.data, activePuzzle: null, activeAttempt: null, memories: [memory, ...this.data.memories].slice(0, 20) };
    this.persist();
    this.notify();
  }

  reset(): void {
    this.data = blank();
    if (isBrowser()) { try { window.localStorage.removeItem(KEY); } catch { /* best-effort */ } }
    this.notify();
  }
}

export const decipherStore = new DecipherStore();
