import { Engine } from '@/lib/engine';
import { playDb, processingData } from '@/lib/processing';
import { LOCK_MESSAGE, worldFocus } from '../progress';

const db = playDb;
const eraIdx = new Map(db.eras.map((e, i) => [e.id, i]));
// states (a cleaned stone, say) are not discoveries and belong to no era
const nodeEra = (id: string) => eraIdx.get(db.nodes.find(n => n.id === id)?.era as never) ?? -1;
const fresh = () => new Engine(db);

/**
 * Play everything reachable in eras up to `maxEra` (index), with the lock ON.
 * Nothing in a later era can be made, so this is what a visitor could do at that point.
 */
function craft(e: Engine, maxEra: number, stop: () => boolean = () => false): void {
  let progress = true, guard = 0;
  while (progress && guard++ < 400) {
    progress = false;
    for (const n of db.nodes) {
      if (stop()) return;
      if (e.has(n.id) || (eraIdx.get(n.era) ?? 0) > maxEra || !e.isRecipeUnlocked(n.id)) continue;
      const r = n.rec.find(rec => rec.every(i => e.holds(i)));
      if (r && e.combineMany(r).status === 'new') progress = true;
    }
    for (const t of processingData.transforms) {
      if (stop()) return;
      if (!e.holds(t.from) || t.out.some(o => nodeEra(o) > maxEra)) continue;
      const r = e.process(t.from, t.action);
      if (r.status === 'done' && (r.fresh.length || r.discoveries.some(d => d.status === 'new'))) progress = true;
    }
  }
}

beforeEach(() => { window.localStorage.clear(); });

describe('the era lock (hard)', () => {
  it('opens the first era and closes the second on a new game', () => {
    const e = fresh();
    expect(e.isEraOpen('origins')).toBe(true);
    expect(e.isEraOpen('fire')).toBe(false);
    expect(e.isEraOpen('network')).toBe(false);
    expect(e.eraGate('origins')).toBeNull();
  });

  it('says what a closed era waits on, in numbers', () => {
    const e = fresh();
    const g = e.eraGate('fire')!;
    expect(g.blocker).toBe('origins');
    expect(g.blockerName).toBe('Origins');
    expect(g.required).toBe(8);
    expect(g.requiredDone).toBe(0);
    expect(g.message).toMatch(/0 \/ 8/);
    e.combine('stone', 'stone');
    expect(e.eraGate('fire')!.requiredDone).toBe(1);
    expect(e.eraGate('fire')!.message).toMatch(/7 major inventions/);
  });

  it('turns a right idea away early, and remembers the pair', () => {
    const e = fresh();
    const r = e.combine('wood', 'wood');            // fire — Fire & Culture is not open yet
    expect(r.status).toBe('era_locked');
    if (r.status === 'era_locked') {
      expect(r.gate.blocker).toBe('origins');
      expect(r.message).toMatch(/too early/i);
      expect(r.message).toMatch(/Remember this pair/);
    }
    expect(e.has('fire')).toBe(false);
    expect(e.found.size).toBe(db.primitives.length);
  });

  it('gives no clue in the refusal about what it is (the name of the locked discovery stays hidden)', () => {
    const e = fresh();
    const r = e.combine('wood', 'wood');
    if (r.status !== 'era_locked') throw new Error('expected a lock');
    expect(r.message).not.toContain('Fire');
    expect(r.message).not.toMatch(/\bfire\b/i);
  });

  it('opens the next era once every REQUIRED major of the last is found — and re-offers the pair', () => {
    const e = fresh();
    e.combine('wood', 'wood');                      // locked, remembered
    craft(e, 0);
    const p = e.eraProgress('origins');
    expect(p.required).toBe(8);
    expect(p.requiredDone).toBe(8);
    expect(p.complete).toBe(true);
    expect(e.isEraOpen('fire')).toBe(true);
    expect(e.combine('wood', 'wood').status).toBe('new');
    expect(e.has('fire')).toBe(true);
  });

  it('tells the completing craft that the era opened, and which pairs work now', () => {
    const e = fresh();
    e.combine('wood', 'wood');                      // too early: remembered as a pair to retry
    let opening: ReturnType<Engine['combineMany']> | null = null;
    // assemble by hand until the era opens, keeping the result of the craft that opened it
    let guard = 0;
    while (!e.isEraOpen('fire') && guard++ < 200) {
      for (const n of db.nodes) {
        if (e.has(n.id) || nodeEra(n.id) > 0 || !e.isRecipeUnlocked(n.id)) continue;
        const r = n.rec.find(rec => rec.every(i => e.holds(i)));
        if (!r) continue;
        const before = e.isEraOpen('fire');
        const res = e.combineMany(r);
        if (res.status === 'new' && !before && e.isEraOpen('fire')) opening = res;
      }
    }
    expect(e.isEraOpen('fire')).toBe(true);
    expect(opening).not.toBeNull();
    if (opening && opening.status === 'new') {
      expect(opening.major?.eraCompleted).toBe('origins');
      expect(opening.reopened.some(p => p.includes('wood'))).toBe(true);
    }
  });

  it('keeps later eras closed until each one in turn is finished', () => {
    const e = fresh();
    craft(e, 0);
    expect(e.isEraOpen('fire')).toBe(true);
    expect(e.isEraOpen('settlement')).toBe(false);
    expect(e.eraGate('settlement')!.blocker).toBe('fire');
    craft(e, 1);
    expect(e.eraProgress('fire').complete).toBe(true);
    expect(e.isEraOpen('settlement')).toBe(true);
    expect(e.isEraOpen('agriculture')).toBe(false);
  });

  it('never lets an optional or hidden major hold an era back', () => {
    const e = fresh();
    craft(e, 0);
    const p = e.eraProgress('origins');
    expect(p.optional + p.hidden + p.required).toBe(e.world.inEra.get('origins')!.length);
    // finished with some optional majors still to find
    expect(p.optionalDone).toBeLessThanOrEqual(p.optional);
    expect(p.complete).toBe(true);
  });

  it('refuses a way of working a piece into something of a closed era', () => {
    const e = fresh();
    craft(e, 0);
    // a way of working what is held that would make a discovery of an era that is still shut
    const shut = processingData.transforms.filter(t => e.holds(t.from) && t.out.some(o => {
      const n = db.nodes.find(x => x.id === o);
      return !!n && !e.isEraOpen(n.era);
    }));
    expect(shut.length).toBeGreaterThan(0);
    for (const t of shut) {
      const r = e.process(t.from, t.action);
      expect(r.status).not.toBe('done');
    }
  });

  it('can be waived for a teaching mode or a test, and the waiver is what an older save gets', () => {
    const e = fresh();
    e.waiveEraLock();
    for (const era of db.eras) expect(e.isEraOpen(era.id)).toBe(true);
    expect(e.combine('wood', 'wood').status).toBe('new');
  });
});

describe('world progress numbers', () => {
  it('counts what is found, what is required and what is still hidden', () => {
    const e = fresh();
    const s0 = e.worldSummary();
    expect(s0.found).toBe(0);
    expect(s0.total).toBe(e.world.size);
    expect(s0.requiredTotal).toBe(e.world.requiredTotal);
    expect(s0.hiddenLeft).toBeGreaterThan(0);
    e.combine('stone', 'stone');
    const s1 = e.worldSummary();
    expect(s1.found).toBe(1);
    expect(s1.requiredFound).toBe(1);
    expect(s1.regionsRepresented).toBe(1);
    expect(s1.regions.find(r => r.id === 'africa')!.found).toBe(1);
    expect(s1.regionsTotal).toBe(7);
  });

  it('gives every era its own percentage, closed or open', () => {
    const e = fresh();
    e.combine('stone', 'stone');
    const p = e.eraProgress('origins');
    expect(p.percent).toBe(Math.round((1 / 8) * 100));
    expect(p.open).toBe(true);
    expect(e.eraProgress('fire').open).toBe(false);
    expect(e.eraProgress('fire').percent).toBe(0);
  });

  it('lists the majors found in the order they were found', () => {
    const e = fresh();
    e.combine('stone', 'stone');             // sharp stone
    e.combine('stone', 'bone');              // stone flake
    expect(e.majorsFound().map(m => m.id)).toEqual(['sharp_stone', 'stone_flake']);
  });

  it('puts the focus on the era being finished, with the next one locked and the message to show', () => {
    const e = fresh();
    e.combine('stone', 'stone');
    const f = worldFocus(e);
    expect(f.current.era).toBe('origins');
    expect(f.next?.era).toBe('fire');
    expect(f.nextLocked).toBe(true);
    expect(f.lockMessage).toBe(LOCK_MESSAGE);
    expect(LOCK_MESSAGE).toBe('Complete all major world inventions from this era to advance.');
    craft(e, 0);
    const g = worldFocus(e);
    expect(g.current.era).toBe('fire');
    expect(g.nextLocked).toBe(true);
  });
});

describe('what the engine tells the interface', () => {
  it('announces the first major ever with no previous place', () => {
    const e = fresh();
    const r = e.combine('stone', 'stone');
    expect(r.status === 'new' && r.major?.id).toBe('sharp_stone');
    expect(e.peekWorldEvents()).toBe(1);
    expect(e.takeWorldEvents()).toEqual([{ kind: 'major', id: 'sharp_stone', tier: 'A', previousId: null, first: true }]);
    expect(e.peekWorldEvents()).toBe(0);
    expect(e.takeWorldEvents()).toEqual([]);
  });

  it('starts the next journey from the place of the one before', () => {
    const e = fresh();
    e.combine('stone', 'stone');
    e.takeWorldEvents();
    e.combine('stone', 'bone');
    const [ev] = e.takeWorldEvents();
    expect(ev).toMatchObject({ kind: 'major', id: 'stone_flake', previousId: 'sharp_stone', first: false });
  });

  it('says nothing about a discovery that is not a major invention', () => {
    const e = fresh();
    const r = e.combine('wood', 'fiber');             // Plant — a discovery, not a major
    expect(r.status).toBe('new');
    expect(r.status === 'new' && r.major).toBeFalsy();
    expect(e.peekWorldEvents()).toBe(0);
  });

  it('marks a major reached again by a new way as a quiet pulse (tier C), and a repeat of the same way as nothing', () => {
    const e = fresh();
    e.combine('stone', 'stone');
    e.combine('sharp_stone', 'stone');                 // stone flake, first route
    e.takeWorldEvents();
    const again = e.combine('stone', 'bone');          // stone flake, another route
    expect(again.status).toBe('known');
    expect(e.takeWorldEvents()).toEqual([{ kind: 'major', id: 'stone_flake', tier: 'C', previousId: null, first: false }]);
    e.combine('stone', 'bone');                        // the same way again
    expect(e.takeWorldEvents()).toEqual([]);
  });

  it('announces an era complete exactly once, right after the invention that completes it', () => {
    const e = fresh();
    craft(e, 0);
    const evs = e.takeWorldEvents();
    const complete = evs.filter(x => x.kind === 'era_complete');
    expect(complete).toEqual([{ kind: 'era_complete', era: 'origins', next: 'fire' }]);
    const at = evs.findIndex(x => x.kind === 'era_complete');
    // the event just before it is the required major that finished the set
    const last = evs[at - 1];
    if (!last || last.kind !== 'major') throw new Error('the era was not announced right after a major');
    expect(e.world.required.get('origins')).toContain(last.id);
    expect(e.isEraCelebrated('origins')).toBe(true);
    // finding more of the same era later does not celebrate it again
    craft(e, 0);
    expect(e.takeWorldEvents().filter(x => x.kind === 'era_complete')).toHaveLength(0);
  });

  it('never announces an era on an optional major, even one found after the era was finished', () => {
    const e = fresh();
    // Civilisation has optional majors beside its required ones: stop the moment it completes, then go on
    craft(e, 4, () => e.eraProgress('civilization').complete);
    const done = e.eraProgress('civilization');
    expect(done.complete).toBe(true);
    expect(done.optionalDone + done.hiddenDone).toBeLessThan(done.optional + done.hidden);
    expect(e.takeWorldEvents().filter(x => x.kind === 'era_complete').map(x => x.kind === 'era_complete' && x.era)).toContain('civilization');
    craft(e, 4);
    const later = e.takeWorldEvents();
    // the rest of the era's optional majors: announced as majors, never as another era
    expect(later.some(x => x.kind === 'major')).toBe(true);
    expect(later.some(x => x.kind === 'era_complete' && x.era === 'civilization')).toBe(false);
  });

  it('a reset forgets it all: events, the seen set, the celebration and the lock', () => {
    const e = fresh();
    craft(e, 0);
    e.markMajorSeen('sharp_stone');
    expect(e.isEraOpen('fire')).toBe(true);
    e.reset();
    expect(e.peekWorldEvents()).toBe(0);
    expect(e.hasSeenMajor('sharp_stone')).toBe(false);
    expect(e.isEraCelebrated('origins')).toBe(false);
    expect(e.isEraOpen('fire')).toBe(false);
    expect(e.majorsFound()).toEqual([]);
  });

  it('marks a reveal as seen once, and only for a real major', () => {
    const e = fresh();
    e.combine('stone', 'stone');
    const seen = jest.fn();
    e.subscribe(seen);
    e.markMajorSeen('sharp_stone');
    expect(e.hasSeenMajor('sharp_stone')).toBe(true);
    const n = seen.mock.calls.length;
    e.markMajorSeen('sharp_stone');                    // again: nothing
    e.markMajorSeen('plant');                          // not a major: nothing
    expect(seen.mock.calls.length).toBe(n);
    expect(e.hasSeenMajor('plant')).toBe(false);
  });
});

describe('saving and loading the world', () => {
  const reload = () => { const e2 = fresh(); expect(e2.load()).toBe(true); return e2; };

  it('round-trips what was seen, what was celebrated and how far the lock has opened', () => {
    const e = fresh();
    craft(e, 0);
    e.markMajorSeen('sharp_stone');
    e.save();
    const raw = JSON.parse(window.localStorage.getItem('evo.sandbox.v1')!);
    expect(raw.world.seen).toContain('sharp_stone');
    expect(raw.world.celebrated).toContain('origins');
    expect(raw.world.floor).toBe(0);
    const e2 = reload();
    expect(e2.hasSeenMajor('sharp_stone')).toBe(true);
    expect(e2.isEraCelebrated('origins')).toBe(true);
    expect(e2.isEraOpen('fire')).toBe(true);            // by the required set, not by a floor
    expect(e2.isEraOpen('settlement')).toBe(false);
    expect(e2.peekWorldEvents()).toBe(0);               // nothing replays on load
  });

  it('a save mid-era loads mid-era, still locked', () => {
    const e = fresh();
    e.combine('stone', 'stone');
    e.save();
    const e2 = reload();
    expect(e2.isEraOpen('fire')).toBe(false);
    expect(e2.eraProgress('origins').requiredDone).toBe(1);
  });

  it('never locks a player of an older save out of ground already stood on', () => {
    // a save made before the world existed: it holds things far down the timeline, and has no `world` block
    const e = fresh();
    e.waiveEraLock();
    craft(e, 4);
    e.save();
    const raw = JSON.parse(window.localStorage.getItem('evo.sandbox.v1')!);
    delete raw.world;
    window.localStorage.setItem('evo.sandbox.v1', JSON.stringify(raw));

    const e2 = reload();
    for (let i = 0; i <= 4; i++) expect(e2.isEraOpen(db.eras[i].id)).toBe(true);
    // everything held is treated as already seen, so no cinematic replays for what was done long ago
    expect(e2.majorsFound().every(m => e2.hasSeenMajor(m.id))).toBe(true);
    expect(e2.peekWorldEvents()).toBe(0);
    // eras this save had already finished are not celebrated a second time
    for (const p of db.eras.slice(0, 4)) {
      if ((e2.world.required.get(p.id)?.length ?? 0) > 0 && e2.eraProgress(p.id).complete) expect(e2.isEraCelebrated(p.id)).toBe(true);
    }
  });

  it('a save of the era just past the floor keeps the floor honest, and the next era stays closed', () => {
    const e = fresh();
    e.waiveEraLock();
    craft(e, 2);
    e.save();
    const raw = JSON.parse(window.localStorage.getItem('evo.sandbox.v1')!);
    delete raw.world;
    window.localStorage.setItem('evo.sandbox.v1', JSON.stringify(raw));
    const e2 = reload();
    // the floor is the furthest era held: the era after it opens only by the rule
    const furthest = Math.max(...[...e2.found].map(id => nodeEra(id)));
    expect(e2.isEraOpen(db.eras[furthest].id)).toBe(true);
    if (furthest + 1 < db.eras.length && !e2.eraProgress(db.eras[furthest].id).complete) {
      expect(e2.isEraOpen(db.eras[furthest + 1].id)).toBe(false);
    }
  });

  it('survives a damaged world block: unknown ids and eras are dropped, a bad floor becomes zero', () => {
    const e = fresh();
    e.combine('stone', 'stone');
    e.save();
    const raw = JSON.parse(window.localStorage.getItem('evo.sandbox.v1')!);
    raw.world = { seen: ['sharp_stone', 'not_a_thing', 42], celebrated: ['origins', 'nowhere'], floor: 'x' };
    window.localStorage.setItem('evo.sandbox.v1', JSON.stringify(raw));
    const e2 = reload();
    expect(e2.hasSeenMajor('sharp_stone')).toBe(true);
    expect(e2.hasSeenMajor('not_a_thing')).toBe(false);
    expect(e2.isEraCelebrated('nowhere' as never)).toBe(false);
    expect(e2.isEraOpen('fire')).toBe(false);
  });

  it('clamps a floor that is out of range', () => {
    const e = fresh();
    e.combine('stone', 'stone');
    e.save();
    const raw = JSON.parse(window.localStorage.getItem('evo.sandbox.v1')!);
    raw.world = { seen: [], celebrated: [], floor: 9999 };
    window.localStorage.setItem('evo.sandbox.v1', JSON.stringify(raw));
    const e2 = reload();
    expect(e2.isEraOpen(db.eras[db.eras.length - 1].id)).toBe(true);
    raw.world.floor = -5;
    window.localStorage.setItem('evo.sandbox.v1', JSON.stringify(raw));
    expect(reload().isEraOpen('fire')).toBe(false);
  });

  it('a waiver is written with the next save, so a teaching game reloads as it was', () => {
    const e = fresh();
    e.waiveEraLock();
    e.combine('stone', 'stone');
    e.save();
    expect(reload().isEraOpen('network')).toBe(true);
  });
});
