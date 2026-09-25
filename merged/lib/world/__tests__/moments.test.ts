import { Engine } from '@/lib/engine';
import { playDb } from '@/lib/processing';
import { buildPlan } from '../choreography';
import { eraMoment, inspectMoment, majorMoment, type EraPayload, type MajorPayload, type MomentEnv } from '../moments';
import type { Playback } from '../prefs';

const fresh = () => new Engine(playDb);
const env = (pb: Partial<Playback> = {}, narrow = false): MomentEnv => ({
  playback: () => ({ enabled: true, motion: 'full', shorten: false, ...pb }),
  quality: () => 'high',
  narrow: () => narrow,
});

function firstMajorEvent(e: Engine) {
  e.combine('stone', 'stone');
  const [ev] = e.takeWorldEvents();
  if (ev.kind !== 'major') throw new Error('expected a major');
  return ev;
}

describe('majorMoment', () => {
  it('carries the words for the card: the major, where it stands among the majors, and the era it belongs to', () => {
    const e = fresh();
    const m = majorMoment(e, firstMajorEvent(e), env())!;
    const p = m.payload as MajorPayload;
    expect(p.kind).toBe('major');
    expect(p.major.id).toBe('sharp_stone');
    expect(p.first).toBe(true);
    expect(p.previous).toBeNull();
    expect(p.inspect).toBe(false);
    expect(p.registered).toBe(1);
    expect(p.total).toBe(e.world.size);
    expect(p.eraRequired).toEqual({ done: 1, required: 8, eraName: 'Origins' });
    expect(p.foundBefore).toEqual([]);
  });

  it('plays the very first major as the full journey from a neutral world, whatever the settings', () => {
    const e = fresh();
    const m = majorMoment(e, firstMajorEvent(e), env({ shorten: true }))!;
    const plan = buildPlan(m.build(3));               // even with a backlog
    expect(plan.input.kind === 'major' && plan.input.tier).toBe('A');
    expect(plan.input.kind === 'major' && plan.input.from).toBeNull();
  });

  it('leaves from the previous major and lands on the new one', () => {
    const e = fresh();
    e.combine('stone', 'stone'); e.takeWorldEvents();
    e.combine('stone', 'bone');
    const [ev] = e.takeWorldEvents();
    if (ev.kind !== 'major') throw new Error();
    const m = majorMoment(e, ev, env())!;
    const p = m.payload as MajorPayload;
    expect(p.previous?.id).toBe('sharp_stone');
    expect(p.registered).toBe(2);
    expect(p.foundBefore.map(x => x.id)).toEqual(['sharp_stone']);
    const inp = m.build(0);
    if (inp.kind !== 'major') throw new Error();
    expect(inp.from).toMatchObject({ lat: p.previous!.lat, lon: p.previous!.lon });
    expect(inp.to).toMatchObject({ lat: p.major.lat, lon: p.major.lon, precision: p.major.precision });
  });

  it('turns into the shorter reveal when there is a backlog or the visitor chose quick, but not otherwise', () => {
    const e = fresh();
    e.combine('stone', 'stone'); e.takeWorldEvents();
    e.combine('stone', 'bone');
    const [ev] = e.takeWorldEvents();
    if (ev.kind !== 'major') throw new Error();
    const tierOf = (backlog: number, pb: Partial<Playback>) => {
      const inp = majorMoment(e, ev, env(pb))!.build(backlog);
      return inp.kind === 'major' ? inp.tier : null;
    };
    expect(tierOf(0, {})).toBe(ev.tier === 'B' ? 'B' : 'A');
    expect(tierOf(2, {})).toBe('B');
    expect(tierOf(0, { shorten: true })).toBe('B');
  });

  it('reads the visitor\'s settings when the moment starts, not when it was queued', () => {
    const e = fresh();
    let motion: Playback['motion'] = 'full';
    const m = majorMoment(e, firstMajorEvent(e), { ...env(), playback: () => ({ enabled: true, motion, shorten: false }) })!;
    motion = 'reduced';
    const inp = m.build(0);
    expect(inp.motion).toBe('reduced');
  });

  it('passes the other early centres of a multiple-origin invention on to the camera', () => {
    const e = fresh();
    e.waiveEraLock();
    e.combine('wood', 'fiber');
    // agriculture has several centres in the catalogue
    const agri = e.world.get('agriculture')!;
    expect(agri.alsoAt?.length).toBeGreaterThan(0);
    const m = majorMoment(e, { kind: 'major', id: 'agriculture', tier: 'A', previousId: null, first: false }, env())!;
    const inp = m.build(0);
    expect(inp.kind === 'major' && inp.others?.length).toBe(agri.alsoAt!.length);
  });

  it('is nothing at all for a quiet repeat (tier C) or for something that is not a major', () => {
    const e = fresh();
    expect(majorMoment(e, { kind: 'major', id: 'sharp_stone', tier: 'C', previousId: null, first: false }, env())).toBeNull();
    expect(majorMoment(e, { kind: 'major', id: 'plant', tier: 'A', previousId: null, first: false }, env())).toBeNull();
  });

  it('gives every moment its own id', () => {
    const e = fresh();
    const ev = firstMajorEvent(e);
    expect(majorMoment(e, ev, env())!.id).not.toBe(majorMoment(e, ev, env())!.id);
  });
});

describe('inspectMoment (World Origins → Watch again)', () => {
  it('is the lighter form: no arc, marked as an inspect, and never for something not yet found', () => {
    const e = fresh();
    e.combine('stone', 'stone'); e.takeWorldEvents();
    expect(inspectMoment(e, 'stone_flake', env())).toBeNull();     // not found yet
    expect(inspectMoment(e, 'plant', env())).toBeNull();           // not a major
    const m = inspectMoment(e, 'sharp_stone', env())!;
    const p = m.payload as MajorPayload;
    expect(p.inspect).toBe(true);
    expect(p.tier).toBe('B');
    const plan = buildPlan(m.build(0));
    expect(plan.arcOn).toBe(false);
  });

  it('still shows a gentle version to a visitor who turned the globe off', () => {
    const e = fresh();
    e.combine('stone', 'stone');
    const inp = inspectMoment(e, 'sharp_stone', env({ enabled: false, motion: 'reduced', shorten: true }))!.build(0);
    expect(inp.motion).toBe('reduced');
  });
});

describe('eraMoment', () => {
  it('carries the era, the next era to unlock and the places that lit up', () => {
    const e = fresh();
    let done = false;
    // play the era out
    const ev = (() => {
      let guard = 0;
      while (!done && guard++ < 300) {
        for (const n of playDb.nodes) {
          if (e.has(n.id) || n.era !== 'origins' || !e.isRecipeUnlocked(n.id)) continue;
          const r = n.rec.find(rec => rec.every(i => e.holds(i)));
          if (r) e.combineMany(r);
        }
        if (e.eraProgress('origins').complete) done = true;
      }
      return e.takeWorldEvents().find(x => x.kind === 'era_complete');
    })();
    if (!ev || ev.kind !== 'era_complete') throw new Error('era did not complete');
    const m = eraMoment(e, ev, env());
    const p = m.payload as EraPayload;
    expect(p.kind).toBe('era');
    expect(p.era).toBe('origins');
    expect(p.eraName).toBe('Origins');
    expect(p.next).toEqual({ id: 'fire', name: 'Fire & Culture' });
    expect(p.required).toBe(8);
    expect(p.points.length).toBeGreaterThanOrEqual(8);
    expect(p.regionsRepresented).toBeGreaterThanOrEqual(1);
    const inp = m.build(0);
    if (inp.kind !== 'era') throw new Error();
    expect(inp.points.length).toBe(p.points.filter(x => x.precision !== 'unlocated').length);
  });

  it('marks the payload flat when the visitor turned the globe off, so the card can stand alone', () => {
    const e = fresh();
    const m = eraMoment(e, { kind: 'era_complete', era: 'origins', next: 'fire' }, env({ enabled: false }));
    m.build(0);
    expect((m.payload as EraPayload).flat).toBe(true);
  });

  it('ends the story cleanly at the last era: no next era to unlock', () => {
    const e = fresh();
    const last = playDb.eras[playDb.eras.length - 1].id;
    const m = eraMoment(e, { kind: 'era_complete', era: last, next: null }, env());
    expect((m.payload as EraPayload).next).toBeNull();
  });
});
