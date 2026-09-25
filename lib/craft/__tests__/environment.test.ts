import { World } from '../world';

type Kind = 'wood' | 'clay' | 'stone' | 'fire' | 'water';
const PHYS: Record<Kind, { cat: string; id: string; chars: boolean; soaks: boolean; windy: number; mc: string; shape: string }> = {
  wood:  { id: 'wood',  cat: 'material', chars: true,  soaks: true,  windy: 0, mc: 'wood', shape: 'rod' },
  clay:  { id: 'clay',  cat: 'material', chars: false, soaks: true,  windy: 0.3, mc: 'earth', shape: 'pile' },
  stone: { id: 'stone', cat: 'material', chars: false, soaks: false, windy: 0, mc: 'mineral', shape: 'chunk' },
  fire:  { id: 'fire',  cat: 'energy',   chars: false, soaks: false, windy: 0, mc: 'flame', shape: 'flame' },
  water: { id: 'water', cat: 'material', chars: false, soaks: false, windy: 0, mc: 'liquid', shape: 'liquid' },
};

function make() {
  const host = document.createElement('div');
  const world = new World(host, {
    resolve: id => {
      const p = PHYS[id as Kind];
      return { id, n: id, vis: 'cobble', cat: p.cat, era: 'origins',
        phys: { materialClass: p.mc, shapeClass: p.shape, properties: [], chars: p.chars, soaks: p.soaks, windy: p.windy } };
    },
    onImpact: () => {}, onWall: () => {}, onLand: () => {}, onZone: () => {},
  });
  world.resize(1200, 800);
  return { world, host };
}
const settle = (w: World, secs: number) => { for (let i = 0; i < secs * 60; i++) w.step(1 / 60); };

describe('environment', () => {
  it('describes each body by what it is (class, shape) for the styles to read', () => {
    const { world } = make();
    const b = world.spawn('clay', 300, 300)!;
    expect(b.el.dataset.mclass).toBe('earth');
    expect(b.el.dataset.shape).toBe('pile');
    expect(b.el.dataset.windy).toBe('1');
  });

  it('fire beside wood warms it, and long enough scorches it; stone is only warmed', () => {
    const { world } = make();
    const fire = world.spawn('fire', 400, 400, { pop: false })!;
    const wood = world.spawn('wood', 400 + fire.r * 1.6, 400, { pop: false })!;
    const rock = world.spawn('stone', 400 - fire.r * 1.6, 400, { pop: false })!;
    for (const b of [fire, wood, rock]) { b.locked = true; b.z = 0; }
    settle(world, 3);
    expect(wood.warm).toBeGreaterThan(0.5);
    expect(rock.warm).toBeGreaterThan(0.5);
    settle(world, 10);
    expect(wood.scorch).toBeGreaterThan(0.5);
    expect(rock.scorch).toBe(0);
    world.paint(wood);
    expect(wood.el.hasAttribute('data-scorch')).toBe(true);
  });

  it('water beside clay soaks it and it dries again when the water goes; stone stays dry', () => {
    const { world } = make();
    const water = world.spawn('water', 600, 400, { pop: false })!;
    const clay = world.spawn('clay', 600 + water.r * 1.5, 400, { pop: false })!;
    const rock = world.spawn('stone', 600 - water.r * 1.5, 400, { pop: false })!;
    for (const b of [water, clay, rock]) { b.locked = true; b.z = 0; }
    settle(world, 4);
    expect(clay.wet).toBeGreaterThan(0.5);
    expect(rock.wet).toBe(0);
    world.paint(clay);
    expect(clay.el.hasAttribute('data-wet')).toBe(true);
    world.remove(water);
    settle(world, 20);
    expect(clay.wet).toBeLessThan(0.1);
  });

  it('a heavy body far from any flame or water leaves the loop free to sleep', () => {
    const { world } = make();
    const rock = world.spawn('stone', 300, 300, { pop: false })!;
    rock.z = 0;
    settle(world, 3);
    expect(world.busy).toBe(false);
  });

  it('the loop rests again once the environment has finished working', () => {
    const { world } = make();
    const fire = world.spawn('fire', 400, 400, { pop: false })!;
    const rock = world.spawn('stone', 400 + fire.r * 1.6, 400, { pop: false })!;
    fire.locked = true; fire.z = 0; rock.locked = true; rock.z = 0;
    settle(world, 12);
    fire.locked = false; rock.locked = false;
    settle(world, 3);
    expect(world.busy).toBe(false);
  });

  it('a landing liquid leaves a ripple that removes itself', () => {
    jest.useFakeTimers();
    const { world, host } = make();
    const w = world.spawn('water', 500, 400, { pop: false, z: 80 })!;
    w.z = 80; w.vz = -900;
    settle(world, 1);
    expect(host.querySelector('.wb-ripple')).not.toBeNull();
    jest.advanceTimersByTime(900);
    expect(host.querySelector('.wb-ripple')).toBeNull();
    jest.useRealTimers();
  });
});
