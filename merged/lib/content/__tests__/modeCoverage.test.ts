import db from '@/data/db.json';
import atlas from '@/data/minimumpath/atlas.v1.json';
import arch from '@/data/expansion/archaeology_templates.json';
import surv from '@/data/expansion/survival_finds.json';
import esc from '@/data/expansion/escape_episodes.json';

/* Rule: any new catalogue item joins every mode. If this fails, run
   `python3 tools/expansion/sync_modes.py` (see docs/EXPANSION_1000_STATUS.md). */
const nodes = (db as { nodes: { id: string; era: string; tags?: string[] }[] }).nodes;
const exp = nodes.filter(n => n.id.startsWith('exp26_'));

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
    expect((esc as unknown[]).length).toBe(topics.size);
  });
});
