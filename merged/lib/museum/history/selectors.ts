import type { GeoId } from '../../world/types';
import type { Catalog } from './data';
import { anchorOf, unlockOf } from './util';
import { IMPORTANCE_ORDER, type Gallery, type HistoricalExhibit, type MuseumRegion, type RegionLink, type StoryChapter, type Year } from './types';

/* ============================================================================
   SELECTORS — everything the Museum screen asks of the catalog, as pure
   functions of (catalog, canonical year). Nothing here reads inventory.
   ========================================================================== */

const bpOf = (year: Year, present: Year) => Math.max(1, present + 1 - year);

export const isEligible = (e: HistoricalExhibit, year: Year) => unlockOf(e) <= year;
export const isMajor = (e: HistoricalExhibit) => e.importance === 'breakthrough' || e.importance === 'defining';

export function eligibleExhibits(cat: Catalog, year: Year): HistoricalExhibit[] {
  return cat.exhibits.filter(e => isEligible(e, year));
}

/**
 * How close the timeline is to a future point, 0 (far) … 1 (reached), on a
 * log(years-before-present) scale: 1 once reached; fades to 0 over about one
 * "e-fold" of elapsed deep time before it. Used to let sealed galleries and
 * silhouettes brighten as history approaches them — never to reveal names.
 */
export function proximity(target: Year, year: Year, present: Year, reach = 0.9): number {
  if (year >= target) return 1;
  const d = Math.log(bpOf(year, present)) - Math.log(bpOf(target, present));
  return Math.max(0, 1 - d / reach);
}

export type GalleryStatus = 'open' | 'approaching' | 'sealed';

export interface GalleryView {
  gallery: Gallery;
  status: GalleryStatus;
  /** 0–1: how near the timeline is to opening it (1 when open). */
  nearness: number;
  opensAt: Year;
  exhibits: HistoricalExhibit[];
  available: HistoricalExhibit[];
}

export function galleryViews(cat: Catalog, year: Year): GalleryView[] {
  const present = cat.calendar.present;
  let seenSealed = false;
  return cat.galleries.map(g => {
    const opensAt = cat.galleryOpensAt.get(g.id) ?? g.span.from;
    const exhibits = cat.byGallery.get(g.id) ?? [];
    const available = exhibits.filter(e => isEligible(e, year));
    const open = year >= opensAt;
    const nearness = open ? 1 : proximity(opensAt, year, present);
    let status: GalleryStatus = open ? 'open' : 'sealed';
    // the very next sealed gallery is always perceptible, however far away
    if (!open && !seenSealed) status = 'approaching';
    if (!open) seenSealed = true;
    return { gallery: g, status, nearness, opensAt, exhibits, available };
  });
}

/* ── geography ──────────────────────────────────────────────────────────── */

export interface Point { lat: number; lon: number; label: string; regionId: string; role: RegionLink['role'] }

export function pointsOf(cat: Catalog, e: HistoricalExhibit): Point[] {
  const out: Point[] = [];
  for (const link of e.regions) {
    const r = cat.regionById.get(link.region);
    if (!r) continue;
    out.push({
      lat: link.site?.lat ?? r.lat, lon: link.site?.lon ?? r.lon,
      label: link.site?.label ?? r.label, regionId: r.id, role: link.role,
    });
  }
  return out;
}

export function primaryRegion(cat: Catalog, e: HistoricalExhibit): MuseumRegion | undefined {
  const link = e.regions.find(l => l.role !== 'spread') ?? e.regions[0];
  return link ? cat.regionById.get(link.region) : undefined;
}

export function geoOf(cat: Catalog, e: HistoricalExhibit): GeoId {
  return primaryRegion(cat, e)?.geo ?? 'global';
}

/** Independent origins are the honest way to show "invented more than once". */
export function independentOrigins(e: HistoricalExhibit): RegionLink[] {
  return e.regions.filter(r => r.role === 'independent');
}

export interface Connection {
  from: { lat: number; lon: number };
  to: { lat: number; lon: number };
  year: Year;
  kind: 'spread' | 'influence';
  exhibitId: string;
}

/**
 * Knowledge moving between places, among exhibits available by `year`:
 * an exhibit's own spread (origin → spread regions), and influence from an
 * earlier exhibit in a different region (parent's place → child's place).
 */
export function connections(cat: Catalog, year: Year): Connection[] {
  const out: Connection[] = [];
  for (const e of cat.exhibits) {
    if (!isEligible(e, year)) continue;
    const pts = pointsOf(cat, e);
    const src = pts.find(p => p.role === 'origin' || p.role === 'early-centre' || p.role === 'independent' || p.role === 'site');
    if (src) {
      for (const p of pts) {
        if (p.role !== 'spread') continue;
        const r = cat.regionById.get(p.regionId);
        if (r?.geo === 'global') continue;
        out.push({ from: src, to: p, year: anchorOf(e), kind: 'spread', exhibitId: e.id });
      }
    }
    const here = primaryRegion(cat, e);
    for (const pid of e.relations.enabledBy ?? []) {
      const p = cat.byId.get(pid);
      if (!p || !isEligible(p, year)) continue;
      const there = primaryRegion(cat, p);
      if (!here || !there || here.id === there.id || here.geo === 'global' || there.geo === 'global') continue;
      out.push({ from: there, to: here, year: anchorOf(e), kind: 'influence', exhibitId: e.id });
    }
  }
  return out;
}

/* ── relationships ─────────────────────────────────────────────────────── */

export interface Lineage {
  /** Available ancestors, nearest generation first: [[parents], [grandparents], …]. */
  before: HistoricalExhibit[][];
  /** Available descendants, nearest generation first. */
  after: HistoricalExhibit[][];
  /** How many descendants exist beyond the current timeline — counted, never named. */
  afterLocked: number;
  /** All descendants, available or not (for "how much grew from this"). */
  afterTotal: number;
}

export function lineage(cat: Catalog, id: string, year: Year, depth = 6): Lineage {
  const walk = (start: string, next: (x: string) => string[]) => {
    const gens: HistoricalExhibit[][] = [];
    const seen = new Set<string>([start]);
    let frontier = [start];
    for (let d = 0; d < depth && frontier.length; d++) {
      const gen: HistoricalExhibit[] = [];
      const nf: string[] = [];
      for (const x of frontier) {
        for (const y of next(x)) {
          if (seen.has(y)) continue;
          seen.add(y);
          const e = cat.byId.get(y);
          if (!e) continue;
          gen.push(e);
          nf.push(y);
        }
      }
      if (gen.length) gens.push(gen);
      frontier = nf;
    }
    return gens;
  };
  const up = walk(id, x => cat.byId.get(x)?.relations.enabledBy ?? []);
  const downAll = walk(id, x => cat.enables.get(x) ?? [], );
  const before = up.map(g => g.filter(e => isEligible(e, year))).filter(g => g.length);
  const after = downAll.map(g => g.filter(e => isEligible(e, year))).filter(g => g.length);
  const all = downAll.flat();
  return { before, after, afterLocked: all.filter(e => !isEligible(e, year)).length, afterTotal: all.length };
}

/** A small set of contemporaneous developments elsewhere in the world. */
export function aroundTheWorld(cat: Catalog, e: HistoricalExhibit, year: Year, max = 4): HistoricalExhibit[] {
  const present = cat.calendar.present;
  const at = anchorOf(e);
  const window = Math.max(40, bpOf(at, present) * 0.12);
  const myGeo = geoOf(cat, e);
  const cands = cat.exhibits
    .filter(o => o.id !== e.id && isEligible(o, year) && Math.abs(anchorOf(o) - at) <= window && geoOf(cat, o) !== myGeo)
    .map(o => ({ o, score: IMPORTANCE_ORDER[o.importance] * 2 - Math.abs(anchorOf(o) - at) / window }))
    .sort((a, b) => b.score - a.score);
  const picked: HistoricalExhibit[] = [];
  const geos = new Set<string>();
  for (const { o } of cands) {
    const g = geoOf(cat, o);
    if (geos.has(g)) continue;              // one per part of the world
    geos.add(g);
    picked.push(o);
    if (picked.length >= max) break;
  }
  return picked.sort((a, b) => anchorOf(a) - anchorOf(b));
}

/** What was happening in a region around a given year (available exhibits only). */
export function regionAround(cat: Catalog, regionId: string, around: Year, year: Year, max = 6): HistoricalExhibit[] {
  const present = cat.calendar.present;
  const window = Math.max(60, bpOf(around, present) * 0.25);
  const r = cat.regionById.get(regionId);
  return cat.exhibits
    .filter(e => isEligible(e, year) && e.regions.some(l => l.region === regionId || (r && cat.regionById.get(l.region)?.geo === r.geo && l.role !== 'spread')))
    .map(e => ({ e, d: Math.abs(anchorOf(e) - around) }))
    .sort((a, b) => a.d - b.d || IMPORTANCE_ORDER[b.e.importance] - IMPORTANCE_ORDER[a.e.importance])
    .filter(x => x.d <= window * 4)
    .slice(0, max)
    .map(x => x.e)
    .sort((a, b) => anchorOf(a) - anchorOf(b));
}

/** The "Human Story" route — only as far as the timeline has reached. */
export function storyChapters(cat: Catalog, year: Year): { chapter: StoryChapter; exhibit: HistoricalExhibit }[] {
  const out: { chapter: StoryChapter; exhibit: HistoricalExhibit }[] = [];
  for (const chapter of cat.story.chapters) {
    const exhibit = cat.byId.get(chapter.exhibit);
    if (exhibit && isEligible(exhibit, year)) out.push({ chapter, exhibit });
  }
  return out;
}

/** The next milestone still ahead — used only to say "history continues", never to name it. */
export function nextUnlock(cat: Catalog, year: Year): Year | null {
  let best: Year | null = null;
  for (const e of cat.exhibits) {
    const u = unlockOf(e);
    if (u > year && (best === null || u < best)) best = u;
  }
  return best;
}
