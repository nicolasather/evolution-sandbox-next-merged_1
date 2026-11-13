import { bottomS, boxAt, freePath, glidePath, makeGeo, nearestS, normalise, pointAt, rotAt } from '../perimeter';

const W = 1000, H = 700, S = 60;
const g = makeGeo(W, H, S);

/** the creature's body (the circle inscribed in its box, about its middle) inside the screen */
function onScreen(s: number): boolean {
  const p = pointAt(g, s), rot = rotAt(g, s);
  const b = boxAt(g, p.x, p.y, rot);
  const cx = b.x + S / 2, cy = b.y + S / 2;
  return cx - S / 2 >= -0.01 && cx + S / 2 <= W + 0.01 && cy - S / 2 >= -0.01 && cy + S / 2 <= H + 0.01;
}

describe('the border the crew walks', () => {
  it('is one closed loop, a lap of the screen in feet coordinates', () => {
    expect(pointAt(g, 0)).toMatchObject({ x: S / 2, y: H, edge: 'bottom' });
    expect(pointAt(g, g.P)).toEqual(pointAt(g, 0));
    expect(pointAt(g, -1)).toEqual(pointAt(g, g.P - 1));
    expect(pointAt(g, g.A - 1)).toMatchObject({ edge: 'bottom' });
    expect(pointAt(g, g.P / 2)).toMatchObject({ edge: 'top' });
  });

  it('keeps the whole body on the screen at every place on the loop', () => {
    for (let s = 0; s < g.P; s += 1) expect(onScreen(s)).toBe(true);
  });

  it('never jumps: a step of one px moves the feet by about one px, corners included', () => {
    for (let s = -g.P; s < 2 * g.P; s += 1) {
      const a = pointAt(g, s), b = pointAt(g, s + 1);
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThanOrEqual(1.0001);
    }
  });

  it('turns the body a quarter for each corner, smoothly, and the tilt repeats each lap', () => {
    expect(rotAt(g, 0)).toBeCloseTo(0, 5);
    expect(rotAt(g, g.starts[1] + g.segs[1].len / 2)).toBeCloseTo(-45, 5); // halfway round the corner
    expect(rotAt(g, g.starts[2] + 1)).toBeCloseTo(-90, 5);
    expect(rotAt(g, g.starts[4] + 1)).toBeCloseTo(-180, 5);
    expect(rotAt(g, g.starts[6] + 1)).toBeCloseTo(-270, 5);
    for (let s = 0; s < g.P; s += 1) expect(Math.abs(rotAt(g, s + 1) - rotAt(g, s))).toBeLessThanOrEqual(2.2);
    expect(rotAt(g, 300 + g.P)).toBeCloseTo(rotAt(g, 300) - 360, 5);
  });

  it('a route to a place always ends at the same tilt, however many laps it went round', () => {
    for (const s of [10, 880, 905, 1100, 1480, 1700, 2380, 2500, 2990]) {
      const a = normalise(g, s, rotAt(g, s)), b = normalise(g, s + 3 * g.P, rotAt(g, s + 3 * g.P));
      expect(a.rot).toBeCloseTo(b.rot, 5);
    }
  });

  it('a glide is a smooth ordered path, both ways, through every corner', () => {
    for (const [a, b] of [[100, 2000], [2900, 500], [1400, 200], [0, 3200], [-300, 2500]]) {
      const path = glidePath(g, a, b);
      expect(path[0].offset).toBe(0);
      expect(path[path.length - 1].offset).toBe(1);
      for (let i = 1; i < path.length; i++) {
        expect(path[i].offset).toBeGreaterThanOrEqual(path[i - 1].offset);
        const run = Math.abs(path[i].offset - path[i - 1].offset) * Math.abs(b - a);
        expect(Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y)).toBeLessThanOrEqual(run + 0.5);
        expect(Math.abs(path[i].rot - path[i - 1].rot)).toBeLessThanOrEqual(30);
      }
    }
  });

  it('a free path (into the room and back) moves evenly from one place to the other', () => {
    const k = freePath({ x: 10, y: 20, rot: 0 }, { x: 110, y: 220, rot: 90 });
    expect(k[0]).toMatchObject({ offset: 0, x: 10, y: 20, rot: 0 });
    expect(k[k.length - 1]).toMatchObject({ offset: 1, x: 110, y: 220, rot: 90 });
  });

  it('finds where on the border a point is, and never a lap away from where it was', () => {
    for (const s of [10, 450, 905, 1300, 1999, 2500, 2990]) {
      const p = pointAt(g, s);
      expect(nearestS(g, p.x, p.y, s)).toBeCloseTo(s, 5);
      expect(nearestS(g, p.x, p.y, s + g.P)).toBeCloseTo(s + g.P, 5);
    }
  });

  it('walks to a spot on the floor, and never leaves the floor run', () => {
    expect(bottomS(g, 400, 0)).toBeCloseTo(400 - S / 2, 5);
    expect(bottomS(g, 5000, 10)).toBeCloseTo(g.A, 5);
    expect(bottomS(g, -50, 10)).toBeCloseTo(0, 5);
  });

  it('keeps a margin inside the screen edge when asked to, so limbs that reach past the box stay on screen', () => {
    const m = makeGeo(W, H, S, 8);
    for (let s = 0; s < m.P; s += 1) {
      const p = pointAt(m, s);
      expect(p.x).toBeGreaterThanOrEqual(8 - 0.01);
      expect(p.x).toBeLessThanOrEqual(W - 8 + 0.01);
      expect(p.y).toBeGreaterThanOrEqual(8 - 0.01);
      expect(p.y).toBeLessThanOrEqual(H - 8 + 0.01);
    }
    expect(nearestS(m, pointAt(m, 500).x, pointAt(m, 500).y, 500)).toBeCloseTo(500, 5);
    expect(bottomS(m, 400, 0)).toBeCloseTo(400 - 8 - S / 2, 5);
  });
  it('places the box so the feet stand on the floor, or sit flat against a wall', () => {
    expect(boxAt(g, 300, H, 0)).toEqual({ x: 270, y: H - S });
    const right = pointAt(g, g.starts[2] + 10);
    const b = boxAt(g, right.x, right.y, -90);
    expect(b.x + S).toBeCloseTo(W, 5);
  });
});
