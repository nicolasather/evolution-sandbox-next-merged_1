/* ============================================================================
   HUMANITY MUSEUM STATE — `evo.museum.v1`, separate from Main Evolution's
   save and from every extra mode's.

   Keeps four DISTINCT per-exhibit states (lib/museum/history/types.ts's
   ExhibitState): eligible (the canonical timeline has passed its unlock
   point), revealed (it has been shown in the Museum), visited (the player
   focused it) and detailOpened (the deeper explanation was read). An exhibit
   can be eligible and never yet seen; nothing here ever conflates the two.

   Eligibility is written ONLY by sync(year), fed the canonical timeline year
   (lib/museum/history/timeline.ts). Nothing in this file looks at inventory.
   ========================================================================== */
import { runMigrations } from '../../save/migrate';
import type { Migration } from '../../save/types';
import type { Catalog } from './data';
import { unlockOf } from './util';
import { isMajor } from './selectors';
import type { ExhibitState, GalleryState, MuseumMetrics, Year } from './types';

const KEY = 'evo.museum.v1';
const CURRENT_VERSION = 1;
const isBrowser = () => typeof window !== 'undefined';
const migrations: Migration[] = [];

export interface MuseumSave {
  v: 1;
  [key: string]: unknown;
  /** Last canonical year synced (undefined before the first sync). */
  year?: Year;
  exhibits: Record<string, ExhibitState>;
  galleries: Record<string, GalleryState>;
  /** Defining achievements that became available since the player was last in the Museum,
   *  waiting for their cinematic reveal (played once, on entering). */
  pendingReveals: string[];
  /** Galleries opened since the last visit, waiting for their "new gallery" moment. */
  pendingGalleries: string[];
}

/** A restrained, in-game signal: something important became historically available. */
export type MuseumSignal =
  | { kind: 'gallery'; galleryId: string; count: number }
  | { kind: 'defining'; exhibitId: string; count: number };

export interface SyncResult { newlyEligible: string[]; newGalleries: string[]; newDefining: string[]; reset: boolean }

function isValid(d: unknown): d is MuseumSave {
  if (typeof d !== 'object' || d === null) return false;
  const o = d as Record<string, unknown>;
  return o.v === CURRENT_VERSION && typeof o.exhibits === 'object' && o.exhibits !== null
    && typeof o.galleries === 'object' && o.galleries !== null
    && Array.isArray(o.pendingReveals) && Array.isArray(o.pendingGalleries);
}

function blank(): MuseumSave {
  return { v: 1, exhibits: {}, galleries: {}, pendingReveals: [], pendingGalleries: [] };
}

export class MuseumStore {
  private data: MuseumSave = blank();
  private version = 0;
  private loaded = false;
  private listeners = new Set<() => void>();
  private signalListeners = new Set<(s: MuseumSignal) => void>();

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };
  getVersion = (): number => this.version;
  private notify(): void { this.version++; this.listeners.forEach(cb => cb()); }

  /** Restrained in-game signals (see components/museum/MuseumSignal.tsx). */
  onSignal(fn: (s: MuseumSignal) => void): () => void {
    this.signalListeners.add(fn);
    return () => { this.signalListeners.delete(fn); };
  }

  load(): void {
    if (this.loaded || !isBrowser()) return;
    this.loaded = true;
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return;
      const out = runMigrations<MuseumSave>(JSON.parse(raw), { currentVersion: CURRENT_VERSION, migrations, isValid });
      if (out.data) { this.data = out.data; this.notify(); }
    } catch { /* storage blocked or corrupt — start blank, never crash */ }
  }

  private persist(): void {
    if (!isBrowser()) return;
    try { window.localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* best-effort */ }
  }

  get(): Readonly<MuseumSave> { return this.data; }
  state(id: string): ExhibitState { return this.data.exhibits[id] ?? {}; }
  galleryState(id: string): GalleryState { return this.data.galleries[id] ?? {}; }

  /**
   * Bring eligibility in line with the canonical timeline. Idempotent.
   * The first sync of a save establishes a baseline silently (a returning
   * player is not shown a cinematic for everything already behind them);
   * afterwards, newly available DEFINING exhibits and newly opened galleries
   * are queued for their reveal. If the timeline moved backwards (the game
   * was reset) the Museum's memory is cleared with it.
   */
  sync(year: Year, cat: Catalog, now = Date.now()): SyncResult {
    const res: SyncResult = { newlyEligible: [], newGalleries: [], newDefining: [], reset: false };
    const first = this.data.year === undefined;
    if (!first && year < (this.data.year as number)) {
      this.data = blank();
      res.reset = true;
    }
    const baseline = first || res.reset;
    const exhibits = { ...this.data.exhibits };
    let changed = res.reset || this.data.year !== year;
    for (const e of cat.exhibits) {
      const st = exhibits[e.id];
      const eligible = unlockOf(e) <= year;
      if (eligible && !st?.eligibleAt) {
        exhibits[e.id] = { ...st, eligibleAt: now, eligibleYear: year };
        res.newlyEligible.push(e.id);
        if (!baseline && e.importance === 'defining') res.newDefining.push(e.id);
        changed = true;
      } else if (!eligible && st?.eligibleAt) {
        const { eligibleAt: _a, eligibleYear: _y, ...rest } = st;
        void _a; void _y;
        exhibits[e.id] = rest;
        changed = true;
      }
    }
    const galleries = { ...this.data.galleries };
    for (const g of cat.galleries) {
      const opens = cat.galleryOpensAt.get(g.id) ?? g.span.from;
      if (year >= opens && !galleries[g.id]?.openedAt) {
        galleries[g.id] = { ...galleries[g.id], openedAt: now, ...(baseline ? { revealedAt: now } : {}) };
        if (!baseline) res.newGalleries.push(g.id);
        changed = true;
      }
    }
    if (!changed) return res;
    const pendingReveals = [...new Set([...this.data.pendingReveals, ...res.newDefining])];
    const pendingGalleries = [...new Set([...this.data.pendingGalleries, ...res.newGalleries])];
    this.data = { ...this.data, v: 1, year, exhibits, galleries, pendingReveals, pendingGalleries };
    this.persist();
    this.notify();
    // one quiet signal per sync, carrying the most important thing that happened
    if (res.newGalleries.length) {
      const s: MuseumSignal = { kind: 'gallery', galleryId: res.newGalleries[res.newGalleries.length - 1], count: res.newlyEligible.length };
      this.signalListeners.forEach(fn => fn(s));
    } else if (res.newDefining.length) {
      const s: MuseumSignal = { kind: 'defining', exhibitId: res.newDefining[res.newDefining.length - 1], count: res.newlyEligible.length };
      this.signalListeners.forEach(fn => fn(s));
    }
    return res;
  }

  private patch(id: string, fields: Partial<ExhibitState>): void {
    const st = this.data.exhibits[id] ?? {};
    const next = { ...st };
    let changed = false;
    for (const [k, v] of Object.entries(fields) as [keyof ExhibitState, number][]) {
      if (next[k] === undefined) { next[k] = v; changed = true; }
    }
    if (!changed) return;
    this.data = { ...this.data, exhibits: { ...this.data.exhibits, [id]: next } };
    this.persist();
    this.notify();
  }

  /** Shown in the hall (or in a reveal). Only an eligible exhibit can be revealed. */
  markRevealed(ids: readonly string[], now = Date.now()): void {
    let changed = false;
    const exhibits = { ...this.data.exhibits };
    for (const id of ids) {
      const st = exhibits[id];
      if (!st?.eligibleAt || st.revealedAt) continue;
      exhibits[id] = { ...st, revealedAt: now };
      changed = true;
    }
    if (!changed) return;
    this.data = { ...this.data, exhibits };
    this.persist();
    this.notify();
  }

  markVisited(id: string, now = Date.now()): void {
    if (!this.data.exhibits[id]?.eligibleAt) return;
    this.patch(id, { revealedAt: now, visitedAt: now });
  }

  markDetailOpened(id: string, now = Date.now()): void {
    if (!this.data.exhibits[id]?.eligibleAt) return;
    this.patch(id, { revealedAt: now, visitedAt: now, detailOpenedAt: now });
  }

  /** The next queued cinematic, most important first: a gallery opening, then a defining achievement. */
  peekReveal(): { kind: 'gallery' | 'exhibit'; id: string } | null {
    if (this.data.pendingGalleries.length) return { kind: 'gallery', id: this.data.pendingGalleries[0] };
    if (this.data.pendingReveals.length) return { kind: 'exhibit', id: this.data.pendingReveals[0] };
    return null;
  }

  /** The reveal has played (or was skipped). */
  consumeReveal(kind: 'gallery' | 'exhibit', id: string, now = Date.now()): void {
    if (kind === 'gallery') {
      this.data = {
        ...this.data,
        pendingGalleries: this.data.pendingGalleries.filter(g => g !== id),
        galleries: { ...this.data.galleries, [id]: { ...this.data.galleries[id], revealedAt: now } },
      };
    } else {
      const st = this.data.exhibits[id] ?? {};
      this.data = {
        ...this.data,
        pendingReveals: this.data.pendingReveals.filter(e => e !== id),
        exhibits: { ...this.data.exhibits, [id]: { ...st, revealedAt: st.revealedAt ?? now } },
      };
    }
    this.persist();
    this.notify();
  }

  /** Skip every queued cinematic at once. */
  clearReveals(now = Date.now()): void {
    const galleries = { ...this.data.galleries };
    for (const g of this.data.pendingGalleries) galleries[g] = { ...galleries[g], revealedAt: now };
    this.data = { ...this.data, pendingGalleries: [], pendingReveals: [], galleries };
    this.persist();
    this.notify();
  }

  /** Eligible but not yet shown — the understated "new" emphasis and the top-bar hint. */
  unseenCount(): number {
    let n = 0;
    for (const st of Object.values(this.data.exhibits)) if (st.eligibleAt && !st.revealedAt) n++;
    return n;
  }

  metrics(cat: Catalog): MuseumMetrics {
    const year = this.data.year ?? cat.calendar.start;
    let available = 0, revealed = 0, visited = 0, detailOpened = 0, majorAvailable = 0, majorEncountered = 0;
    const geos = new Set<string>();
    for (const e of cat.exhibits) {
      if (unlockOf(e) > year) continue;
      available++;
      const st = this.data.exhibits[e.id] ?? {};
      if (st.revealedAt) revealed++;
      if (st.visitedAt) visited++;
      if (st.detailOpenedAt) detailOpened++;
      if (isMajor(e)) { majorAvailable++; if (st.visitedAt) majorEncountered++; }
      for (const l of e.regions) {
        const g = cat.regionById.get(l.region)?.geo;
        if (g && g !== 'global' && l.role !== 'spread') geos.add(g);
      }
    }
    const galleriesOpen = cat.galleries.filter(g => year >= (cat.galleryOpensAt.get(g.id) ?? g.span.from)).length;
    return {
      available, total: cat.exhibits.length, revealed, visited, detailOpened,
      majorAvailable, majorEncountered, galleriesOpen, galleriesTotal: cat.galleries.length,
      regionsRepresented: geos.size,
    };
  }

  reset(): void {
    this.data = blank();
    if (isBrowser()) { try { window.localStorage.removeItem(KEY); } catch { /* best-effort */ } }
    this.notify();
  }
}

export const museumStore = new MuseumStore();
