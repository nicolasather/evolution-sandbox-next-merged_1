/* ============================================================================
   ESCAPE ROOM STORE — `evo.escaperoom.v1`, independent of every other
   mode's save. Holds at most one active episode attempt (resume) plus a
   list of finished-episode memories the Museum gallery reads. Same shape
   as every other mode's store.
   ========================================================================== */
import { runMigrations } from '../save/migrate';
import type { Migration } from '../save/types';
import type { EpisodeState, EscapeMemory, EscapeRoomSave } from './types';

const KEY = 'evo.escaperoom.v1';
const CURRENT_VERSION = 1;
const isBrowser = () => typeof window !== 'undefined';

const migrations: Migration[] = [];

function isValid(d: unknown): d is EscapeRoomSave {
  if (typeof d !== 'object' || d === null) return false;
  const o = d as Record<string, unknown>;
  return o.v === CURRENT_VERSION && Array.isArray(o.memories) && (o.activeState === null || typeof o.activeState === 'object');
}

function blank(): EscapeRoomSave {
  return { v: CURRENT_VERSION, activeState: null, memories: [] };
}

class EscapeRoomStore {
  private data: EscapeRoomSave = blank();
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
      const out = runMigrations<EscapeRoomSave>(JSON.parse(raw), { currentVersion: CURRENT_VERSION, migrations, isValid });
      if (out.data) { this.data = out.data; this.notify(); }
    } catch { /* storage blocked or corrupt — start blank, never crash */ }
  }

  private persist(): void {
    if (!isBrowser()) return;
    try { window.localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* best-effort */ }
  }

  get(): Readonly<EscapeRoomSave> { return this.data; }

  setActive(state: EpisodeState): void {
    this.data = { ...this.data, activeState: state };
    this.persist();
    this.notify();
  }

  archiveActive(memory: EscapeMemory): void {
    this.data = { ...this.data, activeState: null, memories: [memory, ...this.data.memories].slice(0, 20) };
    this.persist();
    this.notify();
  }

  reset(): void {
    this.data = blank();
    if (isBrowser()) { try { window.localStorage.removeItem(KEY); } catch { /* best-effort */ } }
    this.notify();
  }
}

export const escapeRoomStore = new EscapeRoomStore();
