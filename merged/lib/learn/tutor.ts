import type { ActionId } from '../types';
import { ERA_ORDER, QUESTIONS, askable, type Question } from './knowledge';

/* ============================================================================
   TUTOR — decides WHEN a question appears and WHICH one. Nothing else.

   • The first question comes about a minute in; after that one every 60–120 s,
     never sooner than 45 s after the last.
   • It is a card in the corner, never a modal. Ignored for a while, it folds to
     a small "?" and waits; ignored for long, it slips away and may return.
   • No score, no XP, no streak — the state below has no place to put one.
   • A wrong answer fades out quietly. A different question follows soon after,
     unless the card has been missed twice in a row, in which case the usual gap
     applies.
   • A right answer shows its explanation, may open a technique, and is
     remembered so it is not asked again.

   The class is a plain external store (subscribe/getVersion), the same shape the
   engine uses. It holds no timers: a hook calls `tick(now, ctx)` about once a
   second, which keeps every rule testable with a fake clock.
   ========================================================================== */

export const FIRST_MS = 60_000;
export const GAP_MIN_MS = 60_000;
export const GAP_MAX_MS = 120_000;
/** Hard floor between the end of one question and the start of the next. */
export const FLOOR_MS = 45_000;
/** A card nobody touches folds to "?" after this long. */
export const FOLD_MS = 22_000;
/** A folded "?" nobody touches slips away after this long. */
export const DROP_MS = 90_000;
/** How long a wrong answer takes to fade, and the pause before a different question. */
export const WRONG_FADE_MS = 1_300;
export const RETRY_MS = 3_500;
/** How long the explanation stays after a right answer. */
export const EXPLAIN_MS = 14_000;

export type Phase = 'idle' | 'open' | 'folded' | 'right' | 'wrong';

export interface TutorContext {
  /** Index in ERA_ORDER of the furthest era reached. */
  eraIndex: number;
  /** Discoveries made so far. */
  discoveries: number;
  /** Something else has the player's attention (a reveal, an ending, a hint panel). */
  busy: boolean;
  /** Techniques the player already has, to keep `teaches` honest. */
  knows: (a: ActionId) => boolean;
}

export interface Shown {
  q: Question;
  /** Answers in the order shown. */
  order: string[];
  /** Answers already tried and faded. */
  faded: string[];
  /** What a right answer did, once it has. */
  taught: ActionId | null;
}

interface Saved { v: 1; right: string[]; wrong: string[] }
const KEY = 'evo.learn.v1';

export const maxDifficulty = (discoveries: number): 1 | 2 | 3 => (discoveries < 12 ? 1 : discoveries < 40 ? 2 : 3);

/** A delay between questions, always at least the floor. */
export const nextGap = (rng: () => number): number =>
  Math.max(FLOOR_MS, GAP_MIN_MS + Math.floor(rng() * (GAP_MAX_MS - GAP_MIN_MS)));

export function shuffled<T>(xs: readonly T[], rng: () => number): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** Pick a question: within reach, not answered right, prefer this era and what could open something. */
export function pick(
  pool: readonly Question[], ctx: Pick<TutorContext, 'eraIndex' | 'discoveries' | 'knows'>,
  right: ReadonlySet<string>, recent: readonly string[], rng: () => number,
): Question | null {
  const top = maxDifficulty(ctx.discoveries);
  const ok = pool.filter(q => {
    const ei = ERA_ORDER.indexOf(q.era);
    return askable(q) && ei >= 0 && ei <= ctx.eraIndex && q.difficulty <= top && !right.has(q.id) && !recent.includes(q.id);
  });
  if (!ok.length) return null;
  const score = (q: Question) => {
    const ei = ERA_ORDER.indexOf(q.era);
    let s = ei === ctx.eraIndex ? 3 : ei === ctx.eraIndex - 1 ? 1.5 : 0;
    if (q.teaches && !ctx.knows(q.teaches)) s += 2;
    if (q.difficulty === top) s += 0.5;
    return s + rng() * 1.5;
  };
  return ok.reduce((best, q) => (score(q) > score(best) ? q : best));
}

export class Tutor {
  private version = 0;
  private listeners = new Set<() => void>();

  phase: Phase = 'idle';
  shown: Shown | null = null;

  private nextAt: number;
  private since = 0;
  private wrongRun = 0;
  private right = new Set<string>();
  private wrong = new Set<string>();
  private recent: string[] = [];
  private pool: readonly Question[];

  constructor(private rng: () => number = Math.random, now = 0, pool: readonly Question[] = QUESTIONS) {
    this.pool = pool;
    this.nextAt = now + FIRST_MS;
  }

  /* store */
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getVersion = () => this.version;
  private emit() { this.version++; this.listeners.forEach(f => f()); }

  /** Called about once a second. */
  tick(now: number, ctx: TutorContext): void {
    if (this.phase === 'idle') {
      if (now < this.nextAt) return;
      // never in the middle of something else: try again a little later
      if (ctx.busy) { this.nextAt = now + 4_000; return; }
      const q = pick(this.pool, ctx, this.right, this.recent, this.rng);
      if (!q) { this.nextAt = now + nextGap(this.rng); return; }
      this.recent = [...this.recent.slice(-3), q.id];
      this.shown = { q, order: shuffled(q.answers, this.rng), faded: [], taught: null };
      this.phase = 'open'; this.since = now; this.emit();
      return;
    }
    if (this.phase === 'open' && now - this.since >= FOLD_MS) { this.phase = 'folded'; this.since = now; this.emit(); return; }
    if (this.phase === 'folded' && now - this.since >= DROP_MS) { this.close(now); return; }
    if (this.phase === 'right' && now - this.since >= EXPLAIN_MS) this.close(now);
    if (this.phase === 'wrong' && now - this.since >= WRONG_FADE_MS) {
      // twice in a row means the usual gap, not a quick retry
      this.wrongRun++;
      this.dropQuestion(now, this.wrongRun < 2 ? RETRY_MS : nextGap(this.rng));
    }
  }

  /** The player unfolds the "?". */
  expand(now: number): void {
    if (this.phase !== 'folded') return;
    this.phase = 'open'; this.since = now; this.emit();
  }

  /** "Not now": the card folds by itself. */
  fold(now: number): void {
    if (this.phase !== 'open') return;
    this.phase = 'folded'; this.since = now; this.emit();
  }

  /**
   * An answer. Returns 'right' or 'wrong'; for a right answer, `teach` is called
   * with the technique the question offers, if the player does not have it.
   */
  answer(choice: string, now: number, ctx: Pick<TutorContext, 'knows'>, teach: (a: ActionId) => boolean): 'right' | 'wrong' | null {
    const s = this.shown;
    if (!s || this.phase !== 'open' || s.faded.includes(choice)) return null;
    if (choice === s.q.correctAnswer) {
      this.right.add(s.q.id); this.wrong.delete(s.q.id); this.wrongRun = 0;
      const a = s.q.teaches;
      if (a && !ctx.knows(a) && teach(a)) s.taught = a;
      this.phase = 'right'; this.since = now; this.save(); this.emit();
      return 'right';
    }
    // wrong: the choice fades, quietly — nothing is said about it — and the card
    // follows it out. A different question comes a moment later.
    s.faded = [...s.faded, choice];
    this.wrong.add(s.q.id);
    this.phase = 'wrong'; this.since = now; this.emit();
    return 'wrong';
  }

  /** The player closes the explanation. */
  close(now: number): void {
    this.dropQuestion(now, nextGap(this.rng));
  }

  private dropQuestion(now: number, wait: number) {
    this.shown = null; this.phase = 'idle'; this.nextAt = now + Math.max(wait, 0); this.emit();
  }

  /** How many have been answered right — not shown as a score anywhere. */
  answeredRight(): number { return this.right.size; }

  /* persistence: which were answered right, so they are not asked again */
  private save() {
    if (typeof window === 'undefined') return;
    try {
      const s: Saved = { v: 1, right: [...this.right], wrong: [...this.wrong] };
      window.localStorage.setItem(KEY, JSON.stringify(s));
    } catch { /* storage blocked — the questions simply come round again */ }
  }
  load() {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as Saved;
      if (s.v === 1) { this.right = new Set(s.right); this.wrong = new Set(s.wrong); }
    } catch { /* unreadable — start fresh */ }
  }
  reset(now: number) {
    this.right.clear(); this.wrong.clear(); this.recent = []; this.wrongRun = 0;
    this.shown = null; this.phase = 'idle'; this.nextAt = now + FIRST_MS;
    try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
    this.emit();
  }
}
