import { generateSettlement } from '@/lib/civilization/generate';
import { advanceTurn } from '@/lib/civilization/simulate';
import type { Allocation } from '@/lib/civilization/types';

describe('advanceTurn', () => {
  it('does not mutate the input state (pure)', () => {
    const s = generateSettlement('purity-check');
    const before = JSON.stringify(s);
    advanceTurn(s, s.allocation);
    expect(JSON.stringify(s)).toBe(before);
  });

  it('normalises an allocation that does not sum to 1', () => {
    const s = generateSettlement('normalise-check');
    const { state } = advanceTurn(s, { food: 2, construction: 1, knowledge: 1 });
    expect(state.allocation.food + state.allocation.construction + state.allocation.knowledge).toBeCloseTo(1, 5);
    expect(state.allocation.food).toBeCloseTo(0.5, 5);
  });

  it('all-food allocation grows population (given enough land) and no-food allocation causes a famine', () => {
    const s = generateSettlement('food-check');
    const fed = advanceTurn(s, { food: 1, construction: 0, knowledge: 0 }).state;
    expect(fed.population).toBeGreaterThan(s.population * 0.99); // no famine

    const starved = advanceTurn(s, { food: 0, construction: 0.5, knowledge: 0.5 }).state;
    expect(starved.population).toBeLessThan(s.population);
    expect(starved.log.some(e => e.text.includes('shortage'))).toBe(true);
  });

  it('production is capped by farmland capacity regardless of labor invested', () => {
    let s = generateSettlement('capacity-check');
    s = { ...s, population: 5000, foodStock: 0 }; // absurdly over capacity on purpose
    const { state } = advanceTurn(s, { food: 1, construction: 0, knowledge: 0 });
    // even fully fed, this many mouths cannot be sustained by fixed land — a famine must follow
    expect(state.population).toBeLessThan(5000);
  });

  it('sustained knowledge + construction investment eventually completes irrigation and removes the water-labor pressure', () => {
    let s = generateSettlement('irrigation-check');
    const alloc: Allocation = { food: 0.4, construction: 0.3, knowledge: 0.3 };
    let completed = false;
    for (let i = 0; i < 40 && !completed; i++) {
      const r = advanceTurn(s, alloc);
      s = r.state;
      completed = !!s.milestones.irrigationComplete;
    }
    expect(completed).toBe(true);
    expect(s.farmland.irrigated).toBeGreaterThan(0);
    expect(s.problems.map(p => p.kind)).not.toContain('water-labor');
  });

  it('a reasonable, adaptive allocation policy reaches a resilient ending across several seeds', () => {
    for (const seed of ['civ-1', 'civ-2', 'civ-3']) {
      let s = generateSettlement(seed);
      while (s.ending === 'ongoing') {
        // Prioritise food while land is tight or stock is low; otherwise invest
        // in knowledge/construction toward irrigation — a simple, deterministic
        // stand-in for the brief's "simple AI policies" balance validation.
        const capacity = s.farmland.base + s.farmland.irrigated;
        const tight = s.population > capacity * 0.75 || s.foodStock < s.population * 0.5;
        const alloc: Allocation = tight
          ? { food: 0.65, construction: 0.2, knowledge: 0.15 }
          : { food: 0.45, construction: 0.3, knowledge: 0.25 };
        s = advanceTurn(s, alloc).state;
      }
      expect(s.ending).toBe('resilient');
      expect(s.population).toBeGreaterThan(0);
    }
  });

  it('an unmanaged, food-starved policy across many turns leads to collapse', () => {
    let s = generateSettlement('neglect-check');
    const alloc: Allocation = { food: 0, construction: 0.5, knowledge: 0.5 };
    let guard = 0;
    while (s.ending === 'ongoing' && guard < 30) { s = advanceTurn(s, alloc).state; guard++; }
    expect(s.ending).toBe('collapsed');
  });

  it('storage capacity grows from construction investment and is named once', () => {
    let s = generateSettlement('storage-check');
    const alloc: Allocation = { food: 0.4, construction: 0.5, knowledge: 0.1 };
    let namedCount = 0;
    for (let i = 0; i < 10; i++) {
      const r = advanceTurn(s, alloc);
      s = r.state;
      namedCount += r.events.filter(e => e.text.includes('granary')).length;
    }
    expect(s.storageCapacity).toBeGreaterThan(20);
    expect(namedCount).toBe(1);
  });

  it('the clock advances in fixed 5-year turns', () => {
    const s = generateSettlement('clock-check');
    const { state } = advanceTurn(s, s.allocation);
    expect(state.year).toBe(s.year + 5);
    expect(state.turn).toBe(s.turn + 1);
  });
});
