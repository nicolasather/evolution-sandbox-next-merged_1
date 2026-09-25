import rawDb from '@/data/db.json';
import { Engine } from '@/lib/engine';
import type { Db } from '@/lib/types';
import { playDb, processingData } from '@/lib/processing';
import { buildWorldModel, majorsFile } from '../registry';

const db = rawDb as unknown as Db;
const nodes = new Map(db.nodes.map(n => [n.id, n]));
const ENUM = {
  precision: ['site', 'area', 'region', 'broad', 'unlocated'],
  certainty: ['firm', 'regional', 'debated', 'multiple', 'unknown'],
  tier: ['A', 'B'],
  marker: ['pin', 'ring', 'halo'],
};
// 'global' is the group of majors with no single place; it is not one of the map's regions
const geoIds = new Set<string>([...majorsFile.regions.map(r => r.id), 'global']);

describe('data/majors.json', () => {
  it('is a dense catalogue: at least 100 majors, mostly full-cinematic', () => {
    expect(majorsFile.majors.length).toBeGreaterThanOrEqual(100);
    expect(majorsFile.majors.filter(m => m.tier === 'A').length).toBeGreaterThan(majorsFile.majors.length / 2);
  });

  it('names each major once, and every one is a discovery that exists in the database', () => {
    const ids = majorsFile.majors.map(m => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(nodes.has(id)).toBe(true);
  });

  it('never points at a material or a state (only real discoveries can be major)', () => {
    for (const m of majorsFile.majors) {
      expect(nodes.get(m.id)?.state).toBeFalsy();
      expect(db.primitives).not.toContain(m.id);
    }
  });

  it('never requires a hidden node — a hidden invention can only ever be a bonus', () => {
    for (const m of majorsFile.majors) {
      if (nodes.get(m.id)?.hidden) expect(m.required).toBe(false);
    }
    // and the model agrees even if a data slip said otherwise
    const slip = { ...majorsFile, majors: majorsFile.majors.map(m => (nodes.get(m.id)?.hidden ? { ...m, required: true } : m)) };
    const model = buildWorldModel(db, slip);
    for (const m of model.majors) if (m.hidden) expect(m.required).toBe(false);
  });

  it('uses only known enums, regions and sane coordinates', () => {
    for (const m of majorsFile.majors) {
      expect(ENUM.precision).toContain(m.precision);
      expect(ENUM.certainty).toContain(m.certainty);
      expect(ENUM.tier).toContain(m.tier);
      if (m.marker) expect(ENUM.marker).toContain(m.marker);
      expect(geoIds.has(m.geo)).toBe(true);
      expect(m.lat).toBeGreaterThanOrEqual(-90); expect(m.lat).toBeLessThanOrEqual(90);
      expect(m.lon).toBeGreaterThanOrEqual(-180); expect(m.lon).toBeLessThanOrEqual(180);
      for (const a of m.alsoAt ?? []) {
        expect(a.lat).toBeGreaterThanOrEqual(-90); expect(a.lat).toBeLessThanOrEqual(90);
        expect(a.lon).toBeGreaterThanOrEqual(-180); expect(a.lon).toBeLessThanOrEqual(180);
        expect(a.label.length).toBeGreaterThan(0);
      }
    }
  });

  it('gives every major a region, a period and one short educational line', () => {
    for (const m of majorsFile.majors) {
      expect(m.region.trim().length).toBeGreaterThan(2);
      expect(m.period.trim().length).toBeGreaterThan(2);
      expect(m.fact.trim().length).toBeGreaterThan(20);
      expect(m.fact.length).toBeLessThanOrEqual(175);
    }
  });

  it('is honest about places: no "site" precision for a debated origin, and an unlocated major says so', () => {
    for (const m of majorsFile.majors) {
      if (m.certainty === 'debated' || m.certainty === 'unknown') expect(m.precision).not.toBe('site');
      if (m.precision === 'unlocated') expect(m.geo).toBe('global');
    }
  });

  it('marks something as more than one origin only when it gives the other centres', () => {
    for (const m of majorsFile.majors) {
      if (m.certainty === 'multiple') expect((m.alsoAt ?? []).length).toBeGreaterThan(0);
    }
  });

  it('keeps every region of the world map represented', () => {
    const used = new Set(majorsFile.majors.map(m => m.geo));
    for (const r of majorsFile.regions) if (r.id !== 'global') expect(used.has(r.id)).toBe(true);
  });
});

describe('the world model over the real database', () => {
  const model = buildWorldModel(db);

  it('joins every major to its node (name, era, date)', () => {
    expect(model.size).toBe(majorsFile.majors.length);
    for (const m of model.majors) {
      const n = nodes.get(m.id)!;
      expect(m.name).toBe(m.displayName ?? n.n);
      expect(m.era).toBe(n.era);
      expect(m.date).toBe(n.date);
    }
  });

  it('asks for something in every era that has a next one, so no lock is empty', () => {
    for (const e of model.eras.slice(0, -1)) expect((model.required.get(e.id) ?? []).length).toBeGreaterThan(0);
  });

  it('counts a required total across the eras that matches the sum of the eras', () => {
    const sum = [...model.required.values()].reduce((s, l) => s + l.length, 0);
    expect(model.requiredTotal).toBe(sum);
  });

  it('drops entries whose node is missing, so a small database is never locked behind them', () => {
    const tiny = buildWorldModel({ nodes: db.nodes.filter(n => n.id !== 'sharp_stone'), eras: db.eras });
    expect(tiny.isMajor('sharp_stone')).toBe(false);
    expect(tiny.size).toBe(model.size - 1);
  });
});

describe('the era lock can always be played through', () => {
  // the game as a visitor plays it: the authored data plus the processing layer, with the lock ON throughout
  const nodesOf = new Map(playDb.nodes.map(n => [n.id, n]));

  /** Work and assemble everything reachable — never waiving the lock — optionally refusing some discoveries. */
  function play(skip: (id: string) => boolean = () => false): Engine {
    const e = new Engine(playDb);
    let progress = true, guard = 0;
    while (progress && guard++ < 400) {
      progress = false;
      for (const n of playDb.nodes) {
        if (e.has(n.id) || skip(n.id) || !e.isRecipeUnlocked(n.id)) continue;
        const r = n.rec.find(rec => rec.every(i => e.holds(i) && !skip(i)));
        if (r && e.combineMany(r).status === 'new') progress = true;
      }
      for (const t of processingData.transforms) {
        if (!e.holds(t.from) || t.out.some(skip)) continue;
        const r = e.process(t.from, t.action);
        if (r.status === 'done' && (r.fresh.length || r.discoveries.some(d => d.status === 'new'))) progress = true;
      }
    }
    return e;
  }

  it('reaches every discovery with the lock on', () => {
    const e = play();
    expect(e.found.size).toBe(playDb.nodes.length);
    for (const era of playDb.eras) expect(e.eraProgress(era.id).open).toBe(true);
  });

  it('completes every era from its required majors alone, without a single hidden discovery', () => {
    const e = play(id => !!nodesOf.get(id)?.hidden);
    for (const era of playDb.eras) {
      const p = e.eraProgress(era.id);
      expect(p.requiredDone).toBe(p.required);
      expect(p.complete).toBe(true);
    }
    // the last era was reached without waiving anything, and no hidden major was needed to get there
    expect(e.isEraOpen(playDb.eras[playDb.eras.length - 1].id)).toBe(true);
    expect(e.worldSummary().requiredFound).toBe(e.worldSummary().requiredTotal);
    expect(e.worldSummary().hiddenLeft).toBeGreaterThan(0);
  });
});
