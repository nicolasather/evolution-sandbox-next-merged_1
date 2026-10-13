import { createIntroVisit } from '../visit';

describe('intro visit', () => {
  it('starts empty and remembers each scene independently', () => {
    const v = createIntroVisit();
    expect(v.hasSeen('civilization')).toBe(false);
    v.markSeen('civilization');
    expect(v.hasSeen('civilization')).toBe(true);
    expect(v.hasSeen('decipher')).toBe(false);
  });

  it('a new visit (a new object, as after a page load) makes everything eligible again', () => {
    const a = createIntroVisit();
    a.markSeen('civilization');
    const b = createIntroVisit();
    expect(b.hasSeen('civilization')).toBe(false);
  });

  it('reset() re-opens eligibility without any other effect', () => {
    const v = createIntroVisit();
    v.markSeen('survival'); v.markSeen('decipher');
    v.reset();
    expect(v.seen()).toEqual([]);
  });

  it('never touches localStorage', () => {
    window.localStorage.clear();
    const v = createIntroVisit();
    v.markSeen('civilization');
    expect(window.localStorage.length).toBe(0);
  });
});
