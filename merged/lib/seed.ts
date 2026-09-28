/* ============================================================================
   SEED SERVICE — one deterministic randomness source for everything that must
   be fair or reproducible: daily/weekly challenges, procedurally generated
   sites, scripts and puzzles. Never reach for Math.random for these; derive a
   seed (a string is fine — a challenge id, a date, a save-scoped key) and
   pull numbers from the Rng it returns. Two calls with the same seed always
   produce the same sequence, on any machine, in any session.

   This module has no game knowledge — it is pure, allocation-light, and safe
   to unit test in isolation (see __tests__/seed.test.ts).
   ========================================================================== */

/** A reproducible source of numbers, built from one seed. */
export interface Rng {
  /** A float in [0, 1). */
  next(): number;
  /** An integer in [min, max], inclusive on both ends. */
  int(min: number, max: number): number;
  /** True with the given probability (0–1). */
  chance(p: number): boolean;
  /** One random element. Throws on an empty array. */
  pick<T>(items: readonly T[]): T;
  /** A new array, same elements, order shuffled (Fisher–Yates). Does not mutate the input. */
  shuffle<T>(items: readonly T[]): T[];
}

/** xmur3 — turns an arbitrary string into a 32-bit seed. Not cryptographic;
 *  only needs to spread short, similar strings ("2026-09-28", "2026-09-29")
 *  across the seed space so consecutive days don't produce visibly related
 *  sequences. */
export function hashString(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h ^= h >>> 16;
  return h >>> 0;
}

/** mulberry32 — a small, fast, good-enough-for-games PRNG. Deterministic:
 *  the same numeric seed always produces the same sequence of `next()` calls. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Build a deterministic Rng from a seed. A string seed (a challenge key, a
 *  save id, a site name) is hashed into a number first — pass a number
 *  directly if you already have one (e.g. from a previous `hashString`). */
export function createRng(seed: number | string): Rng {
  const next = mulberry32(typeof seed === 'string' ? hashString(seed) : seed >>> 0);
  return {
    next,
    int(min, max) {
      if (max < min) [min, max] = [max, min];
      return min + Math.floor(next() * (max - min + 1));
    },
    chance(p) { return next() < p; },
    pick(items) {
      if (items.length === 0) throw new Error('Rng.pick: empty array');
      return items[Math.floor(next() * items.length)];
    },
    shuffle(items) {
      const out = items.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** UTC calendar date key, e.g. "2026-09-28" — stable across timezones so a
 *  daily challenge changes at the same instant for every player. */
export function dailyKey(date: Date = new Date()): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

/** ISO week key, e.g. "2026-W40" — used for weekly challenges. Monday-start,
 *  ISO 8601 week numbering. */
export function weeklyKey(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Build the Rng for a daily challenge family. `family` namespaces it (two
 *  different daily features on the same day must not share a sequence
 *  unless that is explicitly wanted) — e.g. `dailyRng('todays-find')`,
 *  `dailyRng('minimum-path')`. */
export function dailyRng(family: string, date: Date = new Date()): Rng {
  return createRng(`${family}|${dailyKey(date)}`);
}

/** Build the Rng for a weekly challenge family. */
export function weeklyRng(family: string, date: Date = new Date()): Rng {
  return createRng(`${family}|${weeklyKey(date)}`);
}
