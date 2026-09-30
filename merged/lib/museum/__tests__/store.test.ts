import { buildCatalog } from '@/lib/museum/history/data';
import { MuseumStore } from '@/lib/museum/history/store';

const cat = buildCatalog();

describe('Humanity Museum state', () => {
  beforeEach(() => window.localStorage.clear());

  it('the first sync is a silent baseline: eligible, but nothing queued', () => {
    const s = new MuseumStore();
    const r = s.sync(-3_000_000, cat, 1);
    expect(r.newlyEligible.length).toBeGreaterThan(0);
    expect(r.newDefining).toEqual([]);
    expect(s.peekReveal()).toBeNull();
    expect(s.state('lucy').eligibleAt).toBe(1);
    expect(s.state('lucy').revealedAt).toBeUndefined();
  });

  it('keeps eligible, revealed, visited and detail-opened as distinct states', () => {
    const s = new MuseumStore();
    s.sync(-3_000_000, cat, 1);
    expect(s.unseenCount()).toBeGreaterThan(0);
    s.markRevealed(['lucy'], 2);
    expect(s.state('lucy')).toEqual({ eligibleAt: 1, eligibleYear: -3_000_000, revealedAt: 2 });
    s.markVisited('lucy', 3);
    expect(s.state('lucy').visitedAt).toBe(3);
    expect(s.state('lucy').detailOpenedAt).toBeUndefined();
    s.markDetailOpened('lucy', 4);
    expect(s.state('lucy').detailOpenedAt).toBe(4);
    // an exhibit beyond the timeline can never be revealed or visited
    s.markVisited('internet', 5);
    expect(s.state('internet')).toEqual({});
  });

  it('queues a cinematic only for defining achievements and newly opened galleries', () => {
    const s = new MuseumStore();
    s.sync(-1_100_000, cat, 1);
    const r = s.sync(-900_000, cat, 2);
    expect(r.newDefining).toContain('controlled-fire');
    expect(r.newGalleries).toContain('fire-and-hearth');
    expect(s.peekReveal()).toEqual({ kind: 'gallery', id: 'fire-and-hearth' });
    s.consumeReveal('gallery', 'fire-and-hearth', 3);
    expect(s.peekReveal()).toEqual({ kind: 'exhibit', id: 'controlled-fire' });
    s.consumeReveal('exhibit', 'controlled-fire', 4);
    expect(s.peekReveal()).toBeNull();
  });

  it('emits one restrained signal per sync', () => {
    const s = new MuseumStore();
    const got: unknown[] = [];
    s.onSignal(x => got.push(x));
    s.sync(-1_100_000, cat, 1);
    expect(got).toHaveLength(0);
    s.sync(-900_000, cat, 2);
    expect(got).toHaveLength(1);
    s.sync(-900_000, cat, 3);
    expect(got).toHaveLength(1);
  });

  it('a timeline that moves backwards (a reset game) clears the Museum with it', () => {
    const s = new MuseumStore();
    s.sync(-1_100_000, cat, 1);
    s.sync(-100_000, cat, 2);
    s.markVisited('controlled-fire', 3);
    const r = s.sync(-3_300_000, cat, 4);
    expect(r.reset).toBe(true);
    expect(s.state('controlled-fire')).toEqual({});
    expect(s.peekReveal()).toBeNull();
  });

  it('persists and reloads', () => {
    const a = new MuseumStore();
    a.sync(-3_000_000, cat, 1);
    a.markVisited('lucy', 2);
    const b = new MuseumStore();
    b.load();
    expect(b.state('lucy').visitedAt).toBe(2);
  });

  it('metrics are counts, available only in a secondary view', () => {
    const s = new MuseumStore();
    s.sync(2026, cat, 1);
    const m = s.metrics(cat);
    expect(m.available).toBe(cat.exhibits.length);
    expect(m.galleriesOpen).toBe(cat.galleries.length);
    expect(m.regionsRepresented).toBeGreaterThanOrEqual(6);
  });
});
