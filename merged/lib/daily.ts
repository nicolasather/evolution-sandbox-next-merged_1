/* Today's find — a light, pressure-free daily goal and the hook for future
   daily challenges. The pick depends only on the date (UTC), so everyone gets
   the same entry on the same day; nothing expires, nothing is lost by missing
   a day, and there is no streak to protect. Draws from lib/seed.ts's shared
   deterministic seed service — the same one every other daily/weekly feature
   (Minimum Path, Tech Sudoku, ...) uses — rather than an ad hoc hash of its
   own, so "todays-find" is one more namespaced family in one seed system. */
import { createRng, dailyKey } from './seed';
import type { Db, Discovery } from './types';

export const dayKey = dailyKey;

export function dailyPick(db: Db, day = dayKey()): Discovery | null {
  const pool = db.nodes
    .filter(n => !n.hidden && !db.primitives.includes(n.id) && (n.depth ?? 0) >= 2)
    .sort((a, b) => a.no - b.no);
  if (!pool.length) return null;
  return createRng(`todays-find|${day}`).pick(pool);
}
