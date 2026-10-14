import { readFileSync } from 'fs';
import path from 'path';
import type { Dataset } from '../types';

const root = path.resolve(__dirname, '../../..');
const ds = JSON.parse(readFileSync(path.join(root, 'dev-data/visual-lab/dataset.json'), 'utf8')) as Dataset;
const db = JSON.parse(readFileSync(path.join(root, 'data/db.json'), 'utf8')) as { nodes: { id: string; n: string }[] };
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

describe('visual-lab dataset', () => {
  it('has exactly 100 distinct resources in 10 categories of 10', () => {
    expect(ds.resources).toHaveLength(100);
    expect(new Set(ds.resources.map(r => r.id)).size).toBe(100);
    expect(new Set(ds.resources.map(r => norm(r.name))).size).toBe(100);
    expect(ds.categories.map(c => c.id)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']);
    for (const c of ds.categories) expect(ds.resources.filter(r => r.category === c.id)).toHaveLength(10);
  });

  it('every entry has every required field', () => {
    for (const r of ds.resources) {
      expect(r.id).toMatch(/^vl_[a-z0-9_]+$/);
      expect(r.name.length).toBeGreaterThan(2);
      expect(r.description.length).toBeGreaterThan(30);
      expect(r.period.length).toBeGreaterThan(2);
      expect(r.materials.length).toBeGreaterThan(0);
      expect(r.shapeFamily.length).toBeGreaterThan(2);
      expect(r.features.length).toBeGreaterThanOrEqual(3);
      expect(r.complexity).toBeGreaterThanOrEqual(1);
      expect(r.complexity).toBeLessThanOrEqual(5);
    }
  });

  it('none of the 100 is already in the production catalogue (by name or id)', () => {
    const existing = new Set(db.nodes.flatMap(n => [norm(n.n), norm(n.id)]));
    const clashes = ds.resources.filter(r => {
      const n = norm(r.name);
      return existing.has(n) || existing.has(n + 's') || existing.has(n.replace(/s$/, '')) || existing.has(norm(r.id.replace(/^vl_/, '')));
    });
    expect(clashes.map(r => r.name)).toEqual([]);
  });

  it('is recorded against the catalogue it was checked with', () => {
    expect(ds.catalogueNodeCount).toBe(db.nodes.length);
  });
});
