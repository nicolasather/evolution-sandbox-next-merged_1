import calendarJson from '@/data/museum/calendar.json';
import galleriesJson from '@/data/museum/galleries.json';
import regionsJson from '@/data/museum/regions.json';
import storyJson from '@/data/museum/story.json';
import ex01 from '@/data/museum/exhibits/01-deep-origins.json';
import ex02 from '@/data/museum/exhibits/02-first-toolmakers.json';
import ex03 from '@/data/museum/exhibits/03-fire-and-hearth.json';
import ex04 from '@/data/museum/exhibits/04-modern-minds.json';
import ex05 from '@/data/museum/exhibits/05-ice-age-worlds.json';
import ex06 from '@/data/museum/exhibits/06-first-farmers.json';
import ex07 from '@/data/museum/exhibits/07-cities-and-signs.json';
import ex08 from '@/data/museum/exhibits/08-bronze-and-exchange.json';
import ex09 from '@/data/museum/exhibits/09-iron-and-ideas.json';
import ex10 from '@/data/museum/exhibits/10-classical-engines.json';
import ex11 from '@/data/museum/exhibits/11-connected-worlds.json';
import ex12 from '@/data/museum/exhibits/12-print-and-oceans.json';
import ex13 from '@/data/museum/exhibits/13-scientific-revolution.json';
import ex14 from '@/data/museum/exhibits/14-steam-and-industry.json';
import ex15 from '@/data/museum/exhibits/15-electric-age.json';
import ex16 from '@/data/museum/exhibits/16-atomic-century.json';
import ex17 from '@/data/museum/exhibits/17-information-age.json';
import ex18 from '@/data/museum/exhibits/18-networked-planet.json';
import type {
  Gallery, HistoricalExhibit, MuseumCalendar, MuseumRegion, MuseumStory, Year,
} from './types';

/* ============================================================================
   CATALOG — the Humanity Museum's content, loaded once from data/museum/ and
   indexed. Pure data and pure functions: no React, no storage, no engine.

   To add exhibits: add entries to a data/museum/exhibits/*.json file (or a
   new file listed in EXHIBIT_FILES below). Nothing in the rendering system
   needs to change — lib/museum/__tests__/catalog.test.ts validates every
   id, reference, region, source and date.
   ========================================================================== */

interface ExhibitFile { gallery: string; exhibits: Omit<HistoricalExhibit, 'gallery'>[] }

/** Every exhibit file, in gallery order. Add new files here. */
export const EXHIBIT_FILES = [
  ex01, ex02, ex03, ex04, ex05, ex06, ex07, ex08, ex09,
  ex10, ex11, ex12, ex13, ex14, ex15, ex16, ex17, ex18,
] as unknown as ExhibitFile[];

export { FORM_BY_IMPORTANCE, anchorOf, unlockOf, formOf, compareExhibits } from './util';
import { compareExhibits, unlockOf } from './util';

export interface Catalog {
  exhibits: HistoricalExhibit[];
  byId: Map<string, HistoricalExhibit>;
  galleries: Gallery[];
  galleryById: Map<string, Gallery>;
  /** gallery id → its exhibits in chronological order (by anchor, then unlock, then id). */
  byGallery: Map<string, HistoricalExhibit[]>;
  /** Inverse of `relations.enabledBy`: what each exhibit helped make possible. */
  enables: Map<string, string[]>;
  regions: MuseumRegion[];
  regionById: Map<string, MuseumRegion>;
  calendar: MuseumCalendar;
  story: MuseumStory;
  /** Earliest unlock year of any exhibit in each gallery. */
  galleryOpensAt: Map<string, Year>;
}

export function buildCatalog(files: ExhibitFile[] = EXHIBIT_FILES): Catalog {
  const galleries = (galleriesJson as { galleries: Gallery[] }).galleries;
  const galleryById = new Map(galleries.map(g => [g.id, g]));
  const exhibits: HistoricalExhibit[] = [];
  const byId = new Map<string, HistoricalExhibit>();
  for (const f of files) {
    for (const raw of f.exhibits) {
      if (byId.has(raw.id)) continue;           // first declaration wins; the validator test reports duplicates
      const e = { ...raw, gallery: f.gallery } as HistoricalExhibit;
      exhibits.push(e);
      byId.set(e.id, e);
    }
  }
  exhibits.sort(compareExhibits);
  const byGallery = new Map<string, HistoricalExhibit[]>(galleries.map(g => [g.id, []]));
  for (const e of exhibits) byGallery.get(e.gallery)?.push(e);
  const enables = new Map<string, string[]>();
  for (const e of exhibits) {
    for (const p of e.relations.enabledBy ?? []) {
      if (!byId.has(p)) continue;
      const list = enables.get(p) ?? [];
      list.push(e.id);
      enables.set(p, list);
    }
  }
  const galleryOpensAt = new Map<string, Year>();
  for (const g of galleries) {
    const list = byGallery.get(g.id) ?? [];
    galleryOpensAt.set(g.id, list.length ? Math.min(...list.map(unlockOf)) : g.span.from);
  }
  const regions = (regionsJson as { regions: MuseumRegion[] }).regions;
  return {
    exhibits, byId, galleries, galleryById, byGallery, enables,
    regions, regionById: new Map(regions.map(r => [r.id, r])),
    calendar: calendarJson as unknown as MuseumCalendar,
    story: storyJson as unknown as MuseumStory,
    galleryOpensAt,
  };
}

let cached: Catalog | null = null;
/** The catalog the game plays, built once. */
export function catalog(): Catalog {
  if (!cached) cached = buildCatalog();
  return cached;
}
