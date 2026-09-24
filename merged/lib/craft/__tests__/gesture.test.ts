import { Gesture, segDist } from '../gesture';

const T = { x: 100, y: 100, r: 30, hard: 0.85 };

describe('gestures', () => {
  it('brush needs sweeping back and forth, not one long drag', () => {
    const g = new Gesture('brush', T);
    expect(g.down(100, 100)).toBe(true);
    for (let x = 70; x <= 130; x += 6) g.move(x, 100);   // one long pass
    expect(g.done).toBe(false);
    expect(g.prog).toBeLessThan(1);
    for (let k = 0; k < 4; k++) {
      for (let x = 130; x >= 70; x -= 6) g.move(x, 100);
      for (let x = 70; x <= 130; x += 6) g.move(x, 100);
    }
    expect(g.done).toBe(true);
  });

  it('brush ignores the pointer when it is off the piece', () => {
    const g = new Gesture('brush', T);
    g.down(100, 100);
    for (let i = 0; i < 40; i++) g.move(300 + (i % 2) * 20, 300);
    expect(g.prog).toBe(0);
  });

  it('smash takes three blows on a hard thing and two on a soft one', () => {
    const hard = new Gesture('smash', T);
    expect(hard.need).toBe(3);
    for (let i = 0; i < 3; i++) { hard.down(100, 100); hard.up(); hard.tick(0.2); }
    expect(hard.done).toBe(true);
    const soft = new Gesture('smash', { ...T, hard: 0.2 });
    expect(soft.need).toBe(2);
    soft.down(100, 100); soft.tick(0.2); soft.down(100, 100);
    expect(soft.done).toBe(true);
  });

  it('smash forgets its blows if you wait', () => {
    const g = new Gesture('smash', T);
    g.down(100, 100); g.up();
    g.tick(2);
    expect(g.prog).toBe(0);
    expect(g.takeStrikes()).toBe(1);
    expect(g.takeStrikes()).toBe(0);
  });

  it('cut has to pass through the piece', () => {
    const miss = new Gesture('cut', T);
    miss.down(100, 20);
    for (let x = 100; x <= 220; x += 10) miss.move(x, 20);
    expect(miss.done).toBe(false);
    const hit = new Gesture('cut', T);
    hit.down(60, 100);
    for (let x = 60; x <= 150; x += 6) hit.move(x, 100);
    expect(hit.done).toBe(true);
  });

  it('cut lets go cleanly', () => {
    const g = new Gesture('cut', T);
    g.down(70, 100); g.move(100, 100); g.up();
    expect(g.cut).toBeNull();
  });

  it('separate follows a pull and springs back when released', () => {
    const g = new Gesture('separate', T);
    g.down(100, 100);
    g.move(120, 100);
    expect(g.pull.x).toBeGreaterThan(0);
    expect(g.done).toBe(false);
    g.up();
    expect(g.pull.x).toBe(0);
    const h = new Gesture('separate', T);
    h.down(100, 100);
    h.move(160, 100);
    expect(h.done).toBe(true);
  });

  it('dig counts three scoops', () => {
    const g = new Gesture('dig', T);
    g.down(100, 90);
    let y = 90;
    for (let scoop = 0; scoop < 3; scoop++) {
      for (let i = 0; i < 6; i++) { y += 5; g.move(100, y); }
      for (let i = 0; i < 6; i++) { y -= 4; g.move(100, y); }
    }
    expect(g.done).toBe(true);
  });

  it('finish does it for the player', () => {
    const g = new Gesture('cut', T);
    g.finish();
    expect(g.done).toBe(true);
    expect(g.prog).toBe(1);
  });

  it('measures the distance to a segment', () => {
    expect(segDist(0, 5, -10, 0, 10, 0)).toBe(5);
    expect(segDist(20, 0, -10, 0, 10, 0)).toBe(10);
  });
});
