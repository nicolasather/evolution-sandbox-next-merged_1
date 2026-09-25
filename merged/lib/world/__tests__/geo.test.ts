import {
  angleBetween, angleOf, arcPoints, centroid, discRadiusPx, distanceKm, distFor, project, slerp, slerpLatLon,
  toLatLon, toVec, viewAxes, wrapLon, dot, type Camera, type Viewport,
} from '../geo';

const vp: Viewport = { w: 1200, h: 800 };
const close = (a: number, b: number, digits = 6) => expect(a).toBeCloseTo(b, digits);

describe('wrapLon', () => {
  it('folds any longitude into (-180, 180]', () => {
    expect(wrapLon(190)).toBe(-170);
    expect(wrapLon(-190)).toBe(170);
    expect(wrapLon(540)).toBe(180);
    expect(wrapLon(-180)).toBe(180);
    expect(wrapLon(0)).toBe(0);
  });
});

describe('toVec / toLatLon', () => {
  it('round-trips a place', () => {
    for (const [lat, lon] of [[0, 0], [48.85, 2.35], [-33.9, 151.2], [64, -150], [-77, 165]]) {
      const back = toLatLon(toVec(lat, lon));
      close(back.lat, lat, 9); close(back.lon, lon, 9);
    }
  });

  it('follows the shader convention: lon 0 faces +z, east faces +x, north is +y', () => {
    const [x0, y0, z0] = toVec(0, 0);
    close(x0, 0); close(y0, 0); close(z0, 1);
    const [xe] = toVec(0, 90);
    close(xe, 1);
    const [, yn] = toVec(90, 0);
    close(yn, 1);
  });
});

describe('distance', () => {
  it('measures great circles', () => {
    // Paris–London is about 344 km
    const d = distanceKm({ lat: 48.8566, lon: 2.3522 }, { lat: 51.5074, lon: -0.1278 });
    expect(d).toBeGreaterThan(330); expect(d).toBeLessThan(360);
    // a quarter of the way round
    close(angleOf({ lat: 0, lon: 0 }, { lat: 0, lon: 90 }), Math.PI / 2);
    // antipodes
    close(angleOf({ lat: 10, lon: 20 }, { lat: -10, lon: -160 }), Math.PI, 5);
  });

  it('is zero for the same place and stable for a tiny step', () => {
    expect(distanceKm({ lat: 5, lon: 5 }, { lat: 5, lon: 5 })).toBe(0);
    expect(angleBetween(toVec(5, 5), toVec(5, 5.0000001))).toBeGreaterThan(0);
  });
});

describe('slerp', () => {
  it('runs along the great circle, ending at both ends', () => {
    const a = toVec(10, -20), b = toVec(50, 70);
    const s0 = slerp(a, b, 0), s1 = slerp(a, b, 1);
    for (let i = 0; i < 3; i++) { close(s0[i], a[i]); close(s1[i], b[i]); }
    const mid = slerp(a, b, 0.5);
    close(Math.hypot(...mid), 1);
    close(angleBetween(a, mid), angleBetween(a, b) / 2, 6);
  });

  it('goes the short way across the antimeridian', () => {
    const m = slerpLatLon({ lat: 0, lon: 170 }, { lat: 0, lon: -170 }, 0.5);
    close(Math.abs(m.lon), 180, 5);
  });

  it('survives identical and antipodal endpoints', () => {
    const a = toVec(20, 30);
    expect(slerp(a, a, 0.4)).toEqual(a);
    const anti = toVec(-20, -150);
    const m = slerp(a, anti, 0.5);
    expect(Number.isFinite(m[0] + m[1] + m[2])).toBe(true);
    close(Math.hypot(...m), 1, 5);
  });
});

describe('centroid', () => {
  it('is null for nothing, the point itself for one, and between for two', () => {
    expect(centroid([])).toBeNull();
    const one = centroid([{ lat: 12, lon: 34 }])!;
    close(one.lat, 12, 6); close(one.lon, 34, 6);
    const two = centroid([{ lat: 0, lon: 0 }, { lat: 0, lon: 60 }])!;
    close(two.lat, 0, 6); close(two.lon, 30, 6);
  });
});

describe('camera maths', () => {
  const cam: Camera = { lat: 30, lon: 40, zoom: 1.2, shift: 0 };

  it('puts the place the camera looks at at the centre of the screen', () => {
    const p = project(cam.lat, cam.lon, cam, vp);
    close(p.x, vp.w / 2, 3); close(p.y, vp.h / 2, 3);
    expect(p.visible).toBe(true);
    close(p.facing, 1, 3);
  });

  it('lifts the whole picture by `shift` of the screen height', () => {
    const lifted = project(cam.lat, cam.lon, { ...cam, shift: 0.1 }, vp);
    close(lifted.y, vp.h / 2 - 0.1 * vp.h, 3);
  });

  it('has an orthonormal view basis whose forward axis is the target', () => {
    const { right, up, fwd } = viewAxes(cam.lat, cam.lon);
    close(dot(right, up), 0, 9); close(dot(right, fwd), 0, 9); close(dot(up, fwd), 0, 9);
    close(Math.hypot(...right), 1, 9); close(Math.hypot(...up), 1, 9);
    const t = toVec(cam.lat, cam.lon);
    for (let i = 0; i < 3; i++) close(fwd[i], t[i], 9);
  });

  it('north is up on screen', () => {
    const c = project(0, 0, { lat: 0, lon: 0, zoom: 1.2 }, vp);
    const n = project(20, 0, { lat: 0, lon: 0, zoom: 1.2 }, vp);
    expect(n.y).toBeLessThan(c.y);
    const e = project(0, 20, { lat: 0, lon: 0, zoom: 1.2 }, vp);
    expect(e.x).toBeGreaterThan(c.x);
  });

  it('hides what is on the far side, and shows what is on the near side', () => {
    const c: Camera = { lat: 0, lon: 0, zoom: 1.2 };
    expect(project(0, 180, c, vp).visible).toBe(false);
    expect(project(0, 60, c, vp).visible).toBe(true);
    // a point raised off the surface just behind the limb is still hidden by the globe
    expect(project(0, 170, c, vp, 1.05).visible).toBe(false);
  });

  it('agrees with the disc radius: a point on the limb lands at that many pixels from the centre', () => {
    const c: Camera = { lat: 0, lon: 0, zoom: 1.2 };
    const r = discRadiusPx(c, vp);
    // the horizon is where the view ray is tangent: its central angle from the camera axis is acos(1/dist)
    const dist = distFor(c.zoom, vp);
    const limb = Math.acos(1 / dist) * 180 / Math.PI;
    const p = project(0, limb - 0.01, c, vp);
    close(Math.hypot(p.x - vp.w / 2, p.y - vp.h / 2), r, 0);
    expect(p.facing).toBeLessThan(0.05);
  });

  it('sizes the disc by zoom, as a fraction of the short side', () => {
    const c: Camera = { lat: 0, lon: 0, zoom: 1 };
    const r = discRadiusPx(c, vp);
    close(r * 2, Math.min(vp.w, vp.h), 0);
    const r2 = discRadiusPx({ ...c, zoom: 2 }, vp);
    close(r2, r * 2, 0);
  });
});

describe('arcPoints', () => {
  it('leaves the surface in the middle and lands on both places', () => {
    const a = { lat: 30, lon: 31 }, b = { lat: 35, lon: 44 };
    const pts = arcPoints(a, b, 24, 0.16);
    expect(pts).toHaveLength(25);
    const first = toLatLon(pts[0]), last = toLatLon(pts[24]);
    close(first.lat, a.lat, 4); close(last.lon, b.lon, 4);
    const radii = pts.map(p => Math.hypot(...p));
    expect(Math.max(...radii)).toBeGreaterThan(radii[0]);
    close(radii[0], 1.004, 4);
  });

  it('lifts a long journey more than a short hop', () => {
    const short = arcPoints({ lat: 0, lon: 0 }, { lat: 0, lon: 5 });
    const long = arcPoints({ lat: 0, lon: 0 }, { lat: 0, lon: 120 });
    expect(Math.max(...long.map(p => Math.hypot(...p)))).toBeGreaterThan(Math.max(...short.map(p => Math.hypot(...p))));
  });
});
