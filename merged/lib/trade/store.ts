/* ============================================================================
   TRADE STORE — Main Evolution's world-layer trade state: which region the
   player's group calls home, and which corridors they have established a
   route along. Persisted separately (`evo.trade.v1`) from Main Evolution's
   own save (`evo.sandbox.v1`, untouched by this system) and from the shared
   profile — losing or resetting this never touches discoveries made, and
   resetting Main Evolution never touches this. Entirely inert until a home
   region is chosen; see lib/modes/flags.ts's 'trade-routes' flag and
   lib/trade/gate.ts's regionGateFor (null home region ⇒ never gates).
   ========================================================================== */
import { isAdjacent } from './adjacency';
import { runMigrations } from '../save/migrate';
import type { Migration } from '../save/types';
import type { GeoId, TradeRoute, TradeSave } from './types';

const KEY = 'evo.trade.v1';
const CURRENT_VERSION = 1;
const isBrowser = () => typeof window !== 'undefined';

const migrations: Migration[] = [];

function isValid(d: unknown): d is TradeSave {
  if (typeof d !== 'object' || d === null) return false;
  const o = d as Record<string, unknown>;
  return o.v === CURRENT_VERSION
    && (o.homeRegion === null || typeof o.homeRegion === 'string')
    && Array.isArray(o.routes);
}

function blank(): TradeSave {
  return { v: CURRENT_VERSION, homeRegion: null, routes: [] };
}

export type EstablishResult = 'ok' | 'already-connected' | 'not-adjacent' | 'no-home-region';

class TradeStore {
  private data: TradeSave = blank();
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
      const out = runMigrations<TradeSave>(JSON.parse(raw), { currentVersion: CURRENT_VERSION, migrations, isValid });
      if (out.data) { this.data = out.data; this.notify(); }
    } catch { /* storage blocked or corrupt — start blank, never crash */ }
  }

  private persist(): void {
    if (!isBrowser()) return;
    try { window.localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* best-effort */ }
  }

  get(): Readonly<TradeSave> { return this.data; }

  setHomeRegion(region: GeoId): void {
    if (this.data.homeRegion === region) return;
    this.data = { ...this.data, homeRegion: region };
    this.persist();
    this.notify();
  }

  hasRoute(a: GeoId, b: GeoId): boolean {
    return this.data.routes.some(r => (r.a === a && r.b === b) || (r.a === b && r.b === a));
  }

  /** Founds a direct route between two adjacent regions (see lib/trade/
   *  adjacency.ts) — multi-hop reach comes from composing several direct
   *  routes, not from founding one directly between distant regions. */
  establishRoute(a: GeoId, b: GeoId): EstablishResult {
    if (!this.data.homeRegion) return 'no-home-region';
    if (this.hasRoute(a, b)) return 'already-connected';
    if (!isAdjacent(a, b)) return 'not-adjacent';
    const route: TradeRoute = { id: `${a}|${b}|${Date.now()}`, a, b, establishedAt: Date.now() };
    this.data = { ...this.data, routes: [...this.data.routes, route] };
    this.persist();
    this.notify();
    return 'ok';
  }

  reset(): void {
    this.data = blank();
    if (isBrowser()) { try { window.localStorage.removeItem(KEY); } catch { /* best-effort */ } }
    this.notify();
  }
}

export const tradeStore = new TradeStore();
