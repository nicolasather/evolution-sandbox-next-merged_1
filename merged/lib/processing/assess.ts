import type { ActionId, Discovery, FailInfo } from '../types';
import { multiKey } from './overlay';
import type { Processing } from './types';

/* ============================================================================
   ASSESS — when a set of pieces makes nothing, say WHY, in a way that points
   somewhere without ever naming what is not yet found. Six kinds of answer,
   tried in order of how much they tell:

     irrelevant       all but one of these belong to something
     wrong_state /    swap one piece for what working it yields and it fits:
     needs_processing the idea is right, the piece is not ready
     incomplete       these are part of something bigger
     far / related    a feel for distance, nothing more

   Only recipes that are still worth finding count (not found, tier open), so
   the answer always looks forward, never at something already held.
   ========================================================================== */

export interface RecipeRow { result: string; ing: string[]; key: string }

export interface AssessCtx {
  rows: RecipeRow[];
  /** Not found yet and its tier is open. */
  live(result: string): boolean;
  holds(id: string): boolean;
  get(id: string): Discovery | undefined;
  proc?: Processing;
  eraGap(a: Discovery, b: Discovery): number;
  /** Generic feel when nothing more specific fits (the classic near/missing lines). */
  plain(items: Discovery[]): string;
}

const remove = (ids: string[], at: number) => ids.filter((_, i) => i !== at);

/** `sub` is a strictly smaller multiset inside `sup`. */
export function strictSub(sub: readonly string[], sup: readonly string[]): boolean {
  if (sub.length >= sup.length) return false;
  const pool = [...sup];
  for (const s of sub) {
    const i = pool.indexOf(s);
    if (i < 0) return false;
    pool.splice(i, 1);
  }
  return true;
}

export function assess(ctx: AssessCtx, ids: string[]): FailInfo {
  const items = ids.map(i => ctx.get(i)).filter((d): d is Discovery => !!d);
  const live = ctx.rows.filter(r => ctx.live(r.result));
  const liveKeys = new Set(live.map(r => r.key));
  const info = (kind: FailInfo['kind'], message: string, o: Partial<FailInfo> = {}): FailInfo =>
    ({ kind, message, missing: 0, about: null, action: null, ...o });

  if (ids.length >= 2 && ids.every(i => i === ids[0])) {
    return info('same', ids.length === 2 ? 'Two of the same thing is still one thing.' : 'All the same thing. That is still one thing.');
  }

  // one piece too many
  if (ids.length >= 3) {
    for (let i = 0; i < ids.length; i++) {
      if (ids.indexOf(ids[i]) !== i) continue;
      if (liveKeys.has(multiKey(remove(ids, i)))) {
        const x = ctx.get(ids[i])!;
        return info('irrelevant', `Nearly. ${x.n} does not belong in this.`, { about: x.id });
      }
    }
  }

  // one piece not yet in the right form
  const proc = ctx.proc;
  if (proc) {
    for (let i = 0; i < ids.length; i++) {
      if (ids.indexOf(ids[i]) !== i) continue;
      for (const t of proc.byFrom.get(ids[i]) ?? []) {
        for (const y of t.out) {
          if (y === ids[i]) continue;
          const swapped = ids.map((v, k) => (k === i ? y : v));
          if (!liveKeys.has(multiKey(swapped))) continue;
          const x = ctx.get(ids[i])!;
          const has = ctx.holds(y);
          return info(has ? 'wrong_state' : 'needs_processing',
            has ? `${x.n} is the right kind of thing — but not in this form.` : `${x.n} may need working before it fits.`,
            { about: x.id, action: t.action as ActionId });
        }
      }
    }
  }

  // part of something bigger
  let missing = Infinity;
  for (const r of live) if (strictSub(ids, r.ing)) missing = Math.min(missing, r.ing.length - ids.length);
  if (isFinite(missing)) {
    return info('incomplete', 'You are on the right road. This needs more pieces.', { missing });
  }

  // one piece belongs to nothing here
  if (ids.length >= 3) {
    for (let i = 0; i < ids.length; i++) {
      if (ids.indexOf(ids[i]) !== i) continue;
      const rest = remove(ids, i);
      if (live.some(r => strictSub(rest, r.ing) && !r.ing.includes(ids[i]))) {
        const x = ctx.get(ids[i])!;
        return info('irrelevant', `${x.n} does not seem to belong with the rest.`, { about: x.id });
      }
    }
  }

  // a feel for distance
  let far = 0;
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) far = Math.max(far, ctx.eraGap(items[i], items[j]));
  if (far >= 6) return info('far', 'Separated by most of human history.');

  // related: some pair here shares a home in one recipe
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    if (ids[i] !== ids[j] && live.some(r => r.ing.includes(ids[i]) && r.ing.includes(ids[j]))) {
      return info('related', 'These are related — just not like this.');
    }
  }
  return info('none', ctx.plain(items));
}

export type Pull = 'exact' | 'unstable' | 'attract' | 'none';

/** What the bench should FEEL for this cluster, before anyone commits to it. Side-effect free. */
export function probe(ctx: AssessCtx, ids: string[]): { pull: Pull; missing: number } {
  const live = ctx.rows.filter(r => ctx.live(r.result));
  const key = multiKey(ids);
  if (live.some(r => r.key === key)) return { pull: 'exact', missing: 0 };
  let missing = Infinity;
  for (const r of live) if (strictSub(ids, r.ing)) missing = Math.min(missing, r.ing.length - ids.length);
  if (missing === 1) return { pull: 'unstable', missing };
  if (isFinite(missing)) return { pull: 'attract', missing };
  const a = assess(ctx, ids);
  if (a.kind === 'wrong_state' || a.kind === 'needs_processing' || a.kind === 'irrelevant' || a.kind === 'related') {
    return { pull: 'attract', missing: 0 };
  }
  return { pull: 'none', missing: 0 };
}
