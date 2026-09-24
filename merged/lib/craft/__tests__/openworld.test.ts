import { World } from '../world';

/** The bench is the whole screen: pieces go anywhere, and only keep clear of interface that is showing. */
function make(w = 1200, h = 800) {
  const host = document.createElement('div');
  const world = new World(host, {
    resolve: id => ({ id, n: id, vis: 'cobble', cat: 'material', era: 'origins' }),
    onImpact: () => {}, onWall: () => {}, onLand: () => {}, onZone: () => {},
  });
  world.resize(w, h);
  return world;
}

describe('open world', () => {
  it('a piece can rest near any edge when nothing is in the way', () => {
    const world = make();
    const b = world.spawn('stone', 1150, 60)!;
    expect(b.x).toBeGreaterThan(1000);
    expect(b.y).toBeLessThan(120);
  });

  it('pieces are moved clear of interface that appears over them, and it can be folded away again', () => {
    const world = make();
    const b = world.spawn('stone', 100, 400)!;
    expect(b.x).toBeLessThan(200);
    world.setPad({ l: 300 });                    // the inventory opens
    expect(b.x).toBeGreaterThanOrEqual(300);
    world.setPad({ l: 0 });                      // and folds away: nothing pushes back
    expect(world.area.x).toBe(0);
    expect(world.setPad({ l: 0 })).toBe(false);  // no change, no work
  });

  it('the play box is a bounded, centred area — never a visible or clickable limit', () => {
    const world = make(1600, 900);
    const p = world.play, a = world.area;
    expect(p.w).toBeLessThanOrEqual(720);
    expect(p.h).toBeLessThanOrEqual(400);
    expect(p.x + p.w / 2).toBeCloseTo(a.x + a.w / 2, 5);
    // a piece far outside it is still perfectly grabbable
    const far = world.spawn('stone', 1500, 120)!;
    expect(world.bodyAt(far.x, far.y - far.z)).toBe(far);
  });

  it('a piece has a generous, invisible grab area', () => {
    const world = make();
    const b = world.spawn('stone', 600, 400)!;
    expect(world.bodyAt(b.x + b.r * 1.15, b.y - b.z)).toBe(b);
    expect(world.bodyAt(b.x + b.r * 1.6, b.y - b.z)).toBeNull();
  });

  it('zones stay inside the free area when the inventory is open', () => {
    const world = make();
    world.setPad({ l: 300, b: 80 });
    for (const id of ['hearth', 'anvil', 'basin'] as const) {
      const r = world.zoneRect(id);
      expect(r.x).toBeGreaterThanOrEqual(world.area.x - 1);
      expect(r.y + r.h).toBeLessThanOrEqual(world.area.y + world.area.h + 1);
    }
  });
});
