import db from '@/data/db.json';
import { TECHNIQUES } from '@/lib/processing/techniques';
import { MODES } from '@/lib/modes/registry';

/* PRESERVATION BASELINE — the Simple UI / guide / intro work is presentation only.
   These numbers were recorded before it began (13/10/2026); if one changes, content
   was removed or the crafting graph was touched, which that work must never do. */
describe('preservation baseline', () => {
  it('keeps every discovery, era, category and source', () => {
    // exp28 (g13) items are sourced additions on top of this baseline; the 2780 below changes only when a deliberate content batch lands
    const orig = (db.nodes as { id: string; hidden?: boolean; src: string[] }[]).filter(n => !n.id.startsWith('exp28_'));
    expect(orig.length).toBe(2780); // 918 base + 999 exp26 (g11) + 841 anc27 individual-recipe items (g12) + 22 early-craft items (g14)
    expect(db.eras.length).toBe(14);
    expect(db.categories.length).toBe(13);
    expect(Object.keys(db.sources).filter(k => !k.startsWith('x28_')).length).toBe(93); // 71 + 22 topic sources added with the field notes for batches 1-7
    expect({ total: orig.length, core: orig.filter(n => !n.hidden).length, hidden: orig.filter(n => n.hidden).length,
      sourceRequired: orig.filter(n => n.src.includes('source_required')).length }).toEqual({ total: 2780, core: 2764, hidden: 16, sourceRequired: 2111 }); // 2615 before the rewrite batches; 504 rewritten items now cite a topic source
  });

  it('keeps every recipe', () => {
    const recipes = (db.nodes as { id: string; rec?: unknown[] }[]).filter(x => !x.id.startsWith('exp28_')).reduce((n, x) => n + (Array.isArray(x.rec) ? x.rec.length : 0), 0);
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

// recorded 5538 before the early-craft batches; they add 28 recipe entries (g14 items and new routes to existing items)
const BASELINE_RECIPES = 5566; // 3856 + 1682 (two authored routes per anc27 item) + 28 from the early-craft batches (g14 items and added routes)
const BASELINE_TECHNIQUES = 25;
