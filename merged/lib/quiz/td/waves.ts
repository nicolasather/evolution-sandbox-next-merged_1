/** Deterministic wave plans. The first four waves are the GDD's teaching waves; boss waves follow the plan; later waves pack a seeded budget.
 *  Competitive squads receive the identical plan (same seed, same wave number), so the only difference between squads is what they built. */
import { rngFrom } from '../projector/rng';
import { ENEMIES, hpScale, speedScale, ticks, waveBudgetX10, MAX_SPAWNS_PER_WAVE } from './balance';
import type { TDBossId, TDEnemyKind, TDWavePlan, TDWaveSpawn } from './domain';

const TEACHING: Record<number, [TDEnemyKind, number][]> = {
  1: [['drifter', 6], ['zipper', 2]],
  2: [['drifter', 8], ['zipper', 3], ['bulwark', 1]],
  3: [['zipper', 4], ['warden', 4], ['drifter', 3]],
  4: [['sapper', 3], ['drifter', 5], ['splitter', 4]],
};
/** Which archetypes the budget may buy from a given wave on (introduced gradually, never all at once). */
const UNLOCK: [TDEnemyKind, number][] = [['drifter', 1], ['zipper', 1], ['bulwark', 2], ['warden', 3], ['sapper', 4], ['splitter', 4], ['skimmer', 5]];

export type WaveOpts = { seed: string; wave: number; boss: TDBossId | null; mini: boolean; lowPressure: boolean };

function packBudget(seed: string, wave: number, lowPressure: boolean): TDEnemyKind[] {
  const r = rngFrom(`${seed}:budget:${wave}`);
  const pool = UNLOCK.filter(([, w]) => w <= wave).map(([k]) => k);
  let budget = waveBudgetX10(wave, lowPressure); const out: TDEnemyKind[] = [];
  // a backbone of basic enemies keeps every wave readable, then seeded variety
  const backbone = Math.max(3, Math.round(budget / 10 / 4));
  for (let i = 0; i < backbone && budget >= ENEMIES.drifter.weightX10; i++) { out.push('drifter'); budget -= ENEMIES.drifter.weightX10; }
  let guard = 0;
  while (budget >= ENEMIES.drifter.weightX10 && out.length < 60 && guard++ < 400) {
    const k = r.pick(pool); const w = ENEMIES[k].weightX10;
    if (w <= budget) { out.push(k); budget -= w; }
  }
  return out;
}

/** Spawn timing: small groups with breathing room, slow tanks spaced further apart. Pure integer ticks. */
function schedule(seed: string, wave: number, kinds: TDEnemyKind[], startId: number): TDWaveSpawn[] {
  const r = rngFrom(`${seed}:order:${wave}`);
  const order = wave <= 4 ? kinds : r.shuffle(kinds);
  // enemies march in readable groups (tight inside a group, a clear gap between groups): area and chain towers then have real targets
  const out: TDWaveSpawn[] = []; let t = ticks(1); let inGroup = 0; const groupSize = 4 + (wave % 2);
  order.forEach((kind, i) => {
    const e = ENEMIES[kind];
    out.push({ id: startId + i, kind, tick: t, hp: Math.round(e.hp * hpScale(wave)), armor: e.armorPct, speed: Math.round(e.speed * speedScale(wave)) });
    inGroup++;
    const gap = kind === 'bulwark' ? ticks(0.9) : kind === 'zipper' ? ticks(0.35) : ticks(0.45);
    t += gap; if (inGroup >= groupSize) { inGroup = 0; t += ticks(2.2); }
  });
  return out;
}

export function planWave(o: WaveOpts): TDWavePlan {
  let kinds: TDEnemyKind[];
  if (o.boss) kinds = ['zipper', 'zipper', 'zipper', 'zipper', 'bulwark', 'bulwark'];
  else if (TEACHING[o.wave]) kinds = TEACHING[o.wave]!.flatMap(([k, n]) => Array.from({ length: n }, () => k));
  else kinds = packBudget(o.seed, o.wave, o.lowPressure);
  kinds = kinds.slice(0, MAX_SPAWNS_PER_WAVE - 4);
  const spawns = schedule(o.seed, o.wave, kinds, 1);
  if (o.boss) {
    const last = spawns.length ? spawns[spawns.length - 1]!.tick : 0;
    const e = ENEMIES.colossus;
    const hp = Math.round(e.hp * hpScale(o.wave) * (o.mini ? 0.6 : 1));
    // the boss enters after the escorts have started moving (a 600 ms slide-in is drawn on the client)
    spawns.splice(Math.min(2, spawns.length), 0, { id: 0, kind: 'colossus', tick: Math.min(last, ticks(3)), hp, armor: e.armorPct, speed: Math.round(e.speed * speedScale(o.wave)), boss: o.boss, mini: o.mini });
    spawns.sort((a, b) => a.tick - b.tick || a.id - b.id);
  }
  const budget = kinds.reduce((n, k) => n + ENEMIES[k].weightX10, 0);
  return { wave: o.wave, spawns, boss: o.boss, budget, archetypes: [...new Set(spawns.map((s) => s.kind))] };
}
