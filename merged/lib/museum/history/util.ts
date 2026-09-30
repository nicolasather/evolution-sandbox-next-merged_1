import type { DisplayForm, ExhibitImportance, HistoricalExhibit, Year } from './types';

/* Tiny, data-free helpers shared by the catalog, selectors and store — kept
   apart from data.ts so light importers (the top-bar hint, the store) do not
   pull the whole exhibit database into their bundle. */

export const FORM_BY_IMPORTANCE: Record<ExhibitImportance, DisplayForm> = {
  supporting: 'vitrine', milestone: 'pedestal', breakthrough: 'suspended', defining: 'monument',
};

/** Representative placement year. */
export const anchorOf = (e: HistoricalExhibit): Year => e.when.anchor ?? e.when.from;
/** The canonical timeline year at which an exhibit becomes historically available. */
export const unlockOf = (e: HistoricalExhibit): Year => e.unlockAt ?? e.when.from;
export const formOf = (e: HistoricalExhibit): DisplayForm => e.display.form ?? FORM_BY_IMPORTANCE[e.importance];

export function compareExhibits(a: HistoricalExhibit, b: HistoricalExhibit): number {
  return anchorOf(a) - anchorOf(b) || unlockOf(a) - unlockOf(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

