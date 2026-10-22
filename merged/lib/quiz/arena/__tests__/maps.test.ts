import { MAP_IDS } from '../domain';
import { geometryFor, resolve, walkDistance, distanceField, cellOf, steer } from '../maps';
import { PLAYER_R, WORLD } from '../balance';

const inside = (g: ReturnType<typeof geometryFor>, p: { x: number; y: number }, pad = PLAYER_R) => g.solids.some((o) => Math.hypot(p.x - o.x, p.y - o.y) < o.r + pad - 2);
describe.each(MAP_IDS.flatMap((m) => [2, 3, 4].map((n) => [m, n] as const)))('map %s with %i squads', (mapId, n) => {
  const g = geometryFor(mapId, n);
  it('has one base, vault, five spawn spots and three gates per squad, three zones, nodes and a banner spawn', () => {
    expect(g.bases).toHaveLength(n); expect(g.vaults).toHaveLength(n); expect(g.spawns.every((s) => s.length === 5)).toBe(true); expect(g.checkpoints.every((c) => c.length === 3)).toBe(true);
    expect(g.zones).toHaveLength(3); expect(g.nodes.filter((x) => x.hot)).toHaveLength(3); expect(g.nodes.filter((x) => !x.hot)).toHaveLength(n * 6); expect(g.gates).toHaveLength(n * 2);
  });
  it('keeps every objective, spawn and vault in the open world, never inside a solid', () => {
    const pts = [...g.spawns.flat(), ...g.vaults, ...g.zones, ...g.checkpoints.flat(), ...g.nodes, g.banner];
    for (const p of pts) { expect(p.x).toBeGreaterThan(PLAYER_R); expect(p.x).toBeLessThan(WORLD - PLAYER_R); expect(p.y).toBeGreaterThan(PLAYER_R); expect(p.y).toBeLessThan(WORLD - PLAYER_R); expect(inside(g, p, PLAYER_R + 4)).toBe(false); }
  });
  it('lets every squad walk from every spawn to every zone, checkpoint, node and its vault WITHOUT any bridge', () => {
    for (let s = 0; s < n; s++) for (const sp of g.spawns[s]!) {
      for (const t of [...g.zones, ...g.checkpoints[s]!, g.vaults[s]!, g.banner, ...g.nodes]) expect(Number.isFinite(walkDistance(g, sp, t))).toBe(true);
    }
  });
  it('mirrors travel: each squad has an identical walk to ITS OWN vault, gates and checkpoints', () => {
    const d = (s: number) => [walkDistance(g, g.spawns[s]![0]!, g.checkpoints[s]![0]!), walkDistance(g, g.checkpoints[s]![2]!, g.vaults[s]!), walkDistance(g, g.vaults[s]!, g.banner)];
    const base = d(0); for (let s = 1; s < n; s++) { const x = d(s); x.forEach((v, i) => expect(Math.abs(v - base[i]!)).toBeLessThanOrEqual(base[i]! * 0.06 + 30)); }
  });
  it('keeps the shared central zones within one second of walking (160 units) across squads, and the hub within 6%', () => {
    for (const z of g.zones) { const ds = Array.from({ length: n }, (_, s) => walkDistance(g, g.spawns[s]![0]!, z)); expect(Math.max(...ds) - Math.min(...ds)).toBeLessThanOrEqual(160); }
    const hub = Array.from({ length: n }, (_, s) => walkDistance(g, g.spawns[s]![0]!, g.banner)); expect((Math.max(...hub) - Math.min(...hub)) / Math.max(...hub)).toBeLessThanOrEqual(0.06);
  });
  it('has bridge gates that really shorten or open a route, and nothing else changes when one is opened', () => {
    for (const gate of g.gates) {
      const open = new Set([gate.id]); const a = walkDistance(g, g.spawns[gate.slot]![0]!, g.zones[0]!), b = walkDistance(g, g.spawns[gate.slot]![0]!, g.zones[0]!, open);
      expect(b).toBeLessThanOrEqual(a);
    }
    expect(resolve(g, g.zones[0]!.x, g.zones[0]!.y, null)).toEqual([g.zones[0]!.x, g.zones[0]!.y]);
  });
  it('resolves collisions out of a solid and the nav field steers toward the target', () => {
    const o = g.solids[0]!; const [x, y] = resolve(g, o.x, o.y, null); for (const q of g.solids) expect(Math.hypot(x - q.x, y - q.y)).toBeGreaterThanOrEqual(q.r + PLAYER_R - 3);
    const f = distanceField(g, g.zones[0]!); expect(f[cellOf(g.zones[0]!)]).toBe(0);
    const v = steer(g, g.spawns[0]![0]!, g.zones[0]!); expect(Math.hypot(v.x, v.y)).toBeGreaterThan(0.9);
  });
});
