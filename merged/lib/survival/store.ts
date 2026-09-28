/* ============================================================================
   SURVIVAL STORE — `evo.survival.v1`, independent of Main Evolution's save
   and of every other mode's. Holds at most one active run (so leaving and
   returning resumes exactly where the player left off — the brief's "mode
   resume system") plus a list of completed-run memories, which the Museum
   gallery reads to show camp memories alongside Main Evolution's own
   exhibits (see lib/survival/memory.ts).
   ========================================================================== */
import { runMigrations } from '../save/migrate';
import type { Migration } from '../save/types';
import type { CampMemory, CampState, SurvivalSave } from './types';

const KEY = 'evo.survival.v1';
const CURRENT_VERSION = 1;
const isBrowser = () => typeof window !== 'undefined';

const migrations: Migration[] = [];

function isValid(d: unknown): d is SurvivalSave {
  if (typeof d !== 'object' || d === null) return false;
  const o = d as Record<string, unknown>;
  return o.v === CURRENT_VERSION && Array.isArray(o.memories) && (o.active === null || typeof o.active === 'object');
}

function blank(): SurvivalSave {
  return { v: CURRENT_VERSION, active: null, memories: [] };
}

class SurvivalStore {
  private data: SurvivalSave = blank();
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
      const out = runMigrations<SurvivalSave>(JSON.parse(raw), { currentVersion: CURRENT_VERSION, migrations, isValid });
      if (out.data) { this.data = out.data; this.notify(); }
    } catch { /* storage blocked or corrupt — start blank, never crash */ }
  }

  private persist(): void {
    if (!isBrowser()) return;
    try { window.localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* best-effort */ }
  }

  get(): Readonly<SurvivalSave> { return this.data; }

  setActive(state: CampState): void {
    this.data = { ...this.data, active: state };
    this.persist();
    this.notify();
  }

  /** Moves the active run into memories (only meaningful once it has
   *  ended) and clears it, ready for a new run. */
  archiveActive(memory: CampMemory): void {
    this.data = { ...this.data, active: null, memories: [memory, ...this.data.memories].slice(0, 20) };
    this.persist();
    this.notify();
  }

  reset(): void {
    this.data = blank();
    if (isBrowser()) { try { window.localStorage.removeItem(KEY); } catch { /* best-effort */ } }
    this.notify();
  }
}

export const survivalStore = new SurvivalStore();
