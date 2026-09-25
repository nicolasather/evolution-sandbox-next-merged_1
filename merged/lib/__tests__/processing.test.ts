import rawDb from '@/data/db.json';
import { Engine } from '@/lib/engine';
import { assess } from '@/lib/processing/assess';
import { computeDepths, applyProcessing, compile, multiKey } from '@/lib/processing/overlay';
import processingJson from '@/data/processing.json';
import type { ProcessingData } from '@/lib/processing/types';
import type { Db } from '@/lib/types';

const base = rawDb as unknown as Db;
const data = processingJson as unknown as ProcessingData;
const db = applyProcessing(base, data);
/** These tests are about what working a thing does, not about the era lock: play with it waived. */
const fresh = () => { const e = new Engine(db); e.waiveEraLock(); return e; };

const strictSub = (sub: string[], sup: string[]) => {
  if (sub.length >= sup.length) return false;
  const pool = [...sup];
  for (const s of sub) { const i = pool.indexOf(s); if (i < 0) return false; pool.splice(i, 1); }
  return true;
};

describe('overlay data', () => {
  it('leaves the authored database untouched', () => {
    expect(base.nodes.find(n => n.id === 'fishing')!.n).toBe('Fishing');
    expect(db.nodes.find(n => n.id === 'fishing')!.n).toBe('Fishing Rod');
    expect(db.nodes).toHaveLength(base.nodes.length);
  });

  it('recomputes the same depth as the build for the bare data', () => {
    const empty = compile({ ...data, transforms: [], unlocks: [], states: [], recipes: { add: [], retire: [] } });
    const d = computeDepths(base.nodes, empty, base.primitives);
    for (const n of base.nodes) expect(d.get(n.id)).toBe(n.depth);
  });

  it('gives 2-5 pieces to every recipe and never lets one recipe sit inside another that makes something else', () => {
    const rows = db.nodes.flatMap(n => n.rec.map(r => ({ id: n.id, ing: r })));
    for (const r of rows) { expect(r.ing.length).toBeGreaterThanOrEqual(2); expect(r.ing.length).toBeLessThanOrEqual(5); }
    const seen = new Map<string, string>();
    for (const r of rows) {
      const k = multiKey(r.ing);
      expect(seen.get(k) ?? r.id).toBe(r.id);
      seen.set(k, r.id);
    }
    const bad: string[] = [];
    for (const a of rows) for (const b of rows) {
      if (a.id !== b.id && strictSub(a.ing, b.ing)) bad.push(`${a.id}[${a.ing}] in ${b.id}[${b.ing}]`);
    }
    expect(bad).toEqual([]);
  });

  it('has one way of working each resource with each action', () => {
    const seen = new Set<string>();
    for (const t of data.transforms) {
      const k = `${t.from}:${t.action}`;
      expect(seen.has(k)).toBe(false);
      seen.add(k);
    }
  });

  it('names every state it uses and every entry it edits', () => {
    const ids = new Set([...db.nodes.map(n => n.id), ...data.states.map(s => s.id)]);
    for (const t of data.transforms) { expect(ids.has(t.from)).toBe(true); t.out.forEach(o => expect(ids.has(o)).toBe(true)); }
    for (const u of data.unlocks) { expect(ids.has(u.give)).toBe(true); u.when.forEach(w => expect(ids.has(w)).toBe(true)); }
    for (const c of Object.values(data.capabilities)) c.forEach(i => expect(ids.has(i)).toBe(true));
  });

  it('spans early pairs to five-piece finales', () => {
    const sizes = new Set(db.nodes.flatMap(n => n.rec.map(r => r.length)));
    expect([...sizes].sort()).toEqual([2, 3, 4, 5]);
  });
});

/** Play the whole game the way a player could: work things, assemble things, tier gates included. */
function playAll(e: Engine) {
  let progress = true;
  let guard = 0;
  while (progress && guard++ < 400) {
    progress = false;
    for (const n of db.nodes) {
      if (e.has(n.id) || !e.isRecipeUnlocked(n.id)) continue;
      const r = n.rec.find(rec => rec.every(i => e.holds(i)));
      if (r && e.combineMany(r).status === 'new') { progress = true; continue; }
    }
    for (const t of data.transforms) {
      if (!e.holds(t.from)) continue;
      const r = e.process(t.from, t.action);
      if (r.status === 'done' && (r.fresh.length || r.discoveries.some(d => d.status === 'new'))) progress = true;
    }
  }
}

describe('playing the overlay', () => {
  it('reaches every entry from the four raw materials', () => {
    const e = fresh();
    playAll(e);
    expect(e.found.size).toBe(db.nodes.length);
    expect(e.has('grand_theft_auto_vi')).toBe(true);
  });

  it('smashes a stone into a sharp stone, and says nothing more comes of doing it twice', () => {
    const e = fresh();
    const a = e.process('stone', 'smash');
    expect(a.status).toBe('done');
    if (a.status === 'done') expect(a.discoveries[0].node.id).toBe('sharp_stone');
    expect(e.has('sharp_stone')).toBe(true);
    const b = e.process('stone', 'smash');
    expect(b.status === 'nothing' && b.reason).toBe('spent');
  });

  it('needs an edge to cut and something to dig with, and says so', () => {
    const e = fresh();
    const cut = e.process('wood', 'cut');
    expect(cut.status === 'nothing' && cut.reason).toBe('tool');
    e.process('wood', 'smash');                // a stick, and with it, soil
    expect(e.states.has('stick')).toBe(true);
    expect(e.states.has('soil')).toBe(true);
    const dig = e.process('soil', 'dig');
    expect(dig.status).toBe('done');
    expect(e.states.has('clay')).toBe(true);
  });

  it('refuses by what a thing is made of', () => {
    const e = fresh();
    const r = e.process('fiber', 'smash');
    expect(r.status === 'nothing' && r.reason).toBe('material');
    expect(r.status === 'nothing' && r.message).toMatch(/flatten/i);
  });

  it('keeps worked states out of the counts and out of the archive', () => {
    const e = fresh();
    e.process('wood', 'smash');
    expect(e.found.has('stick')).toBe(false);
    expect(e.stats().core).toBe(4);
    expect(db.nodes.some(n => n.id === 'stick')).toBe(false);
    expect(e.inventory().some(n => n.id === 'stick')).toBe(true);
    expect(e.inventory({ states: false }).some(n => n.id === 'stick')).toBe(false);
  });

  it('assembles three pieces regardless of order and repeats', () => {
    const e = fresh();
    e.process('wood', 'smash');
    e.process('wood', 'brush');
    expect(e.combineMany(['bark', 'stick', 'stick']).status).toBe('new');
    expect(e.has('fire')).toBe(true);
  });

  it('answers a near miss with a reason and never a name', () => {
    const e = fresh();
    e.process('wood', 'smash');
    e.process('wood', 'brush');
    const partial = e.combineMany(['stick', 'stick', 'stone']);   // stone does not belong
    expect(partial.status).toBe('fail');
    if (partial.status === 'fail') {
      expect(['irrelevant', 'incomplete', 'related', 'none']).toContain(partial.info.kind);
      for (const n of db.nodes.filter(x => !e.has(x.id))) expect(partial.message).not.toContain(n.n);
    }
    const some = e.combineMany(['stick', 'bark']);
    expect(some.status === 'fail' && some.info.kind).toBe('incomplete');
  });

  it('says a piece is not in the right form when working it would make it fit', () => {
    const e = fresh();
    e.process('wood', 'smash');
    e.process('wood', 'brush');
    // fire wants sticks: wood in place of one is the right idea, the wrong form
    const r = e.combineMany(['wood', 'stick', 'bark']);
    expect(r.status === 'fail' && ['wrong_state', 'needs_processing']).toContain(r.status === 'fail' ? r.info.kind : '');
  });

  it('raises hint detail one rung at a time up to five', () => {
    const e = fresh();
    e.process('stone', 'smash');
    const first = e.requestHint();
    expect('error' in first).toBe(false);
    const levels = new Set<number>();
    for (let i = 0; i < 40; i++) {
      const v = e.hintView();
      levels.add(v.level);
      if (!v.targetId) break;
      e.combineMany(['bone', 'bone']); // repeated misses (a fail path)
      e.requestHint();
    }
    expect(Math.max(...levels)).toBeGreaterThanOrEqual(3);
  });

  it('round-trips a saved game with states and process routes', () => {
    const store: Record<string, string> = {};
    const win = { localStorage: { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }, removeItem: (k: string) => { delete store[k]; } } };
    (globalThis as unknown as { window: unknown }).window = win;
    try {
      const e = fresh();
      e.process('wood', 'smash');
      e.process('stone', 'smash');
      const g = fresh();
      expect(g.load()).toBe(true);
      expect(g.states.has('stick')).toBe(true);
      expect(g.has('sharp_stone')).toBe(true);
      expect(g.routeCount('sharp_stone').found).toBe(1);
    } finally {
      delete (globalThis as unknown as { window?: unknown }).window;
    }
  });

  it('assess is exported for the bench', () => { expect(typeof assess).toBe('function'); });
});
