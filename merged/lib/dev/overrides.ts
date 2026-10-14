import { useSyncExternalStore } from 'react';
import { clientDevToolsEnabled } from './env';

/* ============================================================================
   DEVELOPER OVERRIDES — the one place that says "this tester may bypass the
   normal progression".

   Three things are kept strictly apart (they are three different concepts):
     • completion / discovery records  — the game's own saves, untouched here;
     • developer overrides             — this file: switches that only change
                                         what is *reachable*, never what is
                                         *recorded*, and are never written into
                                         a game save;
     • the beta test save              — the same saves, but in the beta's own
                                         storage namespace (see storageBoot.ts).

   An override is only ever in effect when ALL of these hold:
     1. the build is the Developer Beta (NEXT_PUBLIC_ENABLE_DEV_TOOLS, and not a
        production deploy) — see env.ts;
     2. the server confirmed the beta (`setAuthorized(true)`, after
        GET /api/dev/status answered 200);
     3. the tester switched it on.
   In any other situation `get()` returns NO_OVERRIDES — whatever is sitting in
   localStorage, the URL or a cookie. Nothing here reads the URL.
   ========================================================================== */

export interface DevOverrides {
  /** Every feature, view and mode is open (lib/unlocks), whatever the player has reached. */
  unlockAll: boolean;
  /** Era / tier gates in the engine and the Civilization chapter order are ignored. */
  chronology: boolean;
  /** Cinematic openings (mode gates, landing film) are skipped. */
  skipIntros: boolean;
  /** The console may list and inspect every discovery node, found or not. */
  revealAll: boolean;
  /** Visual animation speed multiplier (1 = normal). */
  speed: number;
  /** Fixed seed for the procedural modes (Survival, Archaeologist, Decipher, Alien, Reverse). '' = normal (time-based). */
  seed: string;
}

/** A seed is a short, boring token: letters, digits, dash, underscore. Anything else is dropped. */
export const cleanSeed = (v: unknown): string =>
  typeof v === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(v) ? v : '';

export const NO_OVERRIDES: Readonly<DevOverrides> = Object.freeze({
  unlockAll: false, chronology: false, skipIntros: false, revealAll: false, speed: 1, seed: '',
});

/** What a tester gets on first opening the beta: everything reachable, normal speed. */
export const BETA_DEFAULTS: Readonly<DevOverrides> = Object.freeze({
  unlockAll: true, chronology: true, skipIntros: false, revealAll: false, speed: 1, seed: '',
});

export const SPEEDS = [0.5, 1, 2, 4, 10] as const;

export const DEV_OVERRIDES_KEY = 'evo.dev.v1';

export type AuthPhase = 'off' | 'checking' | 'ok' | 'denied' | 'error';

/** Defensive parse: anything unexpected falls back to the beta defaults, never throws. */
export function parseOverrides(raw: string | null): DevOverrides {
  const base: DevOverrides = { ...BETA_DEFAULTS };
  if (!raw) return base;
  try {
    const j = JSON.parse(raw) as Partial<Record<keyof DevOverrides, unknown>>;
    if (typeof j.unlockAll === 'boolean') base.unlockAll = j.unlockAll;
    if (typeof j.chronology === 'boolean') base.chronology = j.chronology;
    if (typeof j.skipIntros === 'boolean') base.skipIntros = j.skipIntros;
    if (typeof j.revealAll === 'boolean') base.revealAll = j.revealAll;
    if (typeof j.speed === 'number' && (SPEEDS as readonly number[]).includes(j.speed)) base.speed = j.speed;
    base.seed = cleanSeed(j.seed);
  } catch { /* corrupt: defaults */ }
  return base;
}

type Listener = () => void;

export interface OverrideDeps {
  /** Is this the beta build? Read on every call so tests can flip it. */
  enabled: () => boolean;
  storage: () => Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
}

const browserStorage = (): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null => {
  try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; }
};

export class DevOverrideStore {
  private stored: DevOverrides = { ...BETA_DEFAULTS };
  private loaded = false;
  private authorized = false;
  private phase: AuthPhase = 'off';
  /** >0 while a scenario runner needs the chronology gates open for a moment. */
  private forced = 0;
  private snapshot: Readonly<DevOverrides> = NO_OVERRIDES;
  private listeners = new Set<Listener>();
  private version = 0;

  constructor(private deps: OverrideDeps = { enabled: clientDevToolsEnabled, storage: browserStorage }) {}

  private load(): void {
    if (this.loaded) return;
    this.loaded = true;
    if (!this.deps.enabled()) return;
    try { this.stored = parseOverrides(this.deps.storage()?.getItem(DEV_OVERRIDES_KEY) ?? null); } catch { /* defaults */ }
  }

  private compute(): Readonly<DevOverrides> {
    if (!this.deps.enabled() || !this.authorized) return NO_OVERRIDES;
    this.load();
    const o = this.forced > 0 ? { ...this.stored, chronology: true } : this.stored;
    const prev = this.snapshot;
    // keep the same object while nothing changed (useSyncExternalStore relies on it)
    if (prev !== NO_OVERRIDES
      && prev.unlockAll === o.unlockAll && prev.chronology === o.chronology && prev.skipIntros === o.skipIntros
      && prev.revealAll === o.revealAll && prev.speed === o.speed && prev.seed === o.seed) return prev;
    return Object.freeze({ ...o });
  }

  private refresh(): void {
    this.snapshot = this.compute();
    this.version++;
    this.listeners.forEach(l => l());
  }

  /** The overrides in effect right now (NO_OVERRIDES unless beta + server-authorised). */
  get = (): Readonly<DevOverrides> => {
    const next = this.compute();
    if (next !== this.snapshot) this.snapshot = next;
    return this.snapshot;
  };
  /** Server render and first hydration pass: no overrides. */
  getServer = (): Readonly<DevOverrides> => NO_OVERRIDES;
  getVersion = (): number => this.version;
  subscribe = (l: Listener): (() => void) => { this.listeners.add(l); return () => { this.listeners.delete(l); }; };

  /** The tester's saved switches, regardless of authorisation (for the console's own display). */
  getStored = (): Readonly<DevOverrides> => { this.load(); return this.stored; };

  authPhase = (): AuthPhase => (this.deps.enabled() ? this.phase : 'off');
  isActive = (): boolean => this.deps.enabled() && this.authorized;

  setPhase(phase: AuthPhase): void {
    if (!this.deps.enabled()) return;
    this.authorized = phase === 'ok';
    this.phase = phase;
    this.refresh();
  }

  /** Change one or more switches. Ignored outside an authorised beta. */
  set(patch: Partial<DevOverrides>): void {
    if (!this.isActive()) return;
    this.load();
    const next = { ...this.stored, ...patch };
    if (!(SPEEDS as readonly number[]).includes(next.speed)) next.speed = 1;
    next.seed = cleanSeed(next.seed);
    this.stored = next;
    try { this.deps.storage()?.setItem(DEV_OVERRIDES_KEY, JSON.stringify(next)); } catch { /* storage blocked: stays in memory */ }
    this.refresh();
  }

  /** Back to the beta defaults (the saves are not touched). */
  restoreDefaults(): void {
    if (!this.isActive()) return;
    this.set({ ...BETA_DEFAULTS });
  }

  /** Run `fn` with the chronology gates open, then put them back exactly as they were. */
  withChronology<T>(fn: () => T): T {
    if (!this.isActive()) return fn();
    this.forced++;
    this.refresh();
    try { return fn(); } finally { this.forced--; this.refresh(); }
  }

  /** Test helper. */
  _reset(): void {
    this.stored = { ...BETA_DEFAULTS }; this.loaded = false; this.authorized = false; this.phase = 'off';
    this.forced = 0; this.snapshot = NO_OVERRIDES; this.listeners.clear(); this.version = 0;
  }
}

/** The shared instance. */
export const devOverrides = new DevOverrideStore();

/** React: the overrides in effect (NO_OVERRIDES everywhere outside an authorised beta). */
export function useDevOverrides(): Readonly<DevOverrides> {
  return useSyncExternalStore(devOverrides.subscribe, devOverrides.get, devOverrides.getServer);
}

/** Hooks handed to the Engine. In production every call answers "no". */
export const engineDevHooks = {
  enabled: (): boolean => devOverrides.isActive(),
  chronology: (): boolean => devOverrides.get().chronology,
};
