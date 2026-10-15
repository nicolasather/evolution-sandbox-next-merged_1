import { devOverrides } from './overrides';

/**
 * The seed for a new procedural run (Survival camp, dig site, Decipher tablet, alien site, reverse trace…).
 *
 * Everywhere except an authorised Developer Beta with a seed set, this is EXACTLY the string the game has
 * always used — `<prefix>-<milliseconds>` — so production runs are unchanged. In the beta, a tester can pin
 * the seed so the same scenario can be entered again and again (`<prefix>-<seed>`).
 */
export function freshSeed(prefix: string, now: number = Date.now()): string {
  const pinned = devOverrides.get().seed;
  return pinned ? `${prefix}-${pinned}` : `${prefix}-${now}`;
}
