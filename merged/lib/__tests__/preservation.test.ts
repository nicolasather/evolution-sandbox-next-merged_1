import db from '@/data/db.json';
import { TECHNIQUES } from '@/lib/processing/techniques';
import { MODES } from '@/lib/modes/registry';

/* PRESERVATION BASELINE — the Simple UI / guide / intro work is presentation only.
   These numbers were recorded before it began (13/10/2026); if one changes, content
   was removed or the crafting graph was touched, which that work must never do. */
describe('preservation baseline', () => {
  it('keeps every discovery, era, category and source', () => {
    // exp28 (g13) items are sourced additions on top of this baseline; the 2758 below must never change
    const orig = (db.nodes as { id: string; hidden?: boolean; src: string[] }[]).filter(n => !n.id.startsWith('exp28_'));
    expect(orig.length).toBe(2758); // 918 base + 999 exp26 (g11) + 841 anc27 individual-recipe items (g12)
    expect(db.eras.length).toBe(14);
    expect(db.categories.length).toBe(13);
    expect(Object.keys(db.sources).filter(k => !k.startsWith('x28_')).length).toBe(71);
    expect({ total: orig.length, core: orig.filter(n => !n.hidden).length, hidden: orig.filter(n => n.hidden).length,
      sourceRequired: orig.filter(n => n.src.includes('source_required')).length }).toEqual({ total: 2758, core: 2742, hidden: 16, sourceRequired: 2604 });
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

const BASELINE_RECIPES = 5538; // 3856 + 1682 (two authored routes per anc27 item)
const BASELINE_TECHNIQUES = 25;
