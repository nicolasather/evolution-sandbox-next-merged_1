/* ============================================================================
   RETENTION STORE — the one additive, versioned save for the optional layer:
   coins, owned/equipped cosmetics, achievements, daily objectives, easter eggs,
   NPC meetings, scenario results and the player's toggles.

   It lives under its own key (`evo.retention.v1`) so it can never damage the
   Main Evolution save or the shared profile, and "Start over" in the game does
   not erase what the player bought. Everything here is LOCAL to this browser —
   the wallet is personal, not a global account balance; nothing here may be
   used as proof of anything on a server.

   Rewards are idempotent: every grant is keyed (`award(key, coins)`), a key can
   only pay once, so reloads, repeated clicks and failure spam cannot duplicate
   a payout.
   ========================================================================== */

export type CosmeticCategory = 'icon' | 'effect' | 'skin' | 'decoration' | 'theme';
export const CATEGORIES: readonly CosmeticCategory[] = ['icon', 'effect', 'skin', 'decoration', 'theme'];

export interface DailyState {
  /** The three objective ids chosen for the day (stable: derived from the date). */
  picks: string[];
  progress: Record<string, number>;
  done: string[];
  /** De-duplication keys already counted today ("scene:river", "gesture:shake", "inspect:axe"…). */
  seen: string[];
}

export interface Prefs {
  companion: boolean;
  tactile: boolean;
  failGags: boolean;
  successFx: boolean;
  npc: boolean;
  events: boolean;
  eggs: boolean;
  /** Mystery silhouettes are opt-in. */
  hints: boolean;
  stickers: boolean;
  /** The sticker last chosen on the wheel. */
  sticker: string | null;
}

export interface NpcRecord { at: number; quest?: 'open' | 'done'; target?: string; doneAt?: number; visits: number }
export interface EventRecord { at: number; done?: boolean; doneAt?: number }

export interface RetentionSave {
  v: 1;
  createdAt: number;
  coins: number;
  /** award key → epoch ms. Presence means "already paid". */
  awarded: Record<string, number>;
  owned: string[];
  equipped: Partial<Record<CosmeticCategory, string>>;
  /** achievement id → epoch ms, or 0 when unlocked from progress that predates tracking. */
  achievements: Record<string, number>;
  counters: Record<string, number>;
  /** id → epoch ms found first by the retention layer (not the engine; see timeline.ts). */
  eggs: Record<string, number>;
  npcs: Record<string, NpcRecord>;
  events: Record<string, EventRecord>;
  daily: Record<string, DailyState>;
  /** UTC dates on which at least one daily objective was completed. */
  dailyDates: string[];
  scenesSeen: string[];
  stickersUsed: Record<string, number>;
  prefs: Prefs;
}

const KEY = 'evo.retention.v1';

export const DEFAULT_PREFS: Prefs = {
  companion: true, tactile: true, failGags: true, successFx: true, npc: true,
  events: true, eggs: true, hints: false, stickers: true, sticker: null,
};

function blank(): RetentionSave {
  return {
    v: 1, createdAt: Date.now(), coins: 0, awarded: {}, owned: [], equipped: {}, achievements: {},
    counters: {}, eggs: {}, npcs: {}, events: {}, daily: {}, dailyDates: [], scenesSeen: [], stickersUsed: {},
    prefs: { ...DEFAULT_PREFS },
  };
}

const isRec = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const num = (x: unknown, d = 0) => (typeof x === 'number' && Number.isFinite(x) ? x : d);
const strs = (x: unknown): string[] => (Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string').slice(0, 4000) : []);
function numMap(x: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (isRec(x)) for (const [k, v] of Object.entries(x)) if (typeof v === 'number' && Number.isFinite(v) && k.length < 200) out[k] = v;
  return out;
}

/** Accepts only what this build wrote; anything unreadable starts blank without touching other saves. */
export function sanitize(raw: unknown): RetentionSave | null {
  if (!isRec(raw) || raw.v !== 1) return null;
  const b = blank();
  const prefs = isRec(raw.prefs) ? raw.prefs : {};
  const p = { ...DEFAULT_PREFS };
  (Object.keys(DEFAULT_PREFS) as (keyof Prefs)[]).forEach(k => {
    if (k === 'sticker') { const s = prefs.sticker; p.sticker = typeof s === 'string' && s.length < 60 ? s : null; }
    else if (typeof prefs[k] === 'boolean') (p as Record<string, unknown>)[k] = prefs[k];
  });
  const equipped: Partial<Record<CosmeticCategory, string>> = {};
  if (isRec(raw.equipped)) for (const c of CATEGORIES) { const e = raw.equipped[c]; if (typeof e === 'string' && e.length < 80) equipped[c] = e; }
  const npcs: Record<string, NpcRecord> = {};
  if (isRec(raw.npcs)) for (const [k, v] of Object.entries(raw.npcs)) if (isRec(v) && k.length < 80) {
    npcs[k] = { at: num(v.at), visits: Math.max(1, num(v.visits, 1)), quest: v.quest === 'open' || v.quest === 'done' ? v.quest : undefined,
      target: typeof v.target === 'string' ? v.target : undefined, doneAt: typeof v.doneAt === 'number' ? v.doneAt : undefined };
  }
  const events: Record<string, EventRecord> = {};
  if (isRec(raw.events)) for (const [k, v] of Object.entries(raw.events)) if (isRec(v) && k.length < 100) {
    events[k] = { at: num(v.at), done: v.done === true ? true : undefined, doneAt: typeof v.doneAt === 'number' ? v.doneAt : undefined };
  }
  const daily: Record<string, DailyState> = {};
  if (isRec(raw.daily)) for (const [k, v] of Object.entries(raw.daily)) if (isRec(v) && /^\d{4}-\d{2}-\d{2}$/.test(k)) {
    daily[k] = { picks: strs(v.picks).slice(0, 6), progress: numMap(v.progress), done: strs(v.done), seen: strs(v.seen).slice(0, 200) };
  }
  return {
    ...b, createdAt: num(raw.createdAt, b.createdAt), coins: Math.max(0, Math.floor(num(raw.coins))),
    awarded: numMap(raw.awarded), owned: strs(raw.owned), equipped, achievements: numMap(raw.achievements),
    counters: numMap(raw.counters), eggs: numMap(raw.eggs), npcs, events, daily, dailyDates: strs(raw.dailyDates),
    scenesSeen: strs(raw.scenesSeen), stickersUsed: numMap(raw.stickersUsed), prefs: p,
  };
}

const isBrowser = () => typeof window !== 'undefined';

class RetentionStore {
  private data: RetentionSave = blank();
  private version = 0;
  private listeners = new Set<() => void>();
  private loaded = false;

  subscribe = (cb: () => void): (() => void) => { this.listeners.add(cb); return () => this.listeners.delete(cb); };
  getVersion = (): number => this.version;
  get(): Readonly<RetentionSave> { return this.data; }
  get isLoaded() { return this.loaded; }

  private notify() { this.version++; this.listeners.forEach(cb => cb()); }

  load(): void {
    if (!isBrowser() || this.loaded) return;
    this.loaded = true;
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) { const s = sanitize(JSON.parse(raw)); if (s) this.data = s; }
    } catch { /* blocked or corrupt: start blank, never crash */ }
    this.notify();
  }

  private persist() {
    if (!isBrowser()) return;
    try { window.localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* best effort */ }
  }

  private commit(next: RetentionSave) { this.data = next; this.persist(); this.notify(); }

  /* ── coins ─────────────────────────────────────────────────────────── */

  /** Pay `coins` once for `key`. A repeated key, a bad amount or an oversized key pays nothing. */
  award(key: string, coins: number, at = Date.now()): boolean {
    if (!key || key.length > 160 || !Number.isSafeInteger(coins) || coins <= 0 || coins > 200) return false;
    if (this.data.awarded[key] !== undefined) return false;
    this.commit({ ...this.data, coins: this.data.coins + coins, awarded: { ...this.data.awarded, [key]: at } });
    return true;
  }
  hasAward(key: string) { return this.data.awarded[key] !== undefined; }

  buy(id: string, cost: number, defaultUnlocked: boolean): boolean {
    if (this.isOwned(id, defaultUnlocked)) return false;
    if (!Number.isSafeInteger(cost) || cost < 0 || this.data.coins < cost) return false;
    this.commit({ ...this.data, coins: this.data.coins - cost, owned: [...this.data.owned, id] });
    return true;
  }
  isOwned(id: string, defaultUnlocked = false) { return defaultUnlocked || this.data.owned.includes(id); }

  equip(cat: CosmeticCategory, id: string | null) {
    const equipped = { ...this.data.equipped };
    if (id === null) delete equipped[cat]; else equipped[cat] = id;
    this.commit({ ...this.data, equipped });
  }

  /* ── achievements, eggs, npcs, events ───────────────────────────────── */

  unlockAchievement(id: string, at: number): boolean {
    if (this.data.achievements[id] !== undefined) return false;
    this.commit({ ...this.data, achievements: { ...this.data.achievements, [id]: at } });
    return true;
  }
  bump(counter: string, by = 1): number {
    const v = (this.data.counters[counter] ?? 0) + by;
    this.commit({ ...this.data, counters: { ...this.data.counters, [counter]: v } });
    return v;
  }
  counter(name: string) { return this.data.counters[name] ?? 0; }

  foundEgg(id: string, at = Date.now()): boolean {
    if (this.data.eggs[id] !== undefined) return false;
    this.commit({ ...this.data, eggs: { ...this.data.eggs, [id]: at } });
    return true;
  }

  meetNpc(id: string, patch: Partial<NpcRecord> = {}): NpcRecord {
    const prev = this.data.npcs[id];
    const rec: NpcRecord = { at: prev?.at ?? Date.now(), visits: (prev?.visits ?? 0) + 1, quest: prev?.quest, target: prev?.target, doneAt: prev?.doneAt, ...patch };
    this.commit({ ...this.data, npcs: { ...this.data.npcs, [id]: rec } });
    return rec;
  }
  patchNpc(id: string, patch: Partial<NpcRecord>) {
    const prev = this.data.npcs[id]; if (!prev) return;
    this.commit({ ...this.data, npcs: { ...this.data.npcs, [id]: { ...prev, ...patch } } });
  }

  startEvent(key: string) {
    if (this.data.events[key]) return;
    this.commit({ ...this.data, events: { ...this.data.events, [key]: { at: Date.now() } } });
  }
  finishEvent(key: string) {
    const e = this.data.events[key]; if (!e || e.done) return;
    this.commit({ ...this.data, events: { ...this.data.events, [key]: { ...e, done: true, doneAt: Date.now() } } });
  }

  /* ── daily ─────────────────────────────────────────────────────────── */

  setDay(day: string, state: DailyState) {
    const keep = Object.keys(this.data.daily).sort().slice(-45); // two months is plenty
    const daily: Record<string, DailyState> = {};
    for (const k of keep) daily[k] = this.data.daily[k];
    daily[day] = state;
    this.commit({ ...this.data, daily });
  }
  markDailyDate(day: string) {
    if (this.data.dailyDates.includes(day)) return;
    this.commit({ ...this.data, dailyDates: [...this.data.dailyDates, day] });
  }

  noteScene(id: string) {
    if (this.data.scenesSeen.includes(id)) return;
    this.commit({ ...this.data, scenesSeen: [...this.data.scenesSeen, id] });
  }

  useSticker(id: string) {
    this.commit({ ...this.data, stickersUsed: { ...this.data.stickersUsed, [id]: (this.data.stickersUsed[id] ?? 0) + 1 },
      prefs: { ...this.data.prefs, sticker: id } });
  }

  setPref<K extends keyof Prefs>(k: K, v: Prefs[K]) {
    this.commit({ ...this.data, prefs: { ...this.data.prefs, [k]: v } });
  }

  /** Clears ONLY this layer (wallet, achievements, eggs…). Not wired to "Start over" on purpose. */
  resetAll() {
    this.data = blank();
    if (isBrowser()) { try { window.localStorage.removeItem(KEY); } catch { /* ignore */ } }
    this.notify();
  }
}

export const retention = new RetentionStore();
