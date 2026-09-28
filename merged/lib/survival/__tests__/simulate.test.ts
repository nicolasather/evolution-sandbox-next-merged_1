import { generateCamp } from '@/lib/survival/generate';
import { advanceTick } from '@/lib/survival/simulate';
import type { CampState, Task } from '@/lib/survival/types';

function findTile(state: CampState, kind: 'water' | 'woodland'): { x: number; y: number } {
  for (let y = 0; y < state.terrain.height; y++) {
    for (let x = 0; x < state.terrain.width; x++) {
      if (state.terrain.tiles[y][x] === kind) return { x, y };
    }
  }
  throw new Error(`no ${kind} tile`);
}

describe('advanceTick', () => {
  it('does not mutate the input state (pure)', () => {
    const camp = generateCamp('purity-check');
    const before = JSON.stringify(camp);
    advanceTick(camp, {});
    expect(JSON.stringify(camp)).toBe(before);
  });

  it('gathering wood at a woodland tile increases wood', () => {
    const camp = generateCamp('wood-check');
    const wood = findTile(camp, 'woodland');
    const task: Task = { kind: 'gather-wood', x: wood.x, y: wood.y };
    const { state } = advanceTick(camp, { [camp.members[0].id]: task });
    expect(state.resources.wood).toBeGreaterThan(camp.resources.wood);
  });

  it('gathering wood at a non-woodland tile does nothing (task must match the real tile)', () => {
    const camp = generateCamp('wood-wrong-tile');
    const task: Task = { kind: 'gather-wood', x: camp.terrain.campX, y: camp.terrain.campY };
    const { state } = advanceTick(camp, { [camp.members[0].id]: task });
    expect(state.resources.wood).toBe(camp.resources.wood);
  });

  it('fetching water at a water tile increases water (net of any same-tick consumption)', () => {
    // start from a non-morning period so the daily food/water draw (which
    // happens once, at the start of morning) doesn't conflate the comparison
    let camp = generateCamp('water-check');
    camp = advanceTick(camp, {}).state; // morning -> day, consumes once, out of the way
    const water = findTile(camp, 'water');
    const task: Task = { kind: 'fetch-water', x: water.x, y: water.y };
    const withFetch = advanceTick(camp, { [camp.members[0].id]: task }).state.resources.water;
    const withoutFetch = advanceTick(camp, {}).state.resources.water;
    expect(withFetch).toBeGreaterThan(withoutFetch);
  });

  it('tending fire with enough wood eventually lights it and logs a milestone once', () => {
    let camp = generateCamp('fire-check');
    camp = { ...camp, resources: { ...camp.resources, wood: 5 } };
    let lit = false;
    let fireEvents = 0;
    for (let i = 0; i < 6 && !lit; i++) {
      const assignments: Record<string, Task> = { [camp.members[0].id]: { kind: 'tend-fire', x: camp.terrain.campX, y: camp.terrain.campY } };
      const r = advanceTick(camp, assignments);
      camp = r.state;
      fireEvents += r.events.filter(e => e.text.includes('first real flame')).length;
      lit = camp.fire.lit;
    }
    expect(lit).toBe(true);
    expect(fireEvents).toBe(1);
  });

  it('resting restores energy and never reduces it', () => {
    let camp = generateCamp('rest-check');
    camp = { ...camp, members: camp.members.map(m => ({ ...m, energy: 0.3 })) };
    const task: Task = { kind: 'rest', x: camp.terrain.campX, y: camp.terrain.campY };
    const { state } = advanceTick(camp, { [camp.members[0].id]: task });
    expect(state.members[0].energy).toBeGreaterThan(0.3);
  });

  it('an unmanaged camp (all idle) trends toward failure over enough ticks', () => {
    let camp = generateCamp('neglect-check');
    let ticks = 0;
    while (camp.ending === 'ongoing' && ticks < 200) {
      const r = advanceTick(camp, {});
      camp = r.state;
      ticks++;
    }
    expect(camp.ending).toBe('failed');
  });

  it('a simple greedy "keep the essentials topped up, rest whoever is tired" policy reaches the target day', () => {
    // A deterministic stand-in for the brief's "simple AI policies run
    // scenarios ... to find impossible seeds" — if a reasonable policy can't
    // reach the objective on several seeds, the balance needs tuning, not
    // the test.
    for (const seed of ['success-check-1', 'success-check-2', 'success-check-3']) {
      let camp = generateCamp(seed);
      const water = findTile(camp, 'water');
      const wood = findTile(camp, 'woodland');
      let ticks = 0;
      while (camp.ending === 'ongoing' && ticks < 200) {
        const assignments: Record<string, Task> = {};
        const campXY = { x: camp.terrain.campX, y: camp.terrain.campY };
        const alive = camp.members.filter(m => !m.injured).sort((a, b) => a.energy - b.energy);
        const resting = new Set<string>();
        for (const m of alive) {
          if (m.energy < 0.35 && resting.size < Math.max(0, alive.length - 1)) {
            assignments[m.id] = { kind: 'rest', ...campXY };
            resting.add(m.id);
          }
        }
        const workers = alive.filter(m => !resting.has(m.id));
        const needs: Task[] = [];
        if (!camp.fire.lit || camp.fire.fuel < 0.4) needs.push({ kind: 'tend-fire', ...campXY });
        if (camp.resources.water < 1.5) needs.push({ kind: 'fetch-water', x: water.x, y: water.y });
        if (camp.resources.food < 1.5) needs.push({ kind: 'gather-food', x: wood.x, y: wood.y });
        if (camp.shelter.level < 2) needs.push({ kind: 'build-shelter', ...campXY });
        while (needs.length < workers.length) needs.push({ kind: 'gather-food', x: wood.x, y: wood.y });
        workers.forEach((m, i) => { assignments[m.id] = needs[i % needs.length]; });
        const r = advanceTick(camp, assignments);
        camp = r.state;
        ticks++;
      }
      expect(camp.ending).toBe('success');
    }
  });

  it('the clock advances through periods and days correctly', () => {
    const camp = generateCamp('clock-check');
    expect(camp.period).toBe('morning');
    let s = camp;
    for (const expected of ['day', 'evening', 'night', 'morning']) {
      s = advanceTick(s, {}).state;
      expect(s.period).toBe(expected);
    }
    expect(s.day).toBe(2);
  });
});
