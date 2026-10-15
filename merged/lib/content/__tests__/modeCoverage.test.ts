import db from '@/data/db.json';
import atlas from '@/data/minimumpath/atlas.v1.json';
import arch from '@/data/expansion/archaeology_templates.json';
import surv from '@/data/expansion/survival_finds.json';
import esc from '@/data/expansion/escape_episodes.json';

/* Rule: any new catalogue item joins every mode. If this fails, run
   `python3 tools/expansion/sync_modes.py` (see docs/EXPANSION_1000_STATUS.md). */
const nodes = (db as { nodes: { id: string; era: string; tags?: string[]; modeMeta?: Record<string, { candidate?: boolean }> }[] }).nodes;
const exp = nodes.filter(n => n.id.startsWith('exp26_'));
const anc = nodes.filter(n => n.id.startsWith('anc27_'));

describe('every catalogue item is wired into the modes', () => {
  it('Minimum Path atlas holds every item', () => {
    const ids = new Set((atlas as { items: { id: string }[] }).items.map(i => i.id));
    expect(nodes.filter(n => !ids.has(n.id)).map(n => n.id)).toEqual([]);
  });
  it('Archaeology has a template for every early-era expansion item', () => {
    const ok = new Set(['origins', 'fire', 'settlement', 'agriculture', 'civilization', 'trade', 'metallurgy']);
    const have = new Set((arch as { itemId: string }[]).map(t => t.itemId));
    expect(exp.filter(n => ok.has(n.era) && !have.has(n.id)).map(n => n.id)).toEqual([]);
  });
  it('Survival has a find for every origins/fire/settlement expansion item', () => {
    const have = new Set((surv as { id: string }[]).map(t => t.id));
    expect(exp.filter(n => ['origins', 'fire', 'settlement'].includes(n.era) && !have.has(n.id)).map(n => n.id)).toEqual([]);
  });
  it('Escape Room has a room for every expansion topic', () => {
    const topics = new Set(exp.map(n => n.tags?.[1]).filter(Boolean));
    const rooms = esc as { id: string }[];
    for (const t of topics) expect(rooms.some(r => r.id === `x-${t}`)).toBe(true);
    // anc27 families that are too small for a fair 5-step order and a 4-way match get no room (see gen_escape.py)
    const ancTopics = new Set(anc.filter(n => n.modeMeta?.['escape-room']?.candidate).map(n => n.tags?.[1]).filter(Boolean));
    const ancRooms = rooms.filter(r => !topics.has(r.id.replace(/^x-/, '')));
    expect(ancRooms.length).toBeGreaterThan(30);
    for (const r of ancRooms) expect(ancTopics.has(r.id.replace(/^x-/, '') as string)).toBe(true);
  });
  it('anc27 items join Archaeology and Survival only where the item can physically be found', () => {
    const haveA = new Set((arch as { itemId: string }[]).map(t => t.itemId));
    const haveS = new Set((surv as { id: string }[]).map(t => t.id));
    for (const n of anc) {
      const m = n.modeMeta ?? {};
      if (!m.archaeology?.candidate) expect(haveA.has(n.id)).toBe(false);
      if (m.survival?.candidate) expect(haveS.has(n.id)).toBe(true); else expect(haveS.has(n.id)).toBe(false);
    }
    expect(anc.filter(n => haveA.has(n.id)).length).toBeGreaterThan(700);
  });
});
