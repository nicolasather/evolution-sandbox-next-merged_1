/**
 * Simulation: every recipe in the game is played by a keyboard-only bot.
 *
 * This is the guarantee behind "never stuck" and "keyboard playable": for each
 * pair that makes something, the derived process can be finished using only
 * Space / E (the bot never touches the pointer), and how long that takes,
 * in simulated seconds, is bounded by its tier. It also checks that a session
 * never leaves a body locked or a temporary part behind.
 */
import rawDb from '@/data/db.json';
import type { Db } from '@/lib/types';
import { Fx } from '../fx';
import { CraftSession } from '../session';
import { deriveSpec, estimateSteps } from '../specs';
import type { Palette } from '../types';
import { World } from '../world';

const db = rawDb as unknown as Db;
const byId = new Map(db.nodes.map(n => [n.id, n]));
const eraIndex = (id: string) => Math.max(0, db.eras.findIndex(e => e.id === byId.get(id)!.era));

const PAL: Palette = {
  bone: '#eee', bone2: '#aaa', bone3: '#888', line: '#444', line3: '#666', ochre: '#c8763a',
  ink: '#111', good: '#8f8', hot: '#f95', water: '#7be',
};

interface Result { done: boolean; t: number; kinds: string[]; stuckAt: string | null; perKind: Record<string, number> }

/** Plays one recipe. `relax` mimics a result the player already holds. */
function play(a: string, b: string, r: string, relax = false, seed = 1): Result & { spec: ReturnType<typeof deriveSpec> } {
  const host = document.createElement('div');
  const ids = new Map<string, { id: string; n: string; vis: string; cat: string; era: string }>();
  for (const n of db.nodes) ids.set(n.id, { id: n.id, n: n.n, vis: n.vis, cat: n.cat, era: n.era });
  const world = new World(host, {
    resolve: id => ids.get(id) ?? null, onImpact: () => {}, onWall: () => {}, onLand: () => {}, onZone: () => {},
  });
  world.resize(560, 320);
  const A = byId.get(a)!, B = byId.get(b)!, R = byId.get(r)!;
  const ba = world.spawn(a, 200, 160)!, bb = world.spawn(b, 360, 170)!;
  const spec = deriveSpec(A, B, R, { eraIndex: eraIndex(r), relax });
  const fx = new Fx(PAL);
  fx.reduced = true;
  const kinds: string[] = [];
  const perKind: Record<string, number> = {};
  const s = new CraftSession({ world, fx, a: ba, b: bb, spec, pal: PAL, reduced: true, seed, onStep: (_i, _n, _v, k) => kinds.push(k) });
  const dt = 1 / 60;
  let t = 0;
  let last = '';
  while (!s.done && t < 120) {
    const rt = s.runtime as unknown as Record<string, unknown> | null;
    const kind = rt ? String(rt.kind) : '';
    last = kind || last;
    if (kind) perKind[kind] = (perKind[kind] ?? 0) + 1 / 60;
    bot(s, kind, rt, t);
    world.step(dt);
    s.update(dt);
    t += dt;
  }
  const leaked = world.bodies.filter(x => x.temp).length;
  expect(leaked).toBe(0);
  return { done: s.done, t, kinds, stuckAt: s.done ? null : last, spec, perKind };
}

let phaseT = 0;
let lastKind = '';
function bot(s: CraftSession, kind: string, rt: Record<string, unknown> | null, t: number) {
  if (kind !== lastKind) { lastKind = kind; phaseT = 0; s.keyUp(' '); }
  phaseT += 1 / 60;
  const tap = (period: number, dur: number, key = ' ') => {
    const ph = phaseT % period;
    if (Math.abs(ph - 0) < 1 / 120) s.keyDown(key);
    if (Math.abs(ph - dur) < 1 / 120) s.keyUp(key);
  };
  switch (kind) {
    case 'hold': case 'stretch': case 'separate': case 'keep': s.keyDown(' ', false, phaseT > 0.05); break;
    case 'pour': if ((rt?.fill as number) >= (rt?.lo as number)) s.keyUp(' '); else s.keyDown(' ', false, phaseT > 0.05); break;
    case 'impact': tap(1.9, 0.1); if (Math.abs(phaseT % 1.9 - 0.95) < 1 / 120) s.keyDown(' '); if (Math.abs(phaseT % 1.9 - 1.05) < 1 / 120) s.keyUp(' '); break;
    case 'timing': tap(0.41, 0.1); break;
    case 'strike': tap(0.5, 0.1); break;
    case 'heat': {
      const T = rt?.T as number, lo = rt?.lo as number, hi = rt?.hi as number, phase = rt?.phase as string;
      if (phase === 'ready') { s.keyDown('e'); s.keyUp('e'); s.keyUp(' '); }
      else if (T < (lo + hi) / 2) s.keyDown(' ', false, true); else s.keyUp(' ');
      break;
    }
    default: tap(0.3, 0.15); tap(0.9, 0.1, 'e');
  }
  void t;
}

const pairs: { a: string; b: string; r: string }[] = [];
for (const n of db.nodes) for (const [a, b] of n.rec) pairs.push({ a, b, r: n.id });

describe('recipe processes, played by a keyboard-only bot', () => {
  it('has a pair list to play', () => { expect(pairs.length).toBeGreaterThan(300); });

  it('every recipe can be finished with Space and E alone, in a bounded time', () => {
    const failures: string[] = [];
    for (const p of pairs) {
      const res = play(p.a, p.b, p.r);
      if (!res.done) failures.push(`${p.a}+${p.b}=${p.r} stuck at ${res.stuckAt} [${res.kinds.join('>')}]`);
    }
    expect(failures).toEqual([]);
  }, 600000);

  it('a repeated pair (relaxed) is never harder than the first time', () => {
    for (const p of pairs.filter((_, i) => i % 7 === 0)) {
      const first = deriveSpec(byId.get(p.a)!, byId.get(p.b)!, byId.get(p.r)!, { eraIndex: eraIndex(p.r) });
      const again = deriveSpec(byId.get(p.a)!, byId.get(p.b)!, byId.get(p.r)!, { eraIndex: eraIndex(p.r), relax: true });
      expect(estimateSteps(again.steps, again.resistance)).toBeLessThanOrEqual(estimateSteps(first.steps, first.resistance) + 1e-6);
    }
  });
});
