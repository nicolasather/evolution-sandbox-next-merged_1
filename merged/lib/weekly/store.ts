/* ============================================================================
   WEEKLY MEGA CHALLENGE STORE — `evo.weekly.v1`, independent of every other
   mode's save. Holds only this week's progress (which stage it's on, and
   each completed stage's result) plus a capped history of finished weeks —
   never an in-progress stage's own minute-by-minute state (clicks so far,
   the sudoku order being tried, which riddles are answered), same as every
   other mode here only ever persists what's been filed, not an active run.
   Same shape as lib/archaeology/store.ts and friends.
   ========================================================================== */
import { runMigrations } from '../save/migrate';
import type { Migration } from '../save/types';
import type { WeeklyHistoryEntry, WeeklyProgress, WeeklySave } from './types';

const KEY = 'evo.weekly.v1';
const CURRENT_VERSION = 1;
const isBrowser = () => typeof window !== 'undefined';

const migrations: Migration[] = [];

function isValid(d: unknown): d is WeeklySave {
  if (typeof d !== 'object' || d === null) return false;
  const o = d as Record<string, unknown>;
  return o.v === CURRENT_VERSION && Array.isArray(o.history) && (o.current === null || typeof o.current === 'object');
}

function blank(): WeeklySave {
  return { v: CURRENT_VERSION, current: null, history: [] };
}

class WeeklyStore {
  private data: WeeklySave = blank();
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
      const out = runMigrations<WeeklySave>(JSON.parse(raw), { currentVersion: CURRENT_VERSION, migrations, isValid });
      if (out.data) { this.data = out.data; this.notify(); }
    } catch { /* storage blocked or corrupt — start blank, never crash */ }
  }

  private persist(): void {
    if (!isBrowser()) return;
    try { window.localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* best-effort */ }
  }

  get(): Readonly<WeeklySave> { return this.data; }

  setProgress(progress: WeeklyProgress): void {
    this.data = { ...this.data, current: progress };
    this.persist();
    this.notify();
  }

  /** Files a just-finished week into history (once), keyed by week so a
   *  duplicate call (a stray re-render, a second click) never adds it
   *  twice. No-op unless the current progress is actually complete. */
  archiveIfComplete(scenarioId: string): void {
    const cur = this.data.current;
    if (!cur || cur.completedStages < 3 || cur.finishedAt === null) return;
    if (this.data.history.some(h => h.week === cur.week)) return;
    const entry: WeeklyHistoryEntry = { week: cur.week, scenarioId, finishedAt: cur.finishedAt };
    this.data = { ...this.data, history: [entry, ...this.data.history].slice(0, 26) };
    this.persist();
    this.notify();
  }

  reset(): void {
    this.data = blank();
    if (isBrowser()) { try { window.localStorage.removeItem(KEY); } catch { /* best-effort */ } }
    this.notify();
  }
}

export const weeklyStore = new WeeklyStore();
