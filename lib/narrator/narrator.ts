import { ERA_LINES, ERA_VOICE, VOICES, type Voice, type VoiceId } from './voices';

/* ============================================================================
   NARRATOR — decides whether a line is spoken now, and which.

   Modes      full (portrait and line) · minimal (a line, no portrait) · off
   Priority   era  >  major discovery  >  technique  >  stuck  >  minor
   Spacing    at least MIN_GAP_MS between any two lines; each kind has its own
              cooldown as well. A more important line may cut in on a less
              important one; a less important line never cuts in on a more
              important one, and is simply dropped rather than queued.

   A plain external store, like the engine and the tutor; it holds no timers.
   A hook calls `tick(now)` each second so lines expire and the "stuck" rule
   can be checked. Everything is testable with a fake clock.
   ========================================================================== */

export type NarratorMode = 'full' | 'minimal' | 'off';
export type Kind = 'era' | 'major' | 'technique' | 'stuck' | 'minor';

export const PRIORITY: Record<Kind, number> = { era: 5, major: 4, technique: 3, stuck: 2, minor: 1 };
/** Cooldown per kind, on top of the global gap. */
export const COOLDOWN_MS: Record<Kind, number> = { era: 0, major: 25_000, technique: 15_000, stuck: 120_000, minor: 75_000 };
export const MIN_GAP_MS = 8_000;
/** No progress for this long, and the narrator offers a nudge. */
export const STUCK_AFTER_MS = 100_000;
const SHOW_BASE_MS = 4_500;
const SHOW_PER_CHAR_MS = 55;

export interface Line { key: number; kind: Kind; voice: Voice; text: string; era: string; at: number; until: number }

export interface Event {
  kind: Kind;
  /** The era it happened in (chooses the voice). */
  era: string;
  name?: string;
  tech?: string;
}

const KEY = 'evo.narrator.mode';
const fill = (s: string, e: Event) => s.replace('{name}', e.name ?? 'this').replace('{tech}', e.tech ?? 'this');

export class Narrator {
  private version = 0;
  private listeners = new Set<() => void>();
  mode: NarratorMode = 'full';
  current: Line | null = null;

  private seq = 0;
  private lastAny = -Infinity;
  private lastKind: Partial<Record<Kind, number>> = {};
  private lastPick = new Map<string, number>();
  private eraSpoken = new Set<string>();
  private lastProgress: number;

  constructor(private rng: () => number = Math.random, now = 0) { this.lastProgress = now; }

  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getVersion = () => this.version;
  private emit() { this.version++; this.listeners.forEach(f => f()); }

  /** Something happened. Returns the line if it was spoken. */
  notice(e: Event, now: number): Line | null {
    // anything but a "stuck" or "minor" nudge counts as the player getting somewhere
    if (e.kind !== 'stuck') this.lastProgress = now;
    if (this.mode === 'off') return null;
    if (e.kind === 'era') {
      // each era is welcomed once
      if (this.eraSpoken.has(e.era)) return null;
    }
    const cur = this.current;
    if (cur && now < cur.until && PRIORITY[e.kind] <= PRIORITY[cur.kind]) return null;
    if (!cur || now >= cur.until) {
      if (now - this.lastAny < MIN_GAP_MS && e.kind !== 'era') return null;
    }
    const cd = this.lastKind[e.kind];
    if (cd !== undefined && now - cd < COOLDOWN_MS[e.kind]) return null;

    const voice = VOICES[ERA_VOICE[e.era] ?? 'toolmaker'];
    const pool = e.kind === 'era' ? ERA_LINES[e.era] : voice[e.kind];
    if (!pool?.length) return null;
    const text = fill(this.choose(`${e.kind}:${e.kind === 'era' ? e.era : voice.id}`, pool), e);

    if (e.kind === 'era') this.eraSpoken.add(e.era);
    this.lastKind[e.kind] = now; this.lastAny = now;
    const line: Line = {
      key: ++this.seq, kind: e.kind, voice, text, era: e.era, at: now,
      until: now + SHOW_BASE_MS + text.length * SHOW_PER_CHAR_MS + (e.kind === 'era' ? 1500 : 0),
    };
    this.current = line; this.emit();
    return line;
  }

  /** Called about once a second. */
  tick(now: number, era: string): void {
    if (this.current && now >= this.current.until) { this.current = null; this.emit(); }
    if (this.mode === 'off') return;
    // stuck: a long stretch without anything new, with nothing on screen
    if (!this.current && now - this.lastProgress >= STUCK_AFTER_MS) {
      const said = this.notice({ kind: 'stuck', era }, now);
      // whether or not it was said, do not ask again straight away
      this.lastProgress = now - STUCK_AFTER_MS + COOLDOWN_MS.stuck;
      if (said) this.emit();
    }
  }

  /** The player has seen enough of this one. */
  dismiss(): void { if (this.current) { this.current = null; this.emit(); } }

  setMode(m: NarratorMode): void {
    this.mode = m;
    if (m === 'off') this.current = null;
    try { window.localStorage.setItem(KEY, m); } catch { /* storage blocked */ }
    this.emit();
  }
  load(): void {
    try {
      const m = window.localStorage.getItem(KEY);
      if (m === 'full' || m === 'minimal' || m === 'off') { this.mode = m; this.emit(); }
    } catch { /* default */ }
  }

  /** A fresh game welcomes its eras again. */
  reset(now: number): void {
    this.eraSpoken.clear(); this.lastKind = {}; this.lastAny = -Infinity; this.current = null; this.lastProgress = now;
    this.emit();
  }
  /** Eras already met, so a restored game does not re-announce them. */
  markMet(era: string): void { this.eraSpoken.add(era); }

  private choose(key: string, pool: string[]): string {
    if (pool.length === 1) return pool[0];
    let i = Math.floor(this.rng() * pool.length);
    if (i === this.lastPick.get(key)) i = (i + 1) % pool.length;
    this.lastPick.set(key, i);
    return pool[i];
  }
}

export type { VoiceId };
