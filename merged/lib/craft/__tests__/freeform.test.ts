import { FreeformTrial } from '../freeform';

const T = { x: 100, y: 100, r: 30, hard: 0.85 };

describe('freeform trial', () => {
  it('is inactive with no candidates, and stays inactive with only hold-kind ones', () => {
    expect(new FreeformTrial([], T, 100, 100).active).toBe(false);
    expect(new FreeformTrial(['burn', 'heat', 'cool'], T, 100, 100).active).toBe(false);
  });

  it('never completes anything with no candidates, however much it is driven', () => {
    const f = new FreeformTrial([], T, 100, 100);
    for (let x = 70; x <= 130; x += 6) f.move(x, 100);
    expect(f.tick(1)).toBeNull();
  });

  it('a light rub completes the easier brush-kind technique before the harder one', () => {
    // scrape (reach 1.15) and grind (reach 2) are both 'brush' kind — grind needs much more travel
    const f = new FreeformTrial(['scrape', 'grind'], T, 100, 100);
    for (let k = 0; k < 2; k++) {
      for (let x = 130; x >= 70; x -= 6) f.move(x, 100);
      for (let x = 70; x <= 130; x += 6) f.move(x, 100);
    }
    expect(f.tick(0.1)).toBe('scrape');
  });

  it('keeps going toward the harder one once the easier one is already won elsewhere', () => {
    // grind alone (no scrape in the pool) needs the longer travel to complete
    const short = new FreeformTrial(['grind'], T, 100, 100);
    for (let k = 0; k < 2; k++) {
      for (let x = 130; x >= 70; x -= 6) short.move(x, 100);
      for (let x = 70; x <= 130; x += 6) short.move(x, 100);
    }
    expect(short.tick(0.1)).toBeNull();
    for (let k = 0; k < 3; k++) {
      for (let x = 130; x >= 70; x -= 6) short.move(x, 100);
      for (let x = 70; x <= 130; x += 6) short.move(x, 100);
    }
    expect(short.tick(0.1)).toBe('grind');
  });

  it('a smash-kind candidate accumulates repeat presses like the real hand does', () => {
    const soft = { ...T, hard: 0.2 }; // need 2
    const f = new FreeformTrial(['hammer'], soft, 100, 100); // hammer always needs 3, regardless of hardness
    f.down(100, 100); f.tick(0.3);
    expect(f.tick(0.1)).toBeNull();
    f.down(100, 100); f.tick(0.3);
    f.down(100, 100);
    expect(f.tick(0.1)).toBe('hammer');
  });

  it('picks the catalogue-earlier technique when two finish on the very same tick', () => {
    const soft = { ...T, hard: 0.2 };
    // both need 2 presses at this hardness; 'smash' precedes 'split' in TECH_ORDER
    const f = new FreeformTrial(['split', 'smash'], soft, 100, 100);
    f.down(100, 100); f.tick(0.4);
    f.down(100, 100);
    expect(f.tick(0.1)).toBe('smash');
  });

  it('is deterministic — the same motion always resolves the same way', () => {
    const run = () => {
      const f = new FreeformTrial(['scrape', 'grind'], T, 100, 100);
      for (let k = 0; k < 2; k++) {
        for (let x = 130; x >= 70; x -= 6) f.move(x, 100);
        for (let x = 70; x <= 130; x += 6) f.move(x, 100);
      }
      return f.tick(0.1);
    };
    expect(run()).toBe(run());
  });
});
