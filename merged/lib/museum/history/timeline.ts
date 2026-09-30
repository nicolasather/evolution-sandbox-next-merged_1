import type { Db, EraId } from '../../types';
import type { WorldModel } from '../../world/registry';
import calendarJson from '@/data/museum/calendar.json';
import type { MuseumCalendar, Year } from './types';

/** The calendar, read directly (small) so the timeline never pulls in the exhibit database. */
export const CALENDAR = calendarJson as unknown as MuseumCalendar;

/* ============================================================================
   CANONICAL TIMELINE — where the player stands in real history.

   The Humanity Museum listens to this and nothing else. It is derived from
   the game's era progression (which eras are open, and how far through the
   current one the player is), mapped onto real years by data/museum/
   calendar.json. It is deliberately NOT "the latest date of anything held":
   crafting one item ahead of its usual context moves the timeline only as much
   as any other discovery of the current era — it never jumps it forward to
   that item's historical date, and it can never reach into an era the game
   has not opened.

   Continuous by construction: inside an era the year advances with every
   required major (weighted) and every ordinary discovery of that era,
   interpolated on a logarithmic years-before-present scale — so deep
   prehistory moves in tens of thousands of years per step and the modern
   galleries in single years, and exhibits appear gradually instead of in
   one burst per era.
   ========================================================================== */

export interface TimelineInput {
  db: Pick<Db, 'eras' | 'nodes' | 'primitives'>;
  world: WorldModel;
  found: ReadonlySet<string>;
  /** Era indices ≤ floor are open regardless (see Engine.eraFloorIndex). */
  floor?: number;
}

export interface TimelinePosition {
  /** Signed year (negative = BCE). */
  year: Year;
  /** Index of the era the player is working through. */
  eraIndex: number;
  eraId: EraId;
  /** 0–1 progress inside that era. */
  fraction: number;
  /** Every era complete: the timeline has reached the present. */
  atPresent: boolean;
}

/** Years before the present on a scale where "present" is 1 (so log is defined). */
const bp = (year: Year, present: Year) => Math.max(1, present + 1 - year);

/** Interpolate between two years on a log(years-before-present) scale. */
export function interpolateYear(from: Year, to: Year, f: number, present: Year): Year {
  const t = Math.max(0, Math.min(1, f));
  const a = Math.log(bp(from, present)), b = Math.log(bp(to, present));
  return present + 1 - Math.exp(a + (b - a) * t);
}

export function timelinePosition(input: TimelineInput, cal: MuseumCalendar = CALENDAR): TimelinePosition {
  const { db, world, found } = input;
  const floor = input.floor ?? 0;
  const eras = db.eras;
  const primitives = new Set(db.primitives);
  let last = 0;
  for (let i = 0; i < eras.length; i++) if (world.isOpen(i, found, floor)) last = i; else break;
  const eraId = eras[last]?.id as EraId;
  const span = cal.eras.find(e => e.era === eraId);
  const isFinal = last === eras.length - 1;
  if (isFinal && world.eraComplete(eraId, found)) {
    return { year: cal.present, eraIndex: last, eraId, fraction: 1, atPresent: true };
  }
  const req = world.required.get(eraId) ?? [];
  const reqDone = req.filter(id => found.has(id)).length;
  let all = 0, allDone = 0;
  for (const n of db.nodes) {
    if (n.era !== eraId || n.state || n.hidden || primitives.has(n.id)) continue;
    all++;
    if (found.has(n.id)) allDone++;
  }
  const allF = all ? allDone / all : 0;
  const reqF = req.length ? reqDone / req.length : allF;
  const w = cal.weights;
  let f = req.length ? (w.required * reqF + w.all * allF) / (w.required + w.all) : allF;
  f = Math.max(0, Math.min(0.999, f));
  const from = span?.from ?? cal.start;
  const to = span?.to ?? cal.present;
  const year = Math.round(interpolateYear(from, to, f, cal.present));
  return { year, eraIndex: last, eraId, fraction: f, atPresent: false };
}

/** The minimal slice of the engine the timeline reads. */
export interface TimelineEngine {
  db: Pick<Db, 'eras' | 'nodes' | 'primitives'>;
  world: WorldModel;
  found: ReadonlySet<string>;
  order: readonly string[];
  eraFloorIndex(): number;
}

const memo = new WeakMap<object, { key: string; pos: TimelinePosition }>();

/** The engine's current canonical position (memoised on what was found). */
export function engineTimeline(engine: TimelineEngine): TimelinePosition {
  const key = `${engine.found.size}|${engine.eraFloorIndex()}`;
  const hit = memo.get(engine);
  if (hit && hit.key === key) return hit.pos;
  const pos = timelinePosition({ db: engine.db, world: engine.world, found: engine.found, floor: engine.eraFloorIndex() });
  memo.set(engine, { key, pos });
  return pos;
}

/**
 * Where the canonical timeline stood at the moment the player found `id` —
 * recomputed from the order things were found in. Approximate by nature (the
 * game's simplified timeline does not map perfectly onto history), and only
 * ever used for the optional "your path" annotation, never for unlocking.
 */
export function timelineAtDiscovery(engine: TimelineEngine, id: string): Year | null {
  const at = engine.order.indexOf(id);
  if (at < 0) return null;
  const prefix = new Set(engine.order.slice(0, at));   // the world just before this discovery
  return timelinePosition({ db: engine.db, world: engine.world, found: prefix, floor: 0 }).year;
}

/* ── formatting ─────────────────────────────────────────────────────────── */

const nf = new Intl.NumberFormat('en-US');

/** A human label for a timeline year, precision matched to its depth. */
export function formatYear(year: Year, present: Year = CALENDAR.present): string {
  const ago = present - year;
  if (ago >= 1_000_000) return `${(ago / 1_000_000).toFixed(ago >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')} million years ago`;
  if (ago >= 100_000) return `${nf.format(Math.round(ago / 10_000) * 10_000)} years ago`;
  if (ago >= 12_000) return `${nf.format(Math.round(ago / 1_000) * 1_000)} years ago`;
  if (year < -3000) return `c. ${nf.format(Math.round(-year / 100) * 100)} BCE`;
  if (year < 0) return `c. ${nf.format(Math.round(-year / 10) * 10)} BCE`;
  if (year < 1000) return `c. ${Math.max(1, Math.round(year / 10) * 10)} CE`;
  if (year < 1800) return `c. ${Math.round(year / 5) * 5}`;
  return String(Math.round(year));
}

/** A very short label for floor markings ("3.3 Ma", "23 ka", "9500 BCE", "1450"). */
export function shortYear(year: Year, present: Year = CALENDAR.present): string {
  const ago = present - year;
  if (ago >= 1_000_000) return `${(ago / 1_000_000).toFixed(1).replace(/\.0$/, '')} Ma`;
  if (ago >= 12_000) return `${Math.round(ago / 1000)} ka`;
  if (year < 0) return `${Math.round(-year)} BCE`;
  return `${Math.round(year)}`;
}

/** Log-scale position of a year between two others (0–1), for laying out deep time. */
export function logPosition(year: Year, from: Year, to: Year, present: Year = CALENDAR.present): number {
  const a = Math.log(bp(from, present)), b = Math.log(bp(to, present)), y = Math.log(bp(year, present));
  if (a === b) return 0;
  return Math.max(0, Math.min(1, (y - a) / (b - a)));
}
