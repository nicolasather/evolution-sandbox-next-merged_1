import rawDb from '@/data/db.json';
import { Engine, HINT_TRIES, pairKey } from '@/lib/engine';
import type { Db } from '@/lib/types';

const db = rawDb as unknown as Db;
const fresh = () => new Engine(db);

describe('recipe data', () => {
  it('maps every unordered pair to exactly one result', () => {
    const seen = new Map<string, string>();
    for (const n of db.nodes) for (const [a, b] of n.rec) {
      const k = pairKey(a, b);
      expect(seen.get(k) ?? n.id).toBe(n.id);
      seen.set(k, n.id);
    }
  });

  it('can be played to 100% from the four raw materials, tier gates included', () => {
    const e = fresh();
    let progress = true;
    while (progress) {
      progress = false;
      for (const n of db.nodes) {
        if (e.has(n.id) || !e.isRecipeUnlocked(n.id)) continue;
        const r = n.rec.find(([a, b]) => e.has(a) && e.has(b));
        if (r && e.combine(r[0], r[1]).status === 'new') progress = true;
      }
    }
    expect(e.found.size).toBe(db.nodes.length);
  });

  it('gives nearly every entry more than one route', () => {
    const multi = db.nodes.filter(n => n.rec.length > 1).length;
    expect(multi / db.nodes.length).toBeGreaterThan(0.9);
  });
});

describe('combining', () => {
  it('discovers on the first try of the onboarding pair', () => {
    const e = fresh();
    const r = e.combine('stone', 'stone');
    expect(r.status).toBe('new');
    expect(e.coached).toBe(2);
  });

  it('never names an undiscovered entry in failure feedback', () => {
    const e = fresh();
    const r = e.combine('stone', 'fiber');   // makes Cutting — a success
    expect(r.status).toBe('new');
    const f = e.combine('bone', 'cutting');
    if (f.status !== 'fail') return;          // (a success is fine too)
    const hidden = db.nodes.filter(n => !e.has(n.id)).map(n => n.n);
    for (const name of hidden) expect(`${f.message} ${f.nudge}`).not.toContain(name);
  });

  it('records a second route to something already known', () => {
    const e = fresh();
    e.combine('stone', 'stone');                       // sharp stone
    const a = e.combine('sharp_stone', 'stone');       // stone flake, route 1
    const b = e.combine('stone', 'bone');              // stone flake, route 2
    expect(a.status).toBe('new');
    expect(b.status).toBe('known');
    if (b.status === 'known') {
      expect(b.newRoute).toBe(true);
      expect(b.routes.found).toBe(2);
    }
  });

  it('says a repeated failed pair was tried before', () => {
    const e = fresh();
    e.combine('stone', 'stone');
    const pair: [string, string] = ['sharp_stone', 'fiber'];
    const first = e.combine(...pair);
    if (first.status !== 'fail') return;
    const again = e.combine(...pair);
    expect(again.status === 'fail' && again.repeat).toBe(true);
  });
});

describe('hints', () => {
  it('escalate only after more tries, and never name both ingredients', () => {
    const e = fresh();
    e.combine('stone', 'stone');
    const h1 = e.requestHint();
    expect('error' in h1).toBe(false);
    if ('error' in h1) return;
    expect(h1.level).toBe(1);
    // asking again at once does not escalate
    const again = e.requestHint();
    expect('error' in again ? 0 : again.level).toBe(1);
    // try a few pairs that do not solve it
    let tries = 0;
    for (const [a, b] of [['bone', 'bone'], ['wood', 'fiber'], ['fiber', 'fiber'], ['wood', 'wood']] as const) {
      if (tries >= HINT_TRIES) break;
      const r = e.combine(a, b);
      if (!(r.status === 'new' && r.node.id === h1.targetId)) tries++;
      if (!e.hintView().targetId) break;
    }
    const view = e.hintView();
    if (!view.targetId) return; // solved along the way
    const h2 = e.requestHint();
    if ('error' in h2) throw new Error(h2.error);
    expect(h2.level).toBe(2);
    const target = e.get(h2.targetId!)!;
    expect(h2.text).not.toContain(target.n);
  });

  it('refuses to aim at something out of reach', () => {
    const e = fresh();
    const r = e.requestHint('grand_theft_auto_vi');
    expect('error' in r).toBe(true);
  });
});

describe('search', () => {
  it('counts undiscovered matches without naming them', () => {
    const e = fresh();
    const r = e.search('fire');
    expect(r.hits.every(n => e.has(n.id))).toBe(true);
    expect(r.hiddenMatches).toBeGreaterThan(0);
  });
});
