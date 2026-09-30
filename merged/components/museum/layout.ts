import type { Catalog } from '@/lib/museum/history/data';
import { formOf, unlockOf } from '@/lib/museum/history/util';
import { galleryViews, type GalleryStatus } from '@/lib/museum/history/selectors';
import type { DisplayForm, Gallery, HistoricalExhibit, Year } from '@/lib/museum/history/types';

/* ============================================================================
   HALL LAYOUT — where every display stands along the Humanity hall.

   The hall is one continuous corridor in chronological order. Each gallery
   is a room entered through a portal; inside it, displays are spaced by
   importance, so a civilisation-defining achievement takes a whole bay while
   supporting artefacts share small wall cases. Sealed galleries beyond the
   timeline are laid out as anonymous silhouettes (shape and size only —
   never a motif, a title or a date).
   ========================================================================== */

export const PORTAL_W = 420;
const PAD_END = 200;
/** Horizontal room each form needs. Supporting cases alternate upper/lower rows and overlap. */
const SLOT: Record<DisplayForm, number> = { vitrine: 150, pedestal: 270, suspended: 360, monument: 680, scene: 420 };

export type Row = 'floor' | 'upper' | 'lower' | 'air' | 'bay';

export interface HallItem {
  exhibit: HistoricalExhibit;
  x: number;
  row: Row;
  form: DisplayForm;
  available: boolean;
  /** 0–1 closeness to becoming available (1 when available). */
  nearness: number;
  galleryIndex: number;
  /** The room's light hue. */
  hue: number;
}

export interface HallGallery {
  gallery: Gallery;
  index: number;
  status: GalleryStatus;
  nearness: number;
  opensAt: Year;
  x0: number;
  x1: number;
  available: number;
  total: number;
}

export interface HallLayout {
  items: HallItem[];
  byId: Map<string, HallItem>;
  galleries: HallGallery[];
  width: number;
  /** World x where available history ends — the "you are here" line. */
  frontierX: number;
}

function proximity(target: Year, year: Year, present: Year): number {
  if (year >= target) return 1;
  const d = Math.log(Math.max(1, present + 1 - year)) - Math.log(Math.max(1, present + 1 - target));
  return Math.max(0, 1 - d / 0.9);
}

export function hallLayout(cat: Catalog, year: Year): HallLayout {
  const views = galleryViews(cat, year);
  const present = cat.calendar.present;
  const items: HallItem[] = [];
  const galleries: HallGallery[] = [];
  let x = 120;
  let frontierX = 0;
  views.forEach((v, gi) => {
    const x0 = x;
    x += PORTAL_W;
    const sealed = v.status !== 'open';
    // a sealed gallery is compressed into a shorter, distant silhouette
    const k = sealed ? (v.status === 'approaching' ? 0.7 : 0.45) : 1;
    let lowerNext = false;
    for (const e of v.exhibits) {
      const form = formOf(e);
      const available = unlockOf(e) <= year;
      const row: Row = form === 'monument' ? 'bay' : form === 'suspended' ? 'air' : form === 'vitrine' ? (lowerNext ? 'lower' : 'upper') : 'floor';
      if (form === 'vitrine') lowerNext = !lowerNext; else lowerNext = false;
      const w = SLOT[form] * k;
      const cx = x + w / 2;
      items.push({ exhibit: e, x: cx, row, form, available, nearness: available ? 1 : proximity(unlockOf(e), year, present), galleryIndex: gi, hue: v.gallery.hue });
      if (available) frontierX = Math.max(frontierX, cx + w / 2);
      // two stacked vitrines share one column
      x += form === 'vitrine' && row === 'upper' ? w * 0.35 : w;
      if (row === 'lower') x += w * 0.3;
    }
    x += PAD_END * k;
    galleries.push({
      gallery: v.gallery, index: gi, status: v.status, nearness: v.nearness, opensAt: v.opensAt,
      x0, x1: x, available: v.available.length, total: v.exhibits.length,
    });
  });
  return { items, byId: new Map(items.map(i => [i.exhibit.id, i])), galleries, width: x + 1400, frontierX };
}
