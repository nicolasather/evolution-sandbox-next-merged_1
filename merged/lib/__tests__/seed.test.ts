import { createRng, dailyKey, dailyRng, hashString, weeklyKey, weeklyRng } from '@/lib/seed';

describe('seed service', () => {
  it('the same seed always produces the same sequence', () => {
    const a = createRng('todays-find|2026-09-28');
    const b = createRng('todays-find|2026-09-28');
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('different seeds diverge', () => {
    const a = createRng('site-alpha');
    const b = createRng('site-beta');
    expect(a.next()).not.toBe(b.next());
  });

  it('a numeric seed and its equivalent hashed string agree', () => {
    const seed = hashString('archive-k17');
    const a = createRng(seed);
    const b = createRng('archive-k17');
    expect(a.next()).toBe(b.next());
  });

  it('int() stays within [min, max] inclusive, both orders', () => {
    const r = createRng('bounds-check');
    for (let i = 0; i < 500; i++) {
      const v = r.int(3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
    }
    expect(r.int(9, 4)).toBeGreaterThanOrEqual(4);
  });

  it('pick() only ever returns a member of the array', () => {
    const r = createRng('pick-check');
    const items = ['a', 'b', 'c', 'd'];
    for (let i = 0; i < 50; i++) expect(items).toContain(r.pick(items));
  });

  it('pick() on an empty array throws rather than returning undefined', () => {
    expect(() => createRng('x').pick([])).toThrow();
  });

  it('shuffle() is a permutation and never mutates the input', () => {
    const r = createRng('shuffle-check');
    const items = [1, 2, 3, 4, 5];
    const copy = items.slice();
    const shuffled = r.shuffle(items);
    expect(items).toEqual(copy);
    expect(shuffled.slice().sort()).toEqual(items.slice().sort());
  });

  it('dailyKey is a stable UTC calendar key', () => {
    expect(dailyKey(new Date('2026-09-28T23:59:00Z'))).toBe('2026-09-28');
    expect(dailyKey(new Date('2026-09-28T00:00:00Z'))).toBe('2026-09-28');
  });

  it('weeklyKey follows ISO week numbering', () => {
    // 2026-09-28 is a Monday; confirm the format and that it is stable within the week.
    const mon = weeklyKey(new Date('2026-09-28T00:00:00Z'));
    const sun = weeklyKey(new Date('2026-10-04T23:00:00Z'));
    expect(mon).toMatch(/^\d{4}-W\d{2}$/);
    expect(mon).toBe(sun);
  });

  it('dailyRng namespaces by family so two daily features never share a sequence', () => {
    const date = new Date('2026-09-28T00:00:00Z');
    const a = dailyRng('todays-find', date);
    const b = dailyRng('minimum-path', date);
    expect(a.next()).not.toBe(b.next());
  });

  it('dailyRng/weeklyRng are stable for the same day/week and change on the next one', () => {
    const day1 = dailyRng('todays-find', new Date('2026-09-28T00:00:00Z'));
    const day1again = dailyRng('todays-find', new Date('2026-09-28T18:00:00Z'));
    const day2 = dailyRng('todays-find', new Date('2026-09-29T00:00:00Z'));
    expect(day1.next()).toBe(day1again.next());
    const week1 = weeklyRng('mega', new Date('2026-09-28T00:00:00Z'));
    const week1again = weeklyRng('mega', new Date('2026-10-02T00:00:00Z'));
    expect(week1.next()).toBe(week1again.next());
    expect(day1.next()).not.toBe(day2.next());
  });
});
