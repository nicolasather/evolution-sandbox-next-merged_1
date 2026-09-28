/* ============================================================================
   CIVILIZATION STORE — `evo.civilization.v1`, independent of every other
   save. One active settlement (resumable) plus a history of finished
   Civilization Dioramas, which the Museum gallery reads alongside Main
   Evolution's exhibits and Survival's Camp Memories.
   ========================================================================== */
import { runMigrations } from '../save/migrate';
import type { Migration } from '../save/types';
import type { CivilizationSave, SettlementMemory, SettlementState } from './types';

const KEY = 'evo.civilization.v1';
const CURRENT_VERSION = 1;
const isBrowser = () => typeof window !== 'undefined';

const migrations: Migration[] = [];

function isValid(d: unknown): d is CivilizationSave {
  if (typeof d !== 'object' || d === null) return false;
  const o = d as Record<string, unknown>;
  return o.v === CURRENT_VERSION && Array.isArray(o.dioramas) && (o.active === null || typeof o.active === 'object');
}

function blank(): CivilizationSave {
  return { v: CURRENT_VERSION, active: null, dioramas: [] };
}

class CivilizationStore {
  private data: CivilizationSave = blank();
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
      const out = runMigrations<CivilizationSave>(JSON.parse(raw), { currentVersion: CURRENT_VERSION, migrations, isValid });
      if (out.data) { this.data = out.data; this.notify(); }
    } catch { /* storage blocked or corrupt — start blank, never crash */ }
  }

  private persist(): void {
    if (!isBrowser()) return;
    try { window.localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* best-effort */ }
  }

  get(): Readonly<CivilizationSave> { return this.data; }

  setActive(state: SettlementState): void {
    this.data = { ...this.data, active: state };
    this.persist();
    this.notify();
  }

  archiveActive(memory: SettlementMemory): void {
    this.data = { ...this.data, active: null, dioramas: [memory, ...this.data.dioramas].slice(0, 20) };
    this.persist();
    this.notify();
  }

  reset(): void {
    this.data = blank();
    if (isBrowser()) { try { window.localStorage.removeItem(KEY); } catch { /* best-effort */ } }
    this.notify();
  }
}

export const civilizationStore = new CivilizationStore();
