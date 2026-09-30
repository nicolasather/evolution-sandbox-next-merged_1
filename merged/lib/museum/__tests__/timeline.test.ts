import rawDb from '@/data/db.json';
import { Engine } from '@/lib/engine';
import { buildCatalog, unlockOf } from '@/lib/museum/history/data';
import { engineTimeline, formatYear, interpolateYear, timelineAtDiscovery, timelinePosition } from '@/lib/museum/history/timeline';
import { aroundTheWorld, galleryViews, isEligible, lineage, storyChapters } from '@/lib/museum/history/selectors';
import { comparePath, personalDiscoveries, personalLinksFor } from '@/lib/museum/personal';
import type { Db } from '@/lib/types';

const db = rawDb as unknown as Db;
const cat = buildCatalog();

/** Make every recipe the engine currently allows until nothing new appears, era by era. */
function advance(e: Engine, maxSteps = 100000): void {
  let progress = true, n = 0;
  while (progress && n < maxSteps) {
    progress = false;
    for (const node of db.nodes) {
      if (e.has(node.id) || !e.isRecipeUnlocked(node.id)) continue;
      const r = node.rec.find(rec => rec.every(i => e.has(i)));
      if (r && e.combineMany(r).status === 'new') { progress = true; n++; }
    }
  }
}

describe('canonical timeline', () => {
  it('starts at the calendar start on a brand-new game', () => {
    const e = new Engine(db);
    expect(engineTimeline(e).year).toBe(cat.calendar.start);
    expect(engineTimeline(e).eraId).toBe('origins');
  });

  it('interpolates on a log scale and is monotone', () => {
    const a = interpolateYear(-3_300_000, -1_000_000, 0, 2026);
    const b = interpolateYear(-3_300_000, -1_000_000, 0.5, 2026);
    const c = interpolateYear(-3_300_000, -1_000_000, 1, 2026);
    expect(a).toBeCloseTo(-3_300_000, -2);
    expect(c).toBeCloseTo(-1_000_000, -2);
    expect(b).toBeGreaterThan(a);
    expect(b).toBeLessThan(c);
  });

  it('advances continuously — never jumps whole eras at once — as the player discovers', () => {
    const e = new Engine(db);
    const years: number[] = [engineTimeline(e).year];
    let progress = true;
    while (progress) {
      progress = false;
      for (const node of db.nodes) {
        if (e.has(node.id) || !e.isRecipeUnlocked(node.id)) continue;
        const r = node.rec.find(rec => rec.every(i => e.has(i)));
        if (r && e.combineMany(r).status === 'new') {
          progress = true;
          years.push(engineTimeline(e).year);
        }
      }
    }
    for (let i = 1; i < years.length; i++) expect(years[i]).toBeGreaterThanOrEqual(years[i - 1]);
    expect(years[years.length - 1]).toBe(cat.calendar.present);
    // at most a handful of exhibits become available per discovery, on average
    const perStep = cat.exhibits.length / (years.length - 1);
    expect(perStep).toBeLessThan(3);
  });

  it('is driven by era progression, not by the latest date held', () => {
    const e = new Engine(db);
    const pos = timelinePosition({ db, world: e.world, found: new Set([...db.primitives, 'antibiotics', 'smartphone']) });
    // holding modern items out of order (impossible in play, but a sandbox path) does not move history forward
    expect(pos.year).toBeLessThan(-1_000_000);
    expect(pos.eraId).toBe('origins');
  });

  it('records where the timeline stood when the player made each discovery', () => {
    const e = new Engine(db);
    e.combine('stone', 'stone');
    const at = timelineAtDiscovery(e, 'sharp_stone');
    expect(at).toBe(cat.calendar.start);
  });

  it('formats years at a precision matched to their depth', () => {
    expect(formatYear(-3_300_000)).toBe('3.3 million years ago');
    expect(formatYear(-21_000)).toBe('23,000 years ago');
    expect(formatYear(-3350)).toBe('c. 3,400 BCE');
    expect(formatYear(1903)).toBe('1903');
  });
});

describe('Humanity Museum selectors', () => {
  it('eligibility follows the year alone', () => {
    const lucy = cat.byId.get('lucy')!;
    expect(isEligible(lucy, -3_300_000)).toBe(false);
    expect(isEligible(lucy, -3_200_000)).toBe(true);
  });

  it('only the first gallery section is open at the start; the next sealed one is perceptible', () => {
    const views = galleryViews(cat, cat.calendar.start);
    const open = views.filter(v => v.status === 'open');
    expect(open.map(v => v.gallery.id)).toEqual(['deep-origins']);
    expect(views.filter(v => v.status === 'approaching')).toHaveLength(1);
  });

  it('lineage counts future descendants without naming them', () => {
    const l = lineage(cat, 'controlled-fire', -900_000);
    expect(l.after.flat().every(e => isEligible(e, -900_000))).toBe(true);
    expect(l.afterLocked).toBeGreaterThan(5);
    const later = lineage(cat, 'controlled-fire', 2026);
    expect(later.afterLocked).toBe(0);
    expect(later.after.flat().length).toBeGreaterThan(l.after.flat().length);
  });

  it('around-the-world picks contemporaneous developments from other parts of the world', () => {
    const w = cat.byId.get('writing')!;
    const around = aroundTheWorld(cat, w, 2026);
    expect(around.length).toBeGreaterThan(0);
    for (const o of around) expect(o.id).not.toBe('writing');
  });

  it('the Human Story only reaches as far as the timeline', () => {
    expect(storyChapters(cat, cat.calendar.start).length).toBeLessThan(4);
    expect(storyChapters(cat, 2026).length).toBe(cat.story.chapters.length);
  });

  it('never unlocks by inventory: every unlock year is a real historical date', () => {
    for (const e of cat.exhibits) expect(Number.isFinite(unlockOf(e))).toBe(true);
  });
});

describe('personal discoveries (separate layer)', () => {
  it('lists what the player found, in their order, excluding raw materials', () => {
    const e = new Engine(db);
    e.combine('stone', 'stone');
    const mine = personalDiscoveries(e);
    expect(mine.map(d => d.id)).toEqual(['sharp_stone']);
    expect(mine[0].index).toBe(1);
  });

  it('links a personal discovery to its canonical exhibit and compares timing carefully', () => {
    const e = new Engine(db);
    e.combine('stone', 'stone');
    const links = personalLinksFor(e, cat.byId.get('lomekwi')!);
    expect(links).toHaveLength(1);
    expect(links[0].comparison).toBe('around');
    expect(comparePath(-10_000, cat.byId.get('writing')!)).toBe('earlier');
    expect(comparePath(1990, cat.byId.get('writing')!)).toBe('later');
  });

  it('playing through the game eventually makes every exhibit available', () => {
    const e = new Engine(db);
    advance(e);
    const year = engineTimeline(e).year;
    expect(cat.exhibits.every(x => isEligible(x, year))).toBe(true);
  });
});
