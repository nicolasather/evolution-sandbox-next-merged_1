import type { Db, Discovery } from '../types';

/* Bounded, rule-based shortlist of ingredients that may even be OFFERED for a target (package 030).
   Mirrors tools/content/candidates.py. It never enumerates pairs and never relaxes a rule to fill the
   list: an empty pool is a correct answer ("no_result" before any model is asked). */

export const MAX_POOL = 40;

const isPlaceholder = (n: Discovery) => (n.caution ?? '').toLowerCase().includes('placeholder');

export interface PoolOptions { max?: number; excludeIds?: readonly string[] }

export function candidatePool(db: Pick<Db, 'nodes' | 'eras'>, targetId: string, opts: PoolOptions = {}): string[] {
  const target = db.nodes.find(n => n.id === targetId);
  if (!target) return [];
  const eraIdx = new Map(db.eras.map((e, i) => [e.id, i]));
  const tEra = eraIdx.get(target.era) ?? 0;
  const skip = new Set([targetId, ...(opts.excludeIds ?? [])]);
  const pool = db.nodes
    .filter(n => !skip.has(n.id) && !isPlaceholder(n) && (eraIdx.get(n.era) ?? 0) <= tEra)
    // closer in era first, then stable by id: the shortlist is reproducible
    .sort((a, b) => (eraIdx.get(b.era) ?? 0) - (eraIdx.get(a.era) ?? 0) || (a.id < b.id ? -1 : 1))
    .slice(0, Math.min(opts.max ?? MAX_POOL, MAX_POOL))
    .map(n => n.id);
  return pool;
}
