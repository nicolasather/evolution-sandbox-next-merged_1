/* Today's find — a light, pressure-free daily goal and the hook for future
   daily challenges. The pick depends only on the date (UTC), so everyone gets
   the same entry on the same day; nothing expires, nothing is lost by missing
   a day, and there is no streak to protect. */
import { hash } from './glyphs';
import type { Db, Discovery } from './types';

export function dayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function dailyPick(db: Db, day = dayKey()): Discovery | null {
  const pool = db.nodes
    .filter(n => !n.hidden && !db.primitives.includes(n.id) && (n.depth ?? 0) >= 2)
    .sort((a, b) => a.no - b.no);
  if (!pool.length) return null;
  return pool[hash(`evo-daily-${day}`) % pool.length];
}
