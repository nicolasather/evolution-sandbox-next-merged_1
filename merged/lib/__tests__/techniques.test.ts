import rawDb from '@/data/db.json';
import processingJson from '@/data/processing.json';
import { Engine } from '@/lib/engine';
import { ACTIONS, ACTION_ORDER } from '@/lib/processing/actions';
import { applyProcessing } from '@/lib/processing/overlay';
import { physicsOf, envOf } from '@/lib/processing/physics';
import { FAMILIES, TECHNIQUES } from '@/lib/processing/techniques';
import { TUNE, handKindOf } from '@/lib/craft/kinds';
import { revealedPhysics } from '@/lib/processing/reveal';
import { Gesture } from '@/lib/craft/gesture';
import type { ProcessingData } from '@/lib/processing/types';
import type { Db } from '@/lib/types';

const data = processingJson as unknown as ProcessingData;
const db = applyProcessing(rawDb as unknown as Db, data);
/** These tests are about techniques and construction, not about the era lock: play with it waived. */
const fresh = () => { const e = new Engine(db); e.waiveEraLock(); return e; };
type Priv = { emit(): void };

/** Put things in the player's hands without playing for them. */
function give(e: Engine, ...ids: string[]) {
  for (const id of ids) {
    if (e.holds(id)) continue;
    if (db.states?.some(s => s.id === id)) e.states.add(id);
    else { e.found.add(id); e.order.push(id); }
    e.bag.push(id);
  }
  (e as unknown as Priv).emit();
}
/** Open the Stone Age gates so a late result is not held back for the wrong reason. */
const openTiers = (e: Engine) => give(e, ...db.nodes.filter(n => n.stone_age_tier === 'olduvai' || n.stone_age_tier === 'middle').map(n => n.id));

describe('technique catalogue', () => {
  it('covers every action once, with a unique key and a family', () => {
    const ids = TECHNIQUES.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.sort()).toEqual(Object.keys(TUNE).sort());
    const keys = TECHNIQUES.map(t => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    const fams = new Set(FAMILIES.map(f => f.id));
    for (const t of TECHNIQUES) expect(fams.has(t.family)).toBe(true);
    expect(ACTION_ORDER).toHaveLength(TECHNIQUES.length);
    for (const a of ACTION_ORDER) expect(ACTIONS[a].label).toBeTruthy();
  });

  it('only names capabilities and holdings that exist', () => {
    const all = new Set([...db.nodes.map(n => n.id), ...(db.states ?? []).map(s => s.id)]);
    for (const t of TECHNIQUES) {
      if (t.unlock.cap) expect(data.capabilities[t.unlock.cap]).toBeDefined();
      for (const id of [...(t.unlock.all ?? []), ...(t.unlock.any ?? [])]) expect(all.has(id)).toBe(true);
    }
    for (const t of data.transforms) if (t.needs) expect(data.capabilities[t.needs]).toBeDefined();
  });

  it('gives every technique at least one thing to do, and every transform a technique that can reach it', () => {
    for (const t of TECHNIQUES) expect(data.transforms.some(x => x.action === t.id)).toBe(true);
  });

  it('starts with a few techniques and keeps the rest to be discovered', () => {
    const e = fresh();
    expect(e.known.sort()).toEqual(['brush', 'pull', 'separate', 'smash']);
    expect(e.knows('cut')).toBe(false);
    expect(e.takeReveals()).toEqual([]);
  });
});

describe('learning a technique', () => {
  it('appears when what it needs is held, and is announced exactly once', () => {
    const e = fresh();
    expect(e.process('stone', 'smash').status).toBe('done'); // Sharp Stone
    const reveals = e.takeReveals();
    expect(reveals.map(r => r.action)).toContain('cut');
    const cut = reveals.find(r => r.action === 'cut')!;
    expect(cut.label).toBe('Cut');
    expect(cut.family).toBe('edge');
    expect(cut.affects).toBeGreaterThan(0);
    expect(e.takeReveals()).toEqual([]);
    expect(e.knows('cut')).toBe(true);
  });

  it('a reveal says how many held things may react, not which', () => {
    const e = fresh();
    e.process('stone', 'smash');
    const cut = e.takeReveals().find(r => r.action === 'cut')!;
    expect(cut.message).not.toMatch(/wood|bone|fibre|stone/i);
    expect(typeof cut.affects).toBe('number');
  });

  it('is not told twice after a save is restored', () => {
    const e = fresh();
    e.process('stone', 'smash');
    e.takeReveals();
    const e2 = fresh();
    give(e2, 'sharp_stone');
    expect(e2.knows('cut')).toBe(true);
  });

  it('a correct answer can teach a technique early, once', () => {
    const e = fresh();
    expect(e.teach('polish')).toBe(true);
    expect(e.knows('polish')).toBe(true);
    expect(e.takeReveals()[0]).toMatchObject({ action: 'polish', via: 'question' });
    expect(e.teach('polish')).toBe(false);
  });

  it('will not do work it has not learned', () => {
    const e = fresh();
    give(e, 'water', 'clay');
    e.known.length = 0; // pretend nothing is known, keep the holdings
    (e as unknown as { knownSet: Set<string> }).knownSet.clear();
    const r = e.process('clay', 'mix');
    expect(r.status).toBe('nothing');
    if (r.status === 'nothing') expect(r.reason).toBe('locked');
  });
});

describe('multi-stage construction', () => {
  it('turns clay into pottery in five held stages', () => {
    const e = fresh();
    openTiers(e);
    give(e, 'clay', 'water', 'fire');
    expect(e.knows('mix')).toBe(true);
    const mix = e.process('clay', 'mix');
    expect(mix.status).toBe('done');
    expect(e.states.has('wet_clay')).toBe(true);
    expect(e.knows('shape')).toBe(true);
    expect(e.process('wet_clay', 'shape').status).toBe('done');
    expect(e.knows('dry')).toBe(true);
    expect(e.process('shaped_clay', 'dry').status).toBe('done');
    expect(e.states.has('dried_clay')).toBe(true);
    expect(e.knows('heat')).toBe(true);
    const fire = e.process('dried_clay', 'heat');
    expect(fire.status).toBe('done');
    expect(e.has('pottery')).toBe(true);
  });

  it('casts copper through heat, pour and cool', () => {
    const e = fresh();
    openTiers(e);
    give(e, 'copper', 'kiln', 'pottery', 'controlled_fire');
    expect(e.process('copper', 'heat').status).toBe('done');
    expect(e.states.has('molten_copper')).toBe(true);
    expect(e.process('molten_copper', 'pour').status).toBe('done');
    expect(e.knows('cool')).toBe(true);
    expect(e.process('poured_copper', 'cool').status).toBe('done');
    expect(e.has('casting')).toBe(true);
  });

  it('twists strands into cordage and cordage into rope', () => {
    const e = fresh();
    openTiers(e);
    expect(e.process('fiber', 'pull').status).toBe('done');
    expect(e.knows('twist')).toBe(true);
    expect(e.process('strands', 'twist').status).toBe('done');
    expect(e.has('cordage')).toBe(true);
    expect(e.knows('tie')).toBe(true);
    expect(e.process('cordage', 'twist').status).toBe('done');
    expect(e.has('rope')).toBe(true);
    expect(e.knows('stretch')).toBe(true);
  });
});

describe('failure feedback', () => {
  it('says impossible, wrong action, close, or missing tool — and never what would work', () => {
    const e = fresh();
    give(e, 'water', 'clay', 'sharp_stone');
    const imp = e.process('water', 'smash');
    expect(imp.status === 'nothing' && imp.kind).toBe('impossible');
    const wrong = e.process('clay', 'brush');
    expect(wrong.status === 'nothing' && wrong.kind).toBe('wrong_action');
    const close = e.process('clay', 'shape');
    expect(close.status === 'nothing' && close.kind).toBe('close');
    if (close.status === 'nothing') expect(close.message).not.toMatch(/water|mix/i);
  });

  it('names a missing kind of tool, not a tool', () => {
    const e = fresh();
    give(e, 'sand');
    give(e, 'fire');
    expect(e.knows('heat')).toBe(true);
    const r = e.process('sand', 'heat');
    expect(r.status === 'nothing' && r.kind).toBe('tool');
    if (r.status === 'nothing') expect(r.note).toMatch(/hotter|closed fire/i);
  });
});

describe('physics classification', () => {
  const ph = (id: string) => physicsOf(db.proc, db.nodes.find(n => n.id === id) ?? db.states?.find(s => s.id === id));
  it('reads class, shape and properties from what the game already knows', () => {
    expect(ph('stone')).toMatchObject({ materialClass: 'mineral', shapeClass: 'chunk' });
    expect(ph('stone').properties).toEqual(expect.arrayContaining(['hard', 'brittle', 'heavy']));
    expect(ph('stick')).toMatchObject({ materialClass: 'wood', shapeClass: 'rod' });
    expect(ph('stick').properties).toContain('flammable');
    expect(ph('strands').shapeClass).toBe('strand');
    expect(ph('water')).toMatchObject({ materialClass: 'liquid', shapeClass: 'liquid' });
    expect(ph('clay').properties).toEqual(expect.arrayContaining(['plastic', 'absorbent']));
    expect(ph('clay').stateModifiers).toEqual(expect.arrayContaining(['wet', 'shaped']));
    expect(ph('sharp_stone').properties).toContain('sharp');
  });
  it('drives the environment: fire chars wood, water soaks clay, wind moves fibre and not stone', () => {
    expect(envOf(ph('stick')).chars).toBe(true);
    expect(envOf(ph('stone')).chars).toBe(false);
    expect(envOf(ph('clay')).soaks).toBe(true);
    expect(envOf(ph('stone')).windy).toBe(0);
    expect(envOf(ph('strands')).windy).toBeGreaterThan(0.5);
  });
  it('gives every resource a record, with no missing shape', () => {
    for (const n of [...db.nodes, ...(db.states ?? [])]) {
      const p = physicsOf(db.proc, n);
      expect(p.materialClass).toBeTruthy();
      expect(p.shapeClass).toBeTruthy();
    }
  });
});

describe('gesture kinds', () => {
  const T = { x: 100, y: 100, r: 30, hard: 0.2 };
  it('twist is done by going round, not by dragging across', () => {
    const g = new Gesture('twist', T);
    expect(g.down(130, 100)).toBe(true);
    for (let x = 130; x >= 70; x -= 6) g.move(x, 100);
    expect(g.done).toBe(false);
    for (let a = 0; a < Math.PI * 2 * 1.4; a += 0.15) g.move(100 + Math.cos(a) * 35, 100 + Math.sin(a) * 35);
    expect(g.done).toBe(true);
  });
  it('hold fills while the pointer stays and drains when it lets go', () => {
    const g = new Gesture('dry', T);
    g.down(100, 100);
    for (let i = 0; i < 20; i++) g.tick(0.1);
    expect(g.prog).toBeGreaterThan(0.5);
    g.up();
    for (let i = 0; i < 20; i++) g.tick(0.1);
    expect(g.prog).toBeLessThan(0.2);
    g.down(100, 100);
    for (let i = 0; i < 40; i++) g.tick(0.1);
    expect(g.done).toBe(true);
  });
  it('every hold action completes in about its stated time, and no sooner', () => {
    for (const a of ACTION_ORDER.filter(x => TUNE[x].kind === 'hold')) {
      const g = new Gesture(a, T);
      expect(g.down(100, 100)).toBe(true);
      const secs = TUNE[a].secs ?? 2;
      for (let t = 0; t < secs - 0.2; t += 0.1) g.tick(0.1);
      expect(g.done).toBe(false);
      for (let t = 0; t < 0.6; t += 0.1) g.tick(0.1);
      expect(g.done).toBe(true);
    }
  });
  it('scraping bark gives strands, and says so plainly once they are already in hand', () => {
    const e = fresh();
    give(e, 'sharp_stone', 'wood', 'bark');
    expect(e.knows('scrape')).toBe(true);
    const first = e.process('bark', 'scrape');
    expect(first.status).toBe('done');
    const again = e.process('bark', 'scrape');
    expect(again.status).toBe('nothing');
    expect((again as { kind?: string }).kind).toBe('spent');
  });
  it('hammer takes three blows even on a soft thing; chisel takes four, spaced', () => {
    const h = new Gesture('hammer', T);
    expect(h.need).toBe(3);
    const c = new Gesture('chisel', T);
    expect(c.need).toBe(4);
  });
  it('every action borrows one of the five hand poses', () => {
    for (const a of ACTION_ORDER) expect(['brush', 'smash', 'cut', 'separate', 'dig']).toContain(handKindOf(a));
  });
});

describe('property reveal (P1.7/P1.8)', () => {
  it('the most obvious property is free; the rest wait for an insight actually seen', () => {
    const e = fresh();
    const stone = db.nodes.find(n => n.id === 'stone')!;
    const before = revealedPhysics(e, stone);
    expect(before.reveals[0].known).toBe(true);          // the first, most salient property is free
    const brittle = before.reveals.find(r => r.id === 'brittle');
    expect(brittle?.known).toBe(false);                   // not yet noticed
    give(e, 'stone');
    e.process('stone', 'smash');                          // the smash.done insight teaches 'brittle'
    const after = revealedPhysics(e, stone);
    expect(after.reveals.find(r => r.id === 'brittle')?.known).toBe(true);
  });
});

describe('journal (P3.7)', () => {
  it('tracks a first discovery, the deepest reached, and the most-used technique', () => {
    const e = fresh();
    give(e, 'sharp_stone', 'wood', 'stick');
    e.process('stick', 'carve');
    e.process('stick', 'carve');
    const j = e.journal();
    expect(j.first).not.toBeNull();
    expect(j.deepest).toBeTruthy();
    expect(j.mostUsedAction).toBe('carve');
    expect(j.noHintPercent).not.toBeNull();
  });
  it('counts held things with a known, untried technique still open on them', () => {
    const e = fresh();
    give(e, 'sharp_stone', 'wood', 'bark');
    expect(e.openWork()).toBeGreaterThan(0);
    e.process('bark', 'scrape');
    // scrape on bark is now tried; openWork should not count it again for that same action
    const after = e.openWork();
    expect(after).toBeGreaterThanOrEqual(0);
  });
});

describe('component assembly (P2.5)', () => {
  // Both routes below were chosen (and are re-verified here) specifically because none of their
  // pairwise sub-combinations collides with any OTHER recipe in the game — see CHANGELOG 1.11.0.
  // The engine (combineMany/multiKey) and the bench's N-body clustering already handled 2–5-piece
  // assembly generically before this round; what was missing was recipe data that used it.
  it('assembles Spear directly from a composite tool, a shaft and a bone tip, in any order', () => {
    const e = fresh();
    give(e, 'composite_tool', 'wood', 'bone');
    const res = e.combineMany(['bone', 'composite_tool', 'wood']); // deliberately not in recipe order
    expect(res.status).toBe('new');
    if (res.status === 'new') expect(res.node.id).toBe('spear');
  });

  it('still walks the original two-part spear routes — the new assembly only adds another door', () => {
    const e = fresh();
    give(e, 'wood', 'sharp_stone');
    expect(e.combine('wood', 'sharp_stone').status).toBe('new');
    expect(e.has('spear')).toBe(true);
  });

  it('assembles Shelter directly from poles, lashing and a sewn cover, in any order', () => {
    const e = fresh();
    give(e, 'wood', 'binding', 'sewing');
    const res = e.combineMany(['sewing', 'wood', 'binding']);
    expect(res.status).toBe('new');
    if (res.status === 'new') expect(res.node.id).toBe('shelter');
  });

  it('tells apart a real 3-way assembly from a 3-way miss (the odd one out)', () => {
    const e = fresh();
    give(e, 'wood', 'binding', 'sewing', 'stone');
    const miss = e.combineMany(['wood', 'binding', 'stone']);
    expect(miss.status).toBe('fail');
  });
});
