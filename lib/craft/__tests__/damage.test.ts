import { World } from '../world';

/* Only brittle materials (physics.ts's `brittle` property) take a lasting, visible crack from hard
   knocks — never a stat, never a gameplay block, purely `data-damage` + the `--wear` CSS var. See
   CHANGELOG 1.11.0 / P2.4. */

function make() {
  const host = document.createElement('div');
  const world = new World(host, {
    resolve: id => ({
      id, n: id, vis: 'cobble', cat: 'material', era: 'origins',
      phys: {
        materialClass: id === 'glass' ? 'glass' : 'wood', shapeClass: 'chunk',
        properties: id === 'glass' ? ['brittle', 'hard'] : ['flexible'],
        chars: false, soaks: false, windy: 0,
      },
    }),
    onImpact: () => {}, onWall: () => {}, onLand: () => {}, onZone: () => {},
  });
  world.resize(1200, 800);
  return world;
}

/** Drop a body from `z` and step until it has landed. */
function drop(world: World, b: NonNullable<ReturnType<World['spawn']>>, z = 600) {
  b.z = z; b.vz = 0; b.x = 400; b.y = 400; b.locked = false;
  for (let i = 0; i < 300 && (b.z > 0 || b.vz !== 0); i++) world.step(1 / 60);
}

describe('brittle damage (P2.4)', () => {
  it('takes no damage from a gentle drop, but cracks and eventually breaks under repeated hard ones', () => {
    const world = make();
    const glass = world.spawn('glass', 400, 400, { pop: false })!;
    expect(glass.wear).toBe(0);

    drop(world, glass, 40); // well under the fall that would even register as a landing worth marking
    expect(glass.wear).toBe(0);

    for (let i = 0; i < 3 && glass.wear < 0.35; i++) drop(world, glass, 700);
    world.paint(glass);
    expect(glass.wear).toBeGreaterThan(0);
    expect(glass.el.getAttribute('data-damage')).toBe('cracked');

    for (let i = 0; i < 6 && glass.wear < 0.85; i++) drop(world, glass, 700);
    world.paint(glass);
    expect(glass.wear).toBeGreaterThanOrEqual(0.85);
    expect(glass.el.getAttribute('data-damage')).toBe('broken');
  });

  it('never marks a non-brittle material, however hard it lands', () => {
    const world = make();
    const wood = world.spawn('wood', 400, 400, { pop: false })!;
    for (let i = 0; i < 6; i++) drop(world, wood, 900);
    world.paint(wood);
    expect(wood.wear).toBe(0);
    expect(wood.el.hasAttribute('data-damage')).toBe(false);
  });
});
