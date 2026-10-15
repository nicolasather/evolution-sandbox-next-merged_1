import db from '@/data/db.json';
import { TECHNIQUES } from '@/lib/processing/techniques';
import { MODES } from '@/lib/modes/registry';

/* PRESERVATION BASELINE — the Simple UI / guide / intro work is presentation only.
   These numbers were recorded before it began (13/10/2026); if one changes, content
   was removed or the crafting graph was touched, which that work must never do. */
describe('preservation baseline', () => {
  it('keeps every discovery, era, category and source', () => {
    expect(db.nodes.length).toBe(1917);
    expect(db.eras.length).toBe(14);
    expect(db.categories.length).toBe(13);
    expect(Object.keys(db.sources).length).toBe(71);
    expect(db.counts).toEqual({ total: 1917, core: 1901, hidden: 16, sourceRequired: 1763 });
  });

  it('keeps every recipe', () => {
    const recipes = (db.nodes as { rec?: unknown[] }[]).reduce((n, x) => n + (Array.isArray(x.rec) ? x.rec.length : 0), 0);
    expect(recipes).toBe(BASELINE_RECIPES);
  });

  it('keeps every technique', () => {
    expect(TECHNIQUES.length).toBe(BASELINE_TECHNIQUES);
  });

  it('keeps every game mode', () => {
    expect(MODES.map(m => m.id)).toEqual([
      'main-evolution', 'survival', 'civilization', 'archaeology', 'escape-room',
      'decipher', 'alien-archaeology', 'reverse-evolution', 'minimum-path',
    ]);
    expect(MODES.every(m => m.status === 'available')).toBe(true);
  });
});

const BASELINE_RECIPES = 3856;
const BASELINE_TECHNIQUES = 25;
