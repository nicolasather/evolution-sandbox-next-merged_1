/* ============================================================================
   ALIEN ARCHAEOLOGY STORE — `evo.alienarchaeology.v1`, independent of
   every other mode's save. Same shape as every other mode's store.
   ========================================================================== */
import { runMigrations } from '../save/migrate';
import type { Migration } from '../save/types';
import type { AlienArchaeologySave, AlienMemory, AlienSiteState } from './types';

const KEY = 'evo.alienarchaeology.v1';
const CURRENT_VERSION = 1;
const isBrowser = () => typeof window !== 'undefined';

const migrations: Migration[] = [];

function isValid(d: unknown): d is AlienArchaeologySave {
  if (typeof d !== 'object' || d === null) return false;
  const o = d as Record<string, unknown>;
  return o.v === CURRENT_VERSION && Array.isArray(o.reports) && (o.active === null || typeof o.active === 'object');
}

function blank(): AlienArchaeologySave {
  return { v: CURRENT_VERSION, active: null, reports: [] };
}

class AlienArchaeologyStore {
  private data: AlienArchaeologySave = blank();
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
      const out = runMigrations<AlienArchaeologySave>(JSON.parse(raw), { currentVersion: CURRENT_VERSION, migrations, isValid });
      if (out.data) { this.data = out.data; this.notify(); }
    } catch { /* storage blocked or corrupt — start blank, never crash */ }
  }

  private persist(): void {
    if (!isBrowser()) return;
    try { window.localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* best-effort */ }
  }

  get(): Readonly<AlienArchaeologySave> { return this.data; }

  setActive(state: AlienSiteState): void {
    this.data = { ...this.data, active: state };
    this.persist();
    this.notify();
  }

  archiveActive(memory: AlienMemory): void {
    this.data = { ...this.data, active: null, reports: [memory, ...this.data.reports].slice(0, 20) };
    this.persist();
    this.notify();
  }

  reset(): void {
    this.data = blank();
    if (isBrowser()) { try { window.localStorage.removeItem(KEY); } catch { /* best-effort */ } }
    this.notify();
  }
}

export const alienArchaeologyStore = new AlienArchaeologyStore();
