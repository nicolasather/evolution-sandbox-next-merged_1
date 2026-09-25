import { readFileSync } from 'fs';
import { join } from 'path';
import { ERA_ORDER, QUESTIONS, askable } from '../knowledge';
import { DROP_MS, EXPLAIN_MS, FIRST_MS, FLOOR_MS, FOLD_MS, GAP_MAX_MS, RETRY_MS, WRONG_FADE_MS, Tutor, maxDifficulty, nextGap, pick, type TutorContext } from '../tutor';
import { TECH_BY_ID } from '../../processing/techniques';

const sources = JSON.parse(readFileSync(join(__dirname, '../../../data/sources.json'), 'utf8')).sources as Record<string, { scope: string }>;
const ctx = (over: Partial<TutorContext> = {}): TutorContext => ({ eraIndex: 5, discoveries: 30, busy: false, knows: () => false, ...over });
let seed = 7;
const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

describe('knowledge base', () => {
  it('every question is well-formed, sourced and honest about its confidence', () => {
    const ids = new Set<string>();
    for (const q of QUESTIONS) {
      expect(ids.has(q.id)).toBe(false); ids.add(q.id);
      expect(ERA_ORDER).toContain(q.era);
      expect(q.answers.length).toBeGreaterThanOrEqual(3);
      expect(new Set(q.answers).size).toBe(q.answers.length);
      expect(q.answers).toContain(q.correctAnswer);
      expect(q.explanation.length).toBeGreaterThan(30);
      expect(q.source.length).toBeGreaterThan(0);
      // every cited source exists, and at least one speaks to the topic
      q.source.forEach(s => expect(sources[s]).toBeDefined());
      expect(q.source.some(s => sources[s].scope === 'topic')).toBe(true);
      if (q.confidence !== 'high') expect(q.uncertainty).toBeTruthy();
      if (q.range) expect(q.range[0]).toBeLessThanOrEqual(q.range[1]);
      if (q.teaches) expect(TECH_BY_ID[q.teaches]).toBeDefined();
      // no invented speech
      expect(q.question + q.explanation).not.toMatch(/[“"][^”"]{12,}[”"] (said|wrote|declared)/);
    }
  });
  it('asks only what was read against its source; anything held says why', () => {
    for (const q of QUESTIONS) {
      if (q.hold) { expect(q.hold.length).toBeGreaterThan(20); expect(askable(q)).toBe(false); }
      else { expect(q.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/); expect(askable(q)).toBe(true); }
    }
    expect(QUESTIONS.filter(askable).length).toBeGreaterThanOrEqual(30);
  });
  it('covers every era from the first to industry and beyond, at every difficulty', () => {
    const QS = QUESTIONS.filter(askable);
    expect(new Set(QS.map(q => q.difficulty))).toEqual(new Set([1, 2, 3]));
    for (const e of ['origins', 'fire', 'agriculture', 'civilization', 'trade', 'science', 'industry', 'electric', 'computing', 'network']) {
      expect(QS.some(q => q.era === e)).toBe(true);
    }
  });
});

describe('scheduling', () => {
  it('waits about a minute for the first question, then a 60–120 s gap, never under 45 s', () => {
    for (let i = 0; i < 200; i++) { const g = nextGap(rng); expect(g).toBeGreaterThanOrEqual(FLOOR_MS); expect(g).toBeLessThanOrEqual(GAP_MAX_MS); }
    const t = new Tutor(rng, 0);
    t.tick(FIRST_MS - 1, ctx()); expect(t.phase).toBe('idle');
    t.tick(FIRST_MS, ctx()); expect(t.phase).toBe('open');
  });
  it('does not interrupt: waits while something else has the player', () => {
    const t = new Tutor(rng, 0);
    t.tick(FIRST_MS, ctx({ busy: true })); expect(t.phase).toBe('idle');
    t.tick(FIRST_MS + 3_999, ctx()); expect(t.phase).toBe('idle');
    t.tick(FIRST_MS + 4_000, ctx()); expect(t.phase).toBe('open');
  });
  it('folds to "?" when ignored, then slips away, then comes back later', () => {
    const t = new Tutor(rng, 0);
    t.tick(FIRST_MS, ctx()); const q = t.shown!.q.id;
    t.tick(FIRST_MS + FOLD_MS, ctx()); expect(t.phase).toBe('folded');
    t.expand(FIRST_MS + FOLD_MS + 10); expect(t.phase).toBe('open');
    t.tick(FIRST_MS + 2 * FOLD_MS + 10, ctx()); expect(t.phase).toBe('folded');
    t.tick(FIRST_MS + 2 * FOLD_MS + 10 + DROP_MS, ctx()); expect(t.phase).toBe('idle');
    expect(t.shown).toBeNull();
    expect(q).toBeTruthy();
  });
  it('scales difficulty with progress and respects the era reached', () => {
    expect(maxDifficulty(3)).toBe(1); expect(maxDifficulty(20)).toBe(2); expect(maxDifficulty(80)).toBe(3);
    for (let i = 0; i < 50; i++) {
      const q = pick(QUESTIONS, ctx({ eraIndex: 1, discoveries: 3 }), new Set(), [], rng)!;
      expect(q.difficulty).toBe(1); expect(ERA_ORDER.indexOf(q.era)).toBeLessThanOrEqual(1);
    }
  });
});

describe('answers', () => {
  it('a wrong answer fades neutrally and a different question follows soon; no score exists', () => {
    const t = new Tutor(rng, 0);
    t.tick(FIRST_MS, ctx());
    const first = t.shown!.q;
    const w = t.shown!.order.find(a => a !== first.correctAnswer)!;
    const at = FIRST_MS + 1000;
    expect(t.answer(w, at, ctx(), () => true)).toBe('wrong');
    expect(t.phase).toBe('wrong');
    // the card fades, then goes; a different question follows in seconds, not minutes
    t.tick(at + WRONG_FADE_MS, ctx()); expect(t.phase).toBe('idle');
    t.tick(at + WRONG_FADE_MS + RETRY_MS, ctx()); expect(t.phase).toBe('open');
    expect(t.shown!.q.id).not.toBe(first.id);
    expect(Object.keys(t)).not.toEqual(expect.arrayContaining(['score', 'xp', 'streak']));
  });
  it('after two misses in a row the usual gap applies', () => {
    const t = new Tutor(rng, 0);
    let now = FIRST_MS;
    for (let i = 0; i < 2; i++) {
      t.tick(now, ctx()); expect(t.phase).toBe('open');
      const q = t.shown!.q; t.answer(t.shown!.order.find(a => a !== q.correctAnswer)!, now, ctx(), () => true);
      now += WRONG_FADE_MS; t.tick(now, ctx());
      if (i === 0) now += RETRY_MS;
    }
    t.tick(now + RETRY_MS, ctx()); expect(t.phase).toBe('idle');
    t.tick(now + GAP_MAX_MS, ctx()); expect(t.phase).toBe('open');
  });
  it('a right answer explains, may teach a technique it offers, and is not asked again', () => {
    const pool = QUESTIONS.filter(q => q.id === 'q_flint_edge');
    const t = new Tutor(rng, 0, pool);
    t.tick(FIRST_MS, ctx({ eraIndex: 0, discoveries: 1 }));
    const taught: string[] = [];
    expect(t.answer('By striking a stone core with a hammerstone', FIRST_MS + 500, ctx(), a => { taught.push(a); return true; })).toBe('right');
    expect(taught).toEqual(['scrape']);
    expect(t.phase).toBe('right'); expect(t.shown!.taught).toBe('scrape');
    t.tick(FIRST_MS + 500 + EXPLAIN_MS, ctx());
    expect(t.phase).toBe('idle');
    t.tick(FIRST_MS + 500 + EXPLAIN_MS + GAP_MAX_MS, ctx({ eraIndex: 0, discoveries: 1 }));
    expect(t.phase).toBe('idle'); // nothing left to ask
  });
  it('does not "teach" what the player already has', () => {
    const pool = QUESTIONS.filter(q => q.id === 'q_flint_edge');
    const t = new Tutor(rng, 0, pool);
    t.tick(FIRST_MS, ctx({ eraIndex: 0, discoveries: 1 }));
    const teach = jest.fn(() => true);
    t.answer('By striking a stone core with a hammerstone', FIRST_MS + 1, ctx({ knows: () => true }), teach);
    expect(teach).not.toHaveBeenCalled();
  });
});
