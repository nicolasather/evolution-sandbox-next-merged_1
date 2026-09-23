import rawDb from '@/data/db.json';
import art from '@/data/art.json';
import { svg, artCount } from '@/lib/glyphs';
import type { Db } from '@/lib/types';

const db = rawDb as unknown as Db;
const ART = art as Record<string, string>;

describe('discovery drawings', () => {
  it('has a hand-drawn plate for every discovery', () => {
    const missing = db.nodes.filter(n => !ART[n.id]).map(n => n.id);
    expect(missing).toEqual([]);
    expect(artCount).toBe(db.nodes.length);
  });

  it('never reuses a drawing', () => {
    const seen = new Map<string, string>();
    for (const n of db.nodes) {
      const key = ART[n.id].replace(/\s+/g, '');
      expect(seen.get(key) ?? n.id).toBe(n.id);
      seen.set(key, n.id);
    }
  });

  it('keeps every drawing inside the stroke-only grammar', () => {
    for (const n of db.nodes) {
      const m = ART[n.id];
      expect(m).not.toMatch(/<(text|image|script|style|foreignObject|use|defs)\b/i);
      expect(m).not.toMatch(/\son\w+=/i);
      for (const f of m.match(/fill="[^"]*"/g) ?? []) expect(['fill="none"', 'fill="currentColor"']).toContain(f);
    }
  });

  it('renders the drawing, not the fallback grammar', () => {
    const n = db.nodes[0];
    expect(svg(n)).toContain(ART[n.id]);
  });
});
