/* ============================================================================
   PLAYER PROFILE — the one piece of state shared across every mode: which
   modes have been visited and where each left off, plus which Museum
   exhibits have been unlocked. Persisted separately from every mode's own
   save (`evo.profile.v1`, vs. Main Evolution's `evo.sandbox.v1`) so:
     - resetting Main Evolution never touches cross-mode history or the
       Museum, and
     - a future mode's save can be wiped or reset independently without
       losing the player's place in any other mode.
   Nothing about Main Evolution requires this file to exist — a fresh
   visitor with no profile plays exactly as before. See docs/ROADMAP-UNIVERSE
   .md, Phase 1.
   ========================================================================== */
import { runMigrations } from '../save/migrate';
import type { Migration } from '../save/types';
import type { ModeVisit, MuseumUnlock, ProfileSave } from './types';

const KEY = 'evo.profile.v1';
const CURRENT_VERSION = 1;
const isBrowser = () => typeof window !== 'undefined';

/** Nothing to migrate yet — v1 is the first shape. New fields should arrive
 *  as an additive migration step here, the same way lib/engine.ts's save
 *  grew, never as a silent shape change. */
const migrations: Migration[] = [];

function isValid(d: unknown): d is ProfileSave {
  if (typeof d !== 'object' || d === null) return false;
  const o = d as Record<string, unknown>;
  return o.v === CURRENT_VERSION
    && typeof o.createdAt === 'number'
    && typeof o.modes === 'object' && o.modes !== null
    && Array.isArray(o.museum);
}

function blank(): ProfileSave {
  return { v: CURRENT_VERSION, createdAt: Date.now(), modes: {}, museum: [] };
}

class Profile {
  private data: ProfileSave = blank();
  private version = 0;
  private listeners = new Set<() => void>();

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  getVersion = (): number => this.version;

  private notify(): void {
    this.version++;
    this.listeners.forEach(cb => cb());
  }

  /** Best-effort; never load-bearing for gameplay — mirrors lib/engine.ts's
   *  own save/load contract. Safe to call more than once (e.g. on remount). */
  load(): void {
    if (!isBrowser()) return;
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      const out = runMigrations<ProfileSave>(parsed, { currentVersion: CURRENT_VERSION, migrations, isValid });
      if (out.data) { this.data = out.data; this.notify(); }
      // A save this build cannot read (e.g. written by a newer version) is
      // left on disk untouched rather than deleted — see the version guard
      // in lib/save/migrate.ts — and this profile simply starts blank.
    } catch { /* storage blocked or corrupt JSON — start blank, never crash */ }
  }

  private persist(): void {
    if (!isBrowser()) return;
    try { window.localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* best-effort */ }
  }

  get(): Readonly<ProfileSave> { return this.data; }

  /** Call when the player opens a mode (including Main Evolution, from the
   *  Mode Hub). Creates its first visit record if this is the first time. */
  recordModeVisit(modeId: string): void {
    const now = Date.now();
    const existing = this.data.modes[modeId];
    const visit: ModeVisit = existing
      ? { ...existing, lastVisitedAt: now, visitCount: existing.visitCount + 1 }
      : { firstVisitedAt: now, lastVisitedAt: now, visitCount: 1 };
    this.data = { ...this.data, modes: { ...this.data.modes, [modeId]: visit } };
    this.persist();
    this.notify();
  }

  /** Lets a mode record exactly where to resume next time, without this
   *  module needing to understand the shape (see ModeVisit.resume). */
  setModeResume(modeId: string, resume: Record<string, unknown>): void {
    const now = Date.now();
    const existing = this.data.modes[modeId]
      ?? { firstVisitedAt: now, lastVisitedAt: now, visitCount: 0 };
    this.data = { ...this.data, modes: { ...this.data.modes, [modeId]: { ...existing, resume } } };
    this.persist();
    this.notify();
  }

  unlockExhibit(unlock: MuseumUnlock): void {
    if (this.data.museum.some(m => m.exhibitId === unlock.exhibitId)) return;
    this.data = { ...this.data, museum: [...this.data.museum, unlock] };
    this.persist();
    this.notify();
  }

  reset(): void {
    this.data = blank();
    if (isBrowser()) { try { window.localStorage.removeItem(KEY); } catch { /* best-effort */ } }
    this.notify();
  }
}

/** One shared instance for the whole app — same external-store shape as
 *  lib/engine.ts's Engine, so a future `useSyncExternalStore(profile.subscribe,
 *  profile.getVersion, ...)` hook is a two-line addition when a component
 *  needs to react to it. */
export const profile = new Profile();
