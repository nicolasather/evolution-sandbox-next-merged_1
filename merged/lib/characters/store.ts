/* The crew save: `evo.characters.v1`, its own key, additive and sanitised. It can never touch `evo.sandbox.v1`, any mode save or
   `evo.retention.v1`: corrupt data falls back to defaults and only ever rewrites THIS key. */
import { CHARACTER_IDS, type CharacterId, type CrewSave, type CrewSettings } from './types';

export const CREW_KEY = 'evo.characters.v1';

export const DEFAULT_SETTINGS: CrewSettings = {
  enabled: true,
  perCharacter: { kip: true, vex: true, orra: true },
  autonomousTurns: true,
  objectPranks: true,
  answerPranks: true,
  ambientSkits: true,
  dialogue: true,
  reducedMotion: false,
};

const cloneSettings = (s: CrewSettings): CrewSettings => ({ ...s, perCharacter: { ...s.perCharacter } });

export function blankSave(): CrewSave {
  return {
    v: 1, unlocked: { kip: 0 }, ceremonySeen: { kip: true }, settings: cloneSettings(DEFAULT_SETTINGS),
    disclosureSeen: false, affinity: {}, counters: {},
  };
}

const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Never throws; anything unreadable becomes the default. */
export function sanitize(raw: unknown): CrewSave {
  const out = blankSave();
  if (!isObj(raw)) return out;
  if (isObj(raw.unlocked)) {
    for (const id of CHARACTER_IDS) { const t = raw.unlocked[id]; if (typeof t === 'number' && Number.isFinite(t)) out.unlocked[id] = t; }
  }
  out.unlocked.kip = out.unlocked.kip ?? 0;
  if (isObj(raw.ceremonySeen)) for (const id of CHARACTER_IDS) if (raw.ceremonySeen[id] === true) out.ceremonySeen[id] = true;
  out.ceremonySeen.kip = true;
  if (isObj(raw.settings)) {
    const s = raw.settings, d = DEFAULT_SETTINGS;
    const pc = isObj(s.perCharacter) ? s.perCharacter : {};
    out.settings = {
      enabled: bool(s.enabled, d.enabled),
      perCharacter: { kip: bool(pc.kip, true), vex: bool(pc.vex, true), orra: bool(pc.orra, true) },
      autonomousTurns: bool(s.autonomousTurns, d.autonomousTurns), objectPranks: bool(s.objectPranks, d.objectPranks),
      answerPranks: bool(s.answerPranks, d.answerPranks), ambientSkits: bool(s.ambientSkits, d.ambientSkits),
      dialogue: bool(s.dialogue, d.dialogue), reducedMotion: bool(s.reducedMotion, d.reducedMotion),
    };
  }
  out.disclosureSeen = raw.disclosureSeen === true;
  if (isObj(raw.affinity)) {
    for (const [k, v] of Object.entries(raw.affinity)) {
      if (!/^(kip|vex|orra)>(kip|vex|orra)$/.test(k) || !isObj(v)) continue;
      out.affinity[k] = { trust: num(v.trust), rivalry: num(v.rivalry), patience: num(v.patience), debt: num(v.debt) };
    }
  }
  if (isObj(raw.counters)) for (const [k, v] of Object.entries(raw.counters)) if (typeof v === 'number' && Number.isFinite(v) && k.length < 64) out.counters[k] = v;
  return out;
}

type Listener = () => void;

class CrewStore {
  private state: CrewSave = blankSave();
  private loaded = false;
  private listeners = new Set<Listener>();
  private readonly server = blankSave();

  private ls(): Storage | null { try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; } }

  load(): CrewSave {
    if (this.loaded) return this.state;
    this.loaded = true;
    try { const raw = this.ls()?.getItem(CREW_KEY); this.state = sanitize(raw ? JSON.parse(raw) : null); } catch { this.state = blankSave(); }
    return this.state;
  }
  private persist() { try { this.ls()?.setItem(CREW_KEY, JSON.stringify(this.state)); } catch { /* storage blocked: the crew just forgets */ } }
  private emit() { for (const l of [...this.listeners]) l(); }

  get = (): CrewSave => this.load();
  getServer = (): CrewSave => this.server;
  subscribe = (l: Listener): (() => void) => { this.listeners.add(l); return () => { this.listeners.delete(l); }; };

  update(fn: (s: CrewSave) => CrewSave): void {
    this.state = sanitize(fn(this.load()));
    this.persist(); this.emit();
  }
  setSettings(patch: Partial<CrewSettings>): void { this.update(s => ({ ...s, settings: { ...s.settings, ...patch } })); }
  setCharacterEnabled(id: CharacterId, on: boolean): void { this.update(s => ({ ...s, settings: { ...s.settings, perCharacter: { ...s.settings.perCharacter, [id]: on } } })); }
  /** Idempotent: returns true only the first time this creature is unlocked. */
  unlock(id: CharacterId, at = Date.now()): boolean {
    if (this.load().unlocked[id] !== undefined) return false;
    this.update(s => ({ ...s, unlocked: { ...s.unlocked, [id]: at } }));
    return true;
  }
  markCeremony(id: CharacterId): void { this.update(s => ({ ...s, ceremonySeen: { ...s.ceremonySeen, [id]: true } })); }
  acceptDisclosure(autonomous: boolean): void { this.update(s => ({ ...s, disclosureSeen: true, settings: { ...s.settings, autonomousTurns: autonomous } })); }
  bump(pair: string, key: 'trust' | 'rivalry' | 'patience' | 'debt', by = 1): void {
    this.update(s => {
      const cur = s.affinity[pair] ?? { trust: 0, rivalry: 0, patience: 0, debt: 0 };
      return { ...s, affinity: { ...s.affinity, [pair]: { ...cur, [key]: Math.min(99, cur[key] + by) } } };
    });
  }
  count(key: string, by = 1): void { this.update(s => ({ ...s, counters: { ...s.counters, [key]: (s.counters[key] ?? 0) + by } })); }
  resetRelationships(): void { this.update(s => ({ ...s, affinity: {}, counters: {} })); }
  /** test helper */
  _reset(): void { this.loaded = false; this.state = blankSave(); this.listeners.clear(); }
}

export const crewStore = new CrewStore();
