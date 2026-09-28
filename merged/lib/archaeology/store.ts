/* ============================================================================
   ARCHAEOLOGY STORE — `evo.archaeology.v1`, independent of every other
   mode's save. Holds at most one active dig plus a list of filed report
   memories, which the Museum gallery reads. Same shape as
   lib/survival/store.ts and lib/civilization/store.ts.
   ========================================================================== */
import { runMigrations } from '../save/migrate';
import type { Migration } from '../save/types';
import type { ArchaeologySave, SiteMemory, SiteState } from './types';

const KEY = 'evo.archaeology.v1';
const CURRENT_VERSION = 1;
const isBrowser = () => typeof window !== 'undefined';

const migrations: Migration[] = [];

function isValid(d: unknown): d is ArchaeologySave {
  if (typeof d !== 'object' || d === null) return false;
  const o = d as Record<string, unknown>;
  return o.v === CURRENT_VERSION && Array.isArray(o.reports) && (o.active === null || typeof o.active === 'object');
}

function blank(): ArchaeologySave {
  return { v: CURRENT_VERSION, active: null, reports: [] };
}

class ArchaeologyStore {
  private data: ArchaeologySave = blank();
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
      const out = runMigrations<ArchaeologySave>(JSON.parse(raw), { currentVersion: CURRENT_VERSION, migrations, isValid });
      if (out.data) { this.data = out.data; this.notify(); }
    } catch { /* storage blocked or corrupt — start blank, never crash */ }
  }

  private persist(): void {
    if (!isBrowser()) return;
    try { window.localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* best-effort */ }
  }

  get(): Readonly<ArchaeologySave> { return this.data; }

  setActive(state: SiteState): void {
    this.data = { ...this.data, active: state };
    this.persist();
    this.notify();
  }

  /** Moves the active dig into reports (only meaningful once it has a
   *  filed report) and clears it, ready for a new dig. */
  archiveActive(memory: SiteMemory): void {
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

export const archaeologyStore = new ArchaeologyStore();
