/* ============================================================================
   REVERSE EVOLUTION STORE — `evo.reverseevolution.v1`, independent of
   every other mode's save. Same shape as every other mode's store.
   ========================================================================== */
import { runMigrations } from '../save/migrate';
import type { Migration } from '../save/types';
import type { ReverseEvolutionSave, ReverseMemory, ReverseRunState } from './types';

const KEY = 'evo.reverseevolution.v1';
const CURRENT_VERSION = 1;
const isBrowser = () => typeof window !== 'undefined';

const migrations: Migration[] = [];

function isValid(d: unknown): d is ReverseEvolutionSave {
  if (typeof d !== 'object' || d === null) return false;
  const o = d as Record<string, unknown>;
  return o.v === CURRENT_VERSION && Array.isArray(o.runs) && (o.active === null || typeof o.active === 'object');
}

function blank(): ReverseEvolutionSave {
  return { v: CURRENT_VERSION, active: null, runs: [] };
}

class ReverseEvolutionStore {
  private data: ReverseEvolutionSave = blank();
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
      const out = runMigrations<ReverseEvolutionSave>(JSON.parse(raw), { currentVersion: CURRENT_VERSION, migrations, isValid });
      if (out.data) { this.data = out.data; this.notify(); }
    } catch { /* storage blocked or corrupt — start blank, never crash */ }
  }

  private persist(): void {
    if (!isBrowser()) return;
    try { window.localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* best-effort */ }
  }

  get(): Readonly<ReverseEvolutionSave> { return this.data; }

  setActive(state: ReverseRunState): void {
    this.data = { ...this.data, active: state };
    this.persist();
    this.notify();
  }

  archiveActive(memory: ReverseMemory): void {
    this.data = { ...this.data, active: null, runs: [memory, ...this.data.runs].slice(0, 20) };
    this.persist();
    this.notify();
  }

  reset(): void {
    this.data = blank();
    if (isBrowser()) { try { window.localStorage.removeItem(KEY); } catch { /* best-effort */ } }
    this.notify();
  }
}

export const reverseEvolutionStore = new ReverseEvolutionStore();
