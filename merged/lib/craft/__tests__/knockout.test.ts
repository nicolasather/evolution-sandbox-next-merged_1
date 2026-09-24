import { World, knockSpeed } from '../world';

/** A hard collision that carries a piece into the boundary sends it through, briefly, and then home. */
function make(hooks: { out?: (id: string) => void } = {}) {
  const host = document.createElement('div');
  const world = new World(host, {
    resolve: id => ({ id, n: id, vis: 'cobble', cat: 'material', era: 'origins' }),
    onImpact: () => {}, onWall: () => {}, onLand: () => {}, onZone: () => {},
    onKnockOut: b => hooks.out?.(b.itemId),
  });
  world.resize(1200, 800);
  return world;
}

/** Fling `hitter` at `victim` (parked at the right wall) at `speed` px/s, then run one simulated second. */
function fling(hitId: string, victimId: string, speed: number) {
  const out: string[] = [];
  const world = make({ out: id => out.push(id) });
  const a = world.area;
  const victim = world.spawn(victimId, a.x + a.w - 60, 400)!;
  const hitter = world.spawn(hitId, a.x + a.w - 60 - 200, 400)!;
  for (let i = 0; i < 90; i++) world.step(1 / 60);              // settle
  // the player drags the hitter at the victim; `speed` is how far ahead of the hand the pointer runs (px)
  world.grab(hitter, hitter.x, hitter.y);
  let wentOutside = false, top = 0;
  for (let i = 0; i < 90; i++) {
    if (i < 45) world.dragTo(hitter, hitter.x + speed / 10, hitter.y); else if (i === 45) world.release(hitter, hitter.vx, hitter.vy);
    world.step(1 / 60);
    top = Math.max(top, Math.abs(victim.vx));
    if (victim.outside || hitter.outside) wentOutside = true;
  }
  return { out, wentOutside, top };
}

describe('knock-out', () => {
  it('stone is easy to knock through, fibre is not', () => {
    expect(knockSpeed('stone')).toBeLessThan(knockSpeed('wood'));
    expect(knockSpeed('wood')).toBeLessThan(knockSpeed('fibre'));
  });

  it('a hard stone-on-stone hit at the wall sends a piece through and home', () => {
    const r = fling('stone', 'stone', 1500);
    expect(r.wentOutside).toBe(true);
    expect(r.out.length).toBeGreaterThan(0);
  });

  it('a gentle push never does', () => {
    const r = fling('stone', 'stone', 60);
    expect(r.wentOutside).toBe(false);
    expect(r.out).toHaveLength(0);
  });

  it('a light fibre is only bounced by the same hit', () => {
    const r = fling('stone', 'fiber', 1500);
    expect(r.out.filter(id => id === 'fiber')).toHaveLength(0);
  });
});
