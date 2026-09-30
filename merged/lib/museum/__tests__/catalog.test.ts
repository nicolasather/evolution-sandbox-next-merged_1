import rawDb from '@/data/db.json';
import sourcesJson from '@/data/sources.json';
import { buildCatalog, EXHIBIT_FILES, unlockOf, anchorOf } from '@/lib/museum/history/data';
import { CATEGORIES, type Choreography, type Motif } from '@/lib/museum/history/types';
import { MOTIFS } from '@/components/museum/motifs';
import type { Db } from '@/lib/types';

/* The Humanity Museum's content is real history: every entry is checked here
   so it can be corrected and expanded without touching the renderer. */

const db = rawDb as unknown as Db;
const sources = (sourcesJson as { sources: Record<string, { scope: string }> }).sources;
const cat = buildCatalog();
const CHOREO: Choreography[] = ['assemble', 'ignite', 'mechanism', 'ascend', 'network', 'unfold', 'orbit', 'scan', 'grow', 'wave', 'stratum'];
const ROLES = ['origin', 'independent', 'early-centre', 'spread', 'site'];

describe('Humanity Museum catalog', () => {
  it('has a substantial dataset spanning prehistory to the present', () => {
    expect(cat.exhibits.length).toBeGreaterThanOrEqual(250);
    const years = cat.exhibits.map(anchorOf);
    expect(Math.min(...years)).toBeLessThanOrEqual(-6_000_000);
    expect(Math.max(...years)).toBeGreaterThanOrEqual(2020);
    for (const g of cat.galleries) expect((cat.byGallery.get(g.id) ?? []).length).toBeGreaterThan(0);
  });

  it('has unique ids across every file', () => {
    const ids = EXHIBIT_FILES.flatMap(f => f.exhibits.map(e => e.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every file names a real gallery', () => {
    for (const f of EXHIBIT_FILES) expect(cat.galleryById.has(f.gallery)).toBe(true);
  });

  it('every relation, region, category, source and discovery reference resolves', () => {
    const nodeIds = new Set(db.nodes.map(n => n.id));
    for (const e of cat.exhibits) {
      for (const r of [...(e.relations.enabledBy ?? []), ...(e.relations.related ?? [])]) {
        expect({ id: e.id, ref: r, ok: cat.byId.has(r) }).toEqual({ id: e.id, ref: r, ok: true });
        expect(r).not.toBe(e.id);
      }
      expect(e.regions.length).toBeGreaterThan(0);
      for (const l of e.regions) {
        expect({ id: e.id, region: l.region, ok: cat.regionById.has(l.region) }).toEqual({ id: e.id, region: l.region, ok: true });
        expect(ROLES).toContain(l.role);
        if (l.site) {
          expect(Math.abs(l.site.lat)).toBeLessThanOrEqual(90);
          expect(Math.abs(l.site.lon)).toBeLessThanOrEqual(180);
        }
      }
      expect(e.categories.length).toBeGreaterThan(0);
      for (const c of e.categories) expect(CATEGORIES).toContain(c);
      for (const s of e.sources.ids ?? []) expect({ id: e.id, s, ok: !!sources[s] }).toEqual({ id: e.id, s, ok: true });
      if (e.sources.status === 'cited') {
        // 'cited' means at least one subject-level (topic) source — never a homepage
        expect((e.sources.ids ?? []).some(s => sources[s]?.scope === 'topic')).toBe(true);
      }
      for (const n of e.discoveryIds ?? []) expect({ id: e.id, n, ok: nodeIds.has(n) }).toEqual({ id: e.id, n, ok: true });
    }
  });

  it('never invents a URL in content', () => {
    for (const e of cat.exhibits) {
      const text = JSON.stringify(e);
      expect(text).not.toMatch(/https?:\/\//);
    }
  });

  it('dates are ordered, honest and carry display text', () => {
    for (const e of cat.exhibits) {
      const w = e.when;
      expect(typeof w.display).toBe('string');
      expect(w.display.length).toBeGreaterThan(3);
      if (w.to !== undefined) expect(w.to).toBeGreaterThanOrEqual(w.from);
      if (w.anchor !== undefined) {
        expect(w.anchor).toBeGreaterThanOrEqual(w.from);
        if (w.to !== undefined) expect(w.anchor).toBeLessThanOrEqual(w.to);
      }
      expect(unlockOf(e)).toBeLessThanOrEqual(2026);
      // deep time is never shown to the year
      if (w.from < -20000) expect(['deep-time', 'millennia']).toContain(w.precision);
    }
  });

  it('every exhibit has the layered content the brief asks for', () => {
    for (const e of cat.exhibits) {
      expect(e.title.length).toBeLessThanOrEqual(40);
      expect(e.change.length).toBeGreaterThan(10);
      expect(e.context.length).toBeGreaterThan(60);
      expect(e.significance.length).toBeGreaterThan(20);
      expect(MOTIFS).toContain(e.display.motif as Motif);
      if (e.display.choreography) expect(CHOREO).toContain(e.display.choreography);
    }
  });

  it('marks independent invention where it claims more than one origin', () => {
    const multi = cat.exhibits.filter(e => e.regions.filter(r => r.role === 'independent').length >= 2);
    expect(multi.length).toBeGreaterThanOrEqual(20);
    for (const id of ['agriculture', 'writing', 'pottery', 'first-cities', 'calculus', 'coinage']) {
      expect(cat.byId.get(id)!.regions.filter(r => r.role === 'independent').length).toBeGreaterThanOrEqual(2);
    }
  });

  it('records uncertainty for contested claims', () => {
    const contested = cat.exhibits.filter(e => e.uncertainty?.level === 'contested' || e.uncertainty?.level === 'debated');
    expect(contested.length).toBeGreaterThanOrEqual(40);
  });

  it('establishes an importance hierarchy with civilisation-defining achievements', () => {
    const defining = cat.exhibits.filter(e => e.importance === 'defining').map(e => e.id);
    for (const id of ['controlled-fire', 'agriculture', 'writing', 'first-cities', 'printing-press', 'scientific-revolution',
      'steam-power', 'industrial-revolution', 'electrification', 'powered-flight', 'antibiotics', 'programmable-computer',
      'internet', 'space-age']) expect(defining).toContain(id);
    expect(defining.length).toBeLessThan(cat.exhibits.length / 10);
  });

  it('the relation graph is acyclic along enabledBy and always points back in time', () => {
    for (const e of cat.exhibits) {
      for (const p of e.relations.enabledBy ?? []) {
        const pe = cat.byId.get(p)!;
        expect({ child: e.id, parent: p, ok: unlockOf(pe) <= unlockOf(e) }).toEqual({ child: e.id, parent: p, ok: true });
      }
    }
  });

  it('the Human Story route references real exhibits in chronological order', () => {
    let prev = -Infinity;
    for (const c of cat.story.chapters) {
      const e = cat.byId.get(c.exhibit);
      expect(e).toBeDefined();
      expect(unlockOf(e!)).toBeGreaterThanOrEqual(prev);
      prev = unlockOf(e!);
    }
  });

  it('the calendar covers every game era monotonically', () => {
    const eras = cat.calendar.eras;
    expect(eras.map(e => e.era)).toEqual(db.eras.map(e => e.id));
    expect(eras[0].from).toBe(cat.calendar.start);
    expect(eras[eras.length - 1].to).toBe(cat.calendar.present);
    for (let i = 0; i < eras.length; i++) {
      expect(eras[i].to).toBeGreaterThan(eras[i].from);
      if (i) expect(eras[i].from).toBe(eras[i - 1].to);
    }
  });

  it('at the very start only a small prehistoric section is available', () => {
    const start = cat.exhibits.filter(e => unlockOf(e) <= cat.calendar.start);
    expect(start.length).toBeGreaterThan(0);
    expect(start.length).toBeLessThanOrEqual(10);
  });
});
