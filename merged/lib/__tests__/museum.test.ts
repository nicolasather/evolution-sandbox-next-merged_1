import rawDb from '@/data/db.json';
import { Engine } from '@/lib/engine';
import { routePaths } from '@/lib/routes';
import { nearLine } from '@/lib/near';
import { evidenceLine } from '@/components/fx/CeremonyStage';
import { getQuality, tunnelDuration, PARTICLE_SCALE } from '@/lib/perf';
import type { Db } from '@/lib/types';

const db = rawDb as unknown as Db;

/** Play the game to 100% so every route exists to be inspected. */
function played(): Engine {
  const e = new Engine(db);
  let progress = true;
  while (progress) {
    progress = false;
    for (const n of db.nodes) {
      if (e.has(n.id) || !e.isRecipeUnlocked(n.id)) continue;
      const r = n.rec.find(([a, b]) => e.has(a) && e.has(b));
      if (r && e.combine(r[0], r[1]).status === 'new') progress = true;
    }
  }
  return e;
}

describe('routePaths', () => {
  it('lists one path per recipe, walked ones first, and never invents a step', () => {
    const e = new Engine(db);
    e.waiveEraLock();                                // this test is about routes, not the era lock
    e.combine('wood', 'wood');                       // fire, by the only route the player has walked
    const fire = e.get('fire')!;
    const paths = routePaths(e, fire);
    expect(paths.length).toBe(fire.rec.length);
    expect(paths.map(p => p.index)).toEqual(paths.map((_, i) => i + 1));
    expect(paths[0].found).toBe(true);
    expect(paths.slice(1).every(p => !p.found && p.chain.length === 0)).toBe(true);
    // every chain member is a real discovery that precedes the one being explained
    for (const p of paths) for (const c of p.chain) expect(db.nodes.some(n => n.id === c.id)).toBe(true);
  });

  it('terminates on every discovery in the database (no cycles in the derivation)', () => {
    const e = played();
    for (const n of db.nodes) {
      const paths = routePaths(e, n);
      expect(paths.length).toBe(n.rec.length);
    }
  });
});

describe('nearLine', () => {
  it('never names anything and stays silent when a material has nothing left to give', () => {
    const e = new Engine(db);
    const line = nearLine(e, 'stone', 'wood');
    expect(line === null || typeof line.text === 'string').toBe(true);
    if (line) for (const n of db.nodes) expect(line.text).not.toContain(n.n);
    const done = played();
    expect(nearLine(done, 'stone', 'wood')).toBeNull();
  });
});

describe('evidenceLine', () => {
  it('says SOURCE NEEDED for an entry without a verified source, and counts otherwise', () => {
    const need = db.nodes.find(n => n.src.includes('source_required'))!;
    expect(evidenceLine(need)).toEqual({ text: 'Source needed', verified: false });
    const sourced = db.nodes.find(n => !n.src.includes('source_required') && n.src.length > 0)!;
    const ev = evidenceLine(sourced);
    expect(ev.verified).toBe(true);
    expect(ev.text).toMatch(/^Verified evidence · \d+ sources?$/);
  });
});

describe('perf tiers', () => {
  it('always resolves to one of three tiers and scales particles down, never up', () => {
    expect(['high', 'medium', 'low']).toContain(getQuality());
    expect(PARTICLE_SCALE.high).toBeGreaterThan(PARTICLE_SCALE.medium);
    expect(PARTICLE_SCALE.medium).toBeGreaterThan(PARTICLE_SCALE.low);
    const t = tunnelDuration('high');
    expect(t.tunnel).toBeGreaterThanOrEqual(tunnelDuration('low').tunnel);
  });
});

describe('time journey length', () => {
  it('runs 4 to 6 seconds on every tier', async () => {
    const { filmLength } = await import('@/lib/perf');
    for (const q of ['low', 'medium', 'high'] as const) {
      const ms = filmLength(q);
      expect(ms).toBeGreaterThanOrEqual(4000);
      expect(ms).toBeLessThanOrEqual(6000);
    }
  });
});
