/** Pure deterministic arena simulation: one arena = one team's private battlefield, stepped at a fixed 20 Hz.
 *  Pipeline per tick (docs/02_NETWORK/04): players → enemy intent → collision → auto-target → projectiles → hits → regen/heal → objective damage → spawn schedule.
 *  The world only advances while the room is in an active phase (room.ts guards that); nothing here reads a clock, Math.random(), or the network. */
import type { Arena, Bullet, Config, EnemyEnt, EnemyKind, Fx, FxKind, Hazard, PlanWave, PlayerEnt, Role, SpawnEvt, Team, UpgradeKind } from './domain';
import { ABILITY, BOSS, BOSS_DEFS, CAPS, DIFFICULTY, ENEMY_DEFS, ENEMY_SPECIAL, ENEMY_UNLOCK_ORDER, LOW_PRESSURE, PASSIVE, REVIVE, ROLE_DEFS, UP, WAVE_START, WORLD, DT, DISCONNECT, TUNE, beaconHp, bossScale, threatCoef } from './balance';
import { MAPS, resolveObstacles, windAt, type MapDef } from './maps';
import { nextRandom, seedFrom } from './rng';
import { stepBoss } from './bosses';

export const rf = (a: Arena): number => { const [s, r] = nextRandom(a.rng); a.rng = s; return r; };
export const ri = (a: Arena, n: number): number => Math.floor(rf(a) * n);
export const fx = (a: Arena, k: FxKind, x: number, y: number, n?: number, tag?: string) => { if (a.fx.length < 80) a.fx.push(tag ? { k, x: Math.round(x), y: Math.round(y), n, a: tag } : n === undefined ? { k, x: Math.round(x), y: Math.round(y) } : { k, x: Math.round(x), y: Math.round(y), n }); };
const dist = Math.hypot;
export const up = (t: Team, k: UpgradeKind): number => t.upgrades[k] ?? 0;

export type SimCtx = {
  map: MapDef; cfg: Config; team: Team; wave: number; waves: number; connected: (pid: string) => boolean; roles: (pid: string) => Role;
  hpScale: number; dmgScale: number; tel: number; drafts: number; hasEngineer: boolean; assist: number;
};
export function makeCtx(cfg: Config, team: Team, wave: number, waves: number, roster: Record<string, { connected: boolean; role: Role; teamId: string; forfeited: boolean }>, draftsDone: number): SimCtx {
  const diff = DIFFICULTY[cfg.difficulty]; const progress = wave / Math.max(1, waves);
  const members = Object.values(roster).filter((m) => m.teamId === team.id && !m.forfeited);
  const n = Math.max(1, members.length);
  return {
    map: MAPS[cfg.mapId], cfg, team, wave, waves, connected: (pid) => !!roster[pid]?.connected, roles: (pid) => roster[pid]!.role,
    hpScale: TUNE.hpBase * diff.hp * (1 + TUNE.hpProgress * progress) * (1 - TUNE.hpTeam + TUNE.hpTeam * n), dmgScale: diff.dmg * (cfg.lowPressure ? LOW_PRESSURE.dmg : 1) * (1 + TUNE.dmgProgress * progress),
    tel: cfg.lowPressure ? LOW_PRESSURE.telegraph : 1, drafts: draftsDone, hasEngineer: members.some((m) => m.role === 'engineer'), assist: TUNE.smallTeamAssist[Math.min(5, n)] ?? 1,
  };
}

export function newArena(teamId: string, members: { id: string; role: Role }[], seed: number): Arena {
  const n = members.length;
  const players: Record<string, PlayerEnt> = {};
  members.forEach((m, i) => {
    const d = ROLE_DEFS[m.role]; const ang = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2;
    players[m.id] = { id: m.id, x: WORLD.bx + Math.cos(ang) * 54, y: WORLD.by + Math.sin(ang) * 54, hp: d.hp, maxHp: d.hp, ix: 0, iy: 0, face: 0, fireCd: 0, abilityCd: 0, abilityMax: d.abilityCd, healCd: PASSIVE.medicHealEvery, down: false, downTicks: 0, reviveTicks: 0, outWave: false, shield: 0, shieldTicks: 0, invuln: 0, slowTicks: 0, rootTicks: 0, burst: 0, burstCd: 0, dashTicks: 0, dx: 0, dy: 0, volleyLeft: 0, volleyCd: 0, lastTarget: 0, emergencyUsed: false, protectTicks: 0, damageDealt: 0, activeTicks: 0, downs: 0, revives: 0, abilityUses: 0, shots: 0 };
  });
  const max = beaconHp(n);
  return { teamId, nextId: 1, rng: seedFrom(`${seed}|arena`), status: 'alive', fellAtWave: null, players, enemies: [], bullets: [], hazards: [], turrets: [], drones: [], beacon: { hp: max, max, shield: 0, shieldTicks: 0, repaired: 0 }, waveTick: 0, waveTicks: 0, spawnPlan: [], spawnIdx: 0, waveClear: false, bossId: 0, bossDead: false, bossCollapse: 0, threat: 1, activeN: n, kills: 0, damageTaken: 0, enemiesSeen: [], fx: [], idleTicks: 0 };
}

// ── helpers ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
const alive = (p: PlayerEnt) => !p.down;
export const playerSpeed = (p: PlayerEnt, role: Role, team: Team): number => {
  let s = ROLE_DEFS[role].speed * (1 + UP.swiftStep * up(team, 'swift_steps'));
  if (p.burst > 0) s *= 1 + PASSIVE.scoutBurstBonus;
  if (p.slowTicks > 0) s *= 1 - 0.35;
  return s;
};
const damageMult = (team: Team) => Math.min(CAPS.damageMultCap, 1 + UP.fanExtraDmg * up(team, 'fan_bolts'));
function targetable(p: PlayerEnt): boolean { return !p.down && p.protectTicks <= 0; }

export function hurtPlayer(a: Arena, p: PlayerEnt, raw: number, ctx: SimCtx, role: Role): number {
  if (p.down || p.invuln > 0 || p.protectTicks > 0) return 0;
  let d = raw * ctx.dmgScale; if (role === 'guardian') d *= 1 - PASSIVE.guardianDR;
  d = Math.max(1, Math.round(d));
  if (p.shield > 0) { const ab = Math.min(p.shield, d); p.shield -= ab; d -= ab; if (p.shield <= 0) p.shieldTicks = 0; }
  if (d <= 0) { fx(a, 'shield', p.x, p.y); return 0; }
  p.hp -= d; a.damageTaken += d; fx(a, 'hit', p.x, p.y, d);
  if (p.hp <= 0) {
    const solo = Object.keys(a.players).length === 1;
    if (solo && ctx.cfg.lowPressure && !p.emergencyUsed) { p.emergencyUsed = true; p.hp = 1; p.invuln = 40; fx(a, 'revive', p.x, p.y); return d; }
    p.hp = 0; p.down = true; p.downTicks = 0; p.reviveTicks = 0; p.downs++; p.ix = 0; p.iy = 0; p.dashTicks = 0; fx(a, 'down', p.x, p.y);
  }
  return d;
}
function hurtBeacon(a: Arena, raw: number, ctx: SimCtx) {
  let d = raw * ctx.dmgScale * TUNE.beaconDmg;
  const g = Object.values(a.players).some((p) => alive(p) && ctx.roles(p.id) === 'guardian' && dist(p.x - WORLD.bx, p.y - WORLD.by) <= PASSIVE.guardianBeaconRange);
  if (g) d *= 1 - PASSIVE.guardianBeaconDR;
  d = Math.max(1, Math.round(d));
  if (a.beacon.shield > 0) { const ab = Math.min(a.beacon.shield, d); a.beacon.shield -= ab; d -= ab; if (a.beacon.shield <= 0) a.beacon.shieldTicks = 0; }
  if (d <= 0) return;
  a.beacon.hp = Math.max(0, a.beacon.hp - d); a.damageTaken += d; fx(a, 'beacon_hit', WORLD.bx, WORLD.by, d);
}
function nearestEnemy(a: Arena, x: number, y: number, range: number, skip?: number[]): EnemyEnt | null {
  let best: EnemyEnt | null = null, bd = range;
  for (const e of a.enemies) {
    if (e.hp <= 0 || e.state === 'spawn' || (skip && skip.includes(e.id))) continue;
    const d = dist(e.x - x, e.y - y) - e.radius;
    if (d < bd || (d === bd && best && e.id < best.id)) { bd = d; best = e; }
  }
  return best;
}
function spawnBullet(a: Arena, src: Bullet['src'], owner: string, x: number, y: number, ang: number, speed: number, dmg: number, r: number, ttl: number, jumps = 0) {
  if (a.bullets.length >= CAPS.bullets) return;
  a.bullets.push({ id: a.nextId++, src, owner, x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, dmg, ttl, r, jumps, hit: [], reflected: false });
}

// ── waves ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
function spawnPoint(a: Arena, map: MapDef, side: number): [number, number] {
  if (map.spawns !== 'ring') { const g = map.spawns[side % map.spawns.length]!; return [g.x + (rf(a) - 0.5) * 30, g.y + (rf(a) - 0.5) * 30]; }
  const inset = 10 + rf(a) * (WORLD.spawnRing - 20); const t = 0.05 + rf(a) * 0.9;
  switch (side % 4) { case 0: return [WORLD.w * t, inset]; case 1: return [WORLD.w - inset, WORLD.h * t]; case 2: return [WORLD.w * t, WORLD.h - inset]; default: return [inset, WORLD.h * t]; }
}
export function buildSpawnPlan(seed: number, wave: PlanWave, ctx: SimCtx, threat: number, mapId: SimCtx['map']): SpawnEvt[] {
  const a = { rng: seedFrom(`${seed}|w${wave.n}`) } as Arena; // identical stream for every arena: the prefix of a bigger budget equals a smaller one
  const unlocked = Math.min(ENEMY_UNLOCK_ORDER.length, Math.max(1, wave.n));
  const kinds = ENEMY_UNLOCK_ORDER.slice(0, wave.newKind ? ENEMY_UNLOCK_ORDER.indexOf(wave.newKind) + 1 : unlocked);
  const weights = kinds.map((k, i) => (k === wave.newKind ? 2.2 : 1) * (k === 'mite' ? 2.2 : k === 'brute' ? 0.45 : 1) * (1 + i * 0.05));
  const total = weights.reduce((x, y) => x + y, 0);
  let budget = wave.budget * threat; const out: SpawnEvt[] = [];
  const window = wave.boss ? wave.ticks * 0.9 : wave.ticks * WAVE_START.spawnWindow;
  const start = wave.n === 1 ? WAVE_START.firstWaveSpawnAt : 8;
  // controlled groups, not an opaque blob: 2–4 of one kind per group
  const groups: { kind: EnemyKind; n: number; side: number }[] = [];
  const baseSide = Math.floor(rf(a) * 4);
  let g = 0;
  while (budget > 0.5 && groups.length < 80) {
    let r = rf(a) * total, kind = kinds[0]!; for (let i = 0; i < kinds.length; i++) { r -= weights[i]!; if (r <= 0) { kind = kinds[i]!; break; } }
    const cost = ENEMY_DEFS[kind].cost; const n = Math.max(1, Math.min(Math.floor(budget / cost), 2 + Math.floor(rf(a) * 3)));
    budget -= n * cost;
    const side = wave.pattern === 'stream' ? baseSide : wave.pattern === 'flank' ? baseSide + (g % 2) * 2 : baseSide + g;
    groups.push({ kind, n, side }); g++;
  }
  groups.forEach((gr, gi) => {
    const at = Math.round(start + ((window - start) * (gi + rf(a) * 0.6)) / Math.max(1, groups.length));
    for (let i = 0; i < gr.n; i++) { const [x, y] = spawnPoint(a, ctx.map, gr.side); out.push({ at: at + i * 2, kind: gr.kind, x: x + (rf(a) - 0.5) * 24, y: y + (rf(a) - 0.5) * 24 }); }
  });
  void mapId;
  return out.sort((p, q) => p.at - q.at);
}
export function startWave(a: Arena, ctx: SimCtx, wave: PlanWave, seed: number, roster: Record<string, { forfeited: boolean; teamId: string }>) {
  const n = Math.max(1, Object.values(roster).filter((m) => m.teamId === a.teamId && !m.forfeited).length);
  a.activeN = n; a.threat = threatCoef(n); a.waveTick = 0; a.waveTicks = wave.ticks; a.spawnIdx = 0; a.waveClear = false;
  a.rng = seedFrom(`${seed}|combat${wave.n}`);
  a.spawnPlan = buildSpawnPlan(seed, wave, ctx, a.threat, ctx.map);
  a.bossId = 0; a.bossDead = !wave.boss; a.bossCollapse = 0; a.hazards = []; a.beacon.repaired = 0;
  for (const p of Object.values(a.players)) {
    if (p.outWave) { p.down = false; p.outWave = false; p.hp = Math.max(1, Math.round(p.maxHp * WAVE_START.returnHpFrac)); p.downTicks = 0; p.reviveTicks = 0; p.invuln = 20; }
    else if (!p.down) p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * WAVE_START.playerHeal));
    if (up(ctx.team, 'last_stand') > 0 && wave.n > (ctx.waves * 2) / 3 && !p.down) { p.shield = Math.min(Math.round(p.maxHp * CAPS.shieldFracOfBase), UP.lastStandBase + UP.lastStandStep * (up(ctx.team, 'last_stand') - 1)); p.shieldTicks = UP.lastStandTicks; fx(a, 'shield', p.x, p.y); }
  }
  a.beacon.hp = Math.min(a.beacon.max, a.beacon.hp + Math.round(a.beacon.max * WAVE_START.beaconRepair));
  if (wave.newKind && !a.enemiesSeen.includes(wave.newKind)) { a.enemiesSeen.push(wave.newKind); fx(a, 'banner', WORLD.bx, 40, undefined, wave.newKind); }
  if (wave.boss) { a.enemiesSeen.push(wave.boss.kind); fx(a, 'banner', WORLD.bx, 40, undefined, wave.boss.kind); }
}

function addEnemy(a: Arena, ctx: SimCtx, kind: EnemyKind, x: number, y: number): EnemyEnt | null {
  if (a.enemies.length >= CAPS.enemies) return null;
  const d = ENEMY_DEFS[kind]; const hp = Math.max(1, Math.round(d.hp * ctx.hpScale));
  const e: EnemyEnt = { id: a.nextId++, kind, boss: false, x, y, hp, maxHp: hp, dmg: d.dmg, speed: d.speed, radius: d.radius, state: 'spawn', st: 0, face: 0, target: null, tx: 0, ty: 0, flag: kind === 'runner' ? ENEMY_SPECIAL.runnerBurstEvery : kind === 'mirror' ? ENEMY_SPECIAL.mirrorEvery : 0, flag2: 0, slow: 0, slowTicks: 0, phase: 0, cd: 0, cd2: 0, idx: 0 };
  a.enemies.push(e); return e;
}
export { addEnemy };

function spawnSafe(a: Arena, x: number, y: number): [number, number] {
  for (const p of Object.values(a.players)) {
    const d = dist(x - p.x, y - p.y);
    if (d < WORLD.noSpawnNearPlayer) { const ux = d < 1e-6 ? 1 : (x - p.x) / d, uy = d < 1e-6 ? 0 : (y - p.y) / d; x = p.x + ux * WORLD.noSpawnNearPlayer; y = p.y + uy * WORLD.noSpawnNearPlayer; }
  }
  return [Math.min(WORLD.w - 10, Math.max(10, x)), Math.min(WORLD.h - 10, Math.max(10, y))];
}
export function spawnBoss(a: Arena, ctx: SimCtx, wave: PlanWave) {
  if (!wave.boss) return;
  const def = BOSS_DEFS[wave.boss.kind]; const players = a.activeN;
  const hp = Math.round(def.hp * TUNE.hpBase * 1.4 * bossScale(players) * (wave.boss.mini ? BOSS.miniScale : 1) * DIFFICULTY[ctx.cfg.difficulty].hp);
  const e: EnemyEnt = { id: a.nextId++, kind: wave.boss.kind, boss: true, x: WORLD.bx, y: 78, hp, maxHp: hp, dmg: 0, speed: def.speed, radius: def.radius, state: 'seek', st: 0, face: Math.PI / 2, target: null, tx: 0, ty: 0, flag: 0, flag2: 0, slow: 0, slowTicks: 0, phase: 0, cd: 60, cd2: 0, idx: 0 };
  a.enemies.push(e); a.bossId = e.id; a.bossDead = false;
}

// ── the tick ────────────────────────────────────────────────────────────────────────────────────────────────────────────
export function stepArena(a: Arena, ctx: SimCtx, wave: PlanWave): void {
  if (a.status !== 'alive') return;
  a.waveTick++;
  const team = ctx.team;
  // spawns scheduled for this tick
  if (a.waveTick === 40 && wave.boss && !a.bossId) spawnBoss(a, ctx, wave);
  while (a.spawnIdx < a.spawnPlan.length && a.spawnPlan[a.spawnIdx]!.at <= a.waveTick) {
    const s = a.spawnPlan[a.spawnIdx++]!; const [x, y] = spawnSafe(a, s.x, s.y); addEnemy(a, ctx, s.kind, x, y);
  }
  stepPlayers(a, ctx);
  const grid = buildGrid(a);
  stepEnemies(a, ctx, grid);
  stepSupport(a, ctx);
  stepBullets(a, ctx, grid);
  stepBoss(a, ctx, wave);
  reap(a, ctx);
  stepHealing(a, ctx);
  // status
  const members = Object.values(a.players);
  if (a.beacon.hp <= 0) fall(a, ctx.wave);
  else if (members.length > 0 && members.every((p) => p.down && p.outWave)) fall(a, ctx.wave);
  void team;
}
function fall(a: Arena, wave: number) { a.status = 'fallen'; a.fellAtWave = wave; a.enemies.length = 0; a.bullets.length = 0; a.hazards.length = 0; }

function buildGrid(a: Arena): Map<number, EnemyEnt[]> {
  const g = new Map<number, EnemyEnt[]>();
  for (const e of a.enemies) { const k = Math.floor(e.x / 64) * 64 + Math.floor(e.y / 64); const c = g.get(k); if (c) c.push(e); else g.set(k, [e]); }
  return g;
}
const cellKey = (cx: number, cy: number) => cx * 64 + cy;
function queryGrid(g: Map<number, EnemyEnt[]>, x: number, y: number, reach: number, fn: (e: EnemyEnt) => void) {
  const c0 = Math.floor((x - reach) / 64), c1 = Math.floor((x + reach) / 64), r0 = Math.floor((y - reach) / 64), r1 = Math.floor((y + reach) / 64);
  for (let cx = c0; cx <= c1; cx++) for (let cy = r0; cy <= r1; cy++) { const c = g.get(cellKey(cx, cy)); if (c) for (const e of c) fn(e); }
}

function stepPlayers(a: Arena, ctx: SimCtx) {
  const team = ctx.team; const ps = Object.values(a.players);
  for (const p of ps) {
    const role = ctx.roles(p.id); const rd = ROLE_DEFS[role]; const conn = ctx.connected(p.id);
    if (p.invuln > 0) p.invuln--; if (p.slowTicks > 0) p.slowTicks--; if (p.rootTicks > 0) p.rootTicks--; if (p.burst > 0) p.burst--; if (p.burstCd > 0) p.burstCd--;
    if (p.shieldTicks > 0 && --p.shieldTicks === 0) p.shield = 0;
    if (p.protectTicks > 0) p.protectTicks--;
    if (p.down) { if (!p.outWave && ++p.downTicks > REVIVE.rescueTicks) p.outWave = true; continue; }
    if (p.fireCd > 0) p.fireCd--; if (p.abilityCd > 0) p.abilityCd--;
    if (!conn) { p.ix = 0; p.iy = 0; continue; } // a disconnected avatar idles (protected for a bounded time, see room.disconnect); it neither moves nor fires
    p.activeTicks++;
    // movement
    if (p.dashTicks > 0) {
      p.dashTicks--; const [nx, ny] = resolveObstacles(ctx.map, p.x + p.dx, p.y + p.dy, WORLD.playerR); p.x = nx; p.y = ny;
    } else if (p.rootTicks === 0) {
      const sp = playerSpeed(p, role, team) * DT; const nx = p.x + p.ix * sp, ny = p.y + p.iy * sp;
      const [rx, ry] = resolveObstacles(ctx.map, nx, ny, WORLD.playerR); p.x = rx; p.y = ry;
      if (p.ix !== 0 || p.iy !== 0) p.face = Math.atan2(p.iy, p.ix);
    }
    // auto-fire
    const target = nearestEnemy(a, p.x, p.y, rd.range);
    if (target && p.fireCd === 0) shoot(a, p, role, target, team, ctx.assist);
    if (p.volleyLeft > 0) {
      if (--p.volleyCd <= 0) {
        const t = nearestEnemy(a, p.x, p.y, rd.range + 40);
        if (t) { const ang = Math.atan2(t.y - p.y, t.x - p.x); spawnBullet(a, 'player', p.id, p.x, p.y, ang + (p.volleyLeft % 2 ? 0.08 : -0.08), rd.bulletSpeed, Math.round(rd.dmg * 0.9 * ctx.assist), rd.bulletR, ttlFor(rd.range + 40, rd.bulletSpeed), up(team, 'ricochet')); p.shots++; }
        p.volleyLeft--; p.volleyCd = ABILITY.striker.spreadTicks;
      }
    }
  }
  // revive: a standing, connected ally within range for a couple of seconds, no extra button
  for (const d of ps) {
    if (!d.down || d.outWave) continue;
    const helper = ps.find((h) => !h.down && ctx.connected(h.id) && h.id !== d.id && dist(h.x - d.x, h.y - d.y) <= REVIVE.range);
    if (helper) {
      if (++d.reviveTicks >= REVIVE.needTicks) { d.down = false; d.hp = Math.max(1, Math.round(d.maxHp * REVIVE.hpFrac)); d.reviveTicks = 0; d.downTicks = 0; d.invuln = 20; helper.revives++; fx(a, 'revive', d.x, d.y); }
    } else d.reviveTicks = Math.max(0, d.reviveTicks - 1);
  }
}
const ttlFor = (range: number, speed: number) => Math.ceil((range / speed) * 20) + 2;
function shoot(a: Arena, p: PlayerEnt, role: Role, target: EnemyEnt, team: Team, assist: number) {
  const rd = ROLE_DEFS[role]; const ang = Math.atan2(target.y - p.y, target.x - p.x);
  const retarget = p.lastTarget !== target.id; p.lastTarget = target.id;
  let cd = rd.fireEvery; if (role === 'striker' && retarget) cd = Math.max(4, Math.round(cd * PASSIVE.strikerRetargetCd));
  p.fireCd = cd; p.shots++; p.face = ang;
  const jumps = up(team, 'ricochet'); const ttl = ttlFor(rd.range, rd.bulletSpeed);
  const base = Math.round((role === 'striker' ? Math.round(rd.dmg / 2) + 1 : rd.dmg) * assist); // twin bolt: two small bolts
  const offs = role === 'striker' ? [-5, 5] : [0];
  for (const o of offs) spawnBullet(a, 'player', p.id, p.x + Math.cos(ang + Math.PI / 2) * o, p.y + Math.sin(ang + Math.PI / 2) * o, ang, rd.bulletSpeed, base, rd.bulletR, ttl, jumps);
  const extra = Math.min(3, up(team, 'fan_bolts'));
  for (let i = 0; i < extra; i++) { const side = i % 2 === 0 ? 1 : -1; const k = Math.floor(i / 2) + 1; spawnBullet(a, 'player', p.id, p.x, p.y, ang + side * 0.16 * k, rd.bulletSpeed, Math.max(1, Math.round(rd.dmg * assist * UP.fanExtraDmg)), rd.bulletR - 1, ttl, jumps); }
}

/** One role ability, authorized here (cooldown + alive). The client only asks. */
export function castAbility(a: Arena, ctx: SimCtx, pid: string): boolean {
  const p = a.players[pid]; if (!p || p.down || p.abilityCd > 0 || !ctx.connected(pid) || a.status !== 'alive') return false;
  const role = ctx.roles(pid); const team = ctx.team; p.abilityCd = ROLE_DEFS[role].abilityCd; p.abilityMax = ROLE_DEFS[role].abilityCd; p.abilityUses++;
  switch (role) {
    case 'guardian': {
      const cap = Math.round(p.maxHp * CAPS.shieldFracOfBase);
      for (const q of Object.values(a.players)) if (!q.down && dist(q.x - p.x, q.y - p.y) <= ABILITY.guardian.radius) { q.shield = Math.min(cap, Math.round(q.maxHp * ABILITY.guardian.absorbFracOfBase)); q.shieldTicks = ABILITY.guardian.shieldTicks; }
      if (dist(WORLD.bx - p.x, WORLD.by - p.y) <= ABILITY.guardian.radius + WORLD.beaconR) { a.beacon.shield = ABILITY.guardian.beaconShield; a.beacon.shieldTicks = ABILITY.guardian.shieldTicks; }
      fx(a, 'pulse', p.x, p.y, ABILITY.guardian.radius, 'guardian'); break;
    }
    case 'striker': p.volleyLeft = ABILITY.striker.bolts; p.volleyCd = 0; fx(a, 'volley', p.x, p.y); break;
    case 'medic': {
      for (const q of Object.values(a.players)) if (!q.down && dist(q.x - p.x, q.y - p.y) <= ABILITY.medic.radius) { const h = Math.min(q.maxHp - q.hp, ABILITY.medic.heal); if (h > 0) { q.hp += h; fx(a, 'heal', q.x, q.y, h); } }
      const capRepair = Math.round(a.beacon.max * ABILITY.medic.beaconRepairCapFrac);
      if (dist(WORLD.bx - p.x, WORLD.by - p.y) <= ABILITY.medic.radius + WORLD.beaconR) { const r = Math.min(ABILITY.medic.beaconRepair, capRepair - a.beacon.repaired, a.beacon.max - a.beacon.hp); if (r > 0) { a.beacon.hp += r; a.beacon.repaired += r; fx(a, 'heal', WORLD.bx, WORLD.by, r); } }
      fx(a, 'mend', p.x, p.y, ABILITY.medic.radius); break;
    }
    case 'engineer': {
      a.turrets = a.turrets.filter((t) => t.owner !== pid);
      const d = Math.min(ABILITY.engineer.maxDist, 40); const x = Math.min(WORLD.w - 16, Math.max(16, p.x + Math.cos(p.face) * d)), y = Math.min(WORLD.h - 16, Math.max(16, p.y + Math.sin(p.face) * d));
      const [rx, ry] = resolveObstacles(ctx.map, x, y, 14); a.turrets.push({ id: a.nextId++, owner: pid, x: rx, y: ry, ttl: ABILITY.engineer.ttl, fireCd: 4 }); fx(a, 'turret', rx, ry); break;
    }
    case 'scout': {
      let dx = p.ix, dy = p.iy; if (dx === 0 && dy === 0) { dx = Math.cos(p.face); dy = Math.sin(p.face); }
      const n = Math.hypot(dx, dy) || 1; p.dx = (dx / n) * (ABILITY.scout.dash / ABILITY.scout.ticks); p.dy = (dy / n) * (ABILITY.scout.dash / ABILITY.scout.ticks);
      p.dashTicks = ABILITY.scout.ticks; p.invuln = Math.max(p.invuln, ABILITY.scout.invuln); fx(a, 'dash', p.x, p.y, Math.round((Math.atan2(dy, dx) * 180) / Math.PI)); break;
    }
  }
  void team; return true;
}

function eligibleTarget(a: Arena, e: EnemyEnt): { id: string; x: number; y: number; r: number } {
  const db = dist(e.x - WORLD.bx, e.y - WORLD.by) - WORLD.beaconR;
  if (db < 140) return { id: 'beacon', x: WORLD.bx, y: WORLD.by, r: WORLD.beaconR };
  let best: PlayerEnt | null = null, bd = 1e9;
  for (const p of Object.values(a.players)) { if (!targetable(p)) continue; const d = dist(p.x - e.x, p.y - e.y); if (d < bd || (d === bd && best && p.id < best.id)) { bd = d; best = p; } }
  if (best) return { id: best.id, x: best.x, y: best.y, r: WORLD.playerR };
  return { id: 'beacon', x: WORLD.bx, y: WORLD.by, r: WORLD.beaconR };
}
function stepEnemies(a: Arena, ctx: SimCtx, grid: Map<number, EnemyEnt[]>) {
  const glacier = Object.values(a.players).filter((p) => !p.down && up(ctx.team, 'glacier_field') > 0);
  const gl = up(ctx.team, 'glacier_field');
  for (const e of a.enemies) {
    if (e.boss || e.hp <= 0) continue;
    const def = ENEMY_DEFS[e.kind as EnemyKind];
    // slow aura (never stacks below the floor)
    let slow = 0; if (gl > 0) { const R = UP.glacierRadius + UP.glacierRadiusStep * gl; for (const p of glacier) if (dist(p.x - e.x, p.y - e.y) <= R) { slow = UP.glacierSlow + UP.glacierSlowStep * (gl - 1); break; } }
    if (e.slowTicks > 0) { e.slowTicks--; slow = Math.max(slow, e.slow); }
    const factor = Math.max(CAPS.enemySlowFloor, 1 - slow);
    if (e.kind === 'mirror') { e.flag--; if (e.flag <= -ENEMY_SPECIAL.mirrorTicks) e.flag = ENEMY_SPECIAL.mirrorEvery; }
    if (e.kind === 'runner') { e.flag--; if (e.flag <= -ENEMY_SPECIAL.runnerBurstTicks) e.flag = ENEMY_SPECIAL.runnerBurstEvery; }
    switch (e.state) {
      case 'spawn': if (++e.st >= 8) { e.state = 'seek'; e.st = 0; } break;
      case 'seek': {
        const t = eligibleTarget(a, e); e.target = t.id;
        const dx = t.x - e.x, dy = t.y - e.y, d = Math.hypot(dx, dy) || 1; const reach = e.radius + t.r + 8;
        if (d <= reach) { e.state = 'pre_attack'; e.st = 0; e.tx = t.x; e.ty = t.y; e.flag2 = 0; break; }
        let sp = e.speed * factor; if (e.kind === 'runner' && e.flag < 0) sp *= ENEMY_SPECIAL.runnerBurstMult;
        let nx = e.x + (dx / d) * sp * DT, ny = e.y + (dy / d) * sp * DT; e.face = Math.atan2(dy, dx);
        const [wx, wy] = windAt(ctx.map, e.x, e.y); nx += wx * DT; ny += wy * DT;
        queryGrid(grid, e.x, e.y, e.radius * 2, (o) => { if (o === e || o.boss) return; const ox = nx - o.x, oy = ny - o.y, od = Math.hypot(ox, oy), min = (e.radius + o.radius) * 0.8; if (od < min && od > 1e-6) { const push = (min - od) * 0.25; nx += (ox / od) * push; ny += (oy / od) * push; } });
        const bd = Math.hypot(nx - WORLD.bx, ny - WORLD.by), bmin = WORLD.beaconR + e.radius * 0.7; if (bd < bmin && bd > 1e-6) { nx = WORLD.bx + ((nx - WORLD.bx) / bd) * bmin; ny = WORLD.by + ((ny - WORLD.by) / bd) * bmin; }
        if (!def.fly) { const [rx, ry] = resolveObstacles(ctx.map, nx, ny, e.radius * 0.8); nx = rx; ny = ry; } else { nx = Math.min(WORLD.w, Math.max(0, nx)); ny = Math.min(WORLD.h, Math.max(0, ny)); }
        e.x = nx; e.y = ny; break;
      }
      case 'pre_attack': {
        if (++e.st >= Math.round(def.windup * ctx.tel)) {
          e.state = 'attack'; e.st = 0; const t = e.target;
          if (t && t !== 'beacon') { const p = a.players[t]; if (p) { e.tx = p.x; e.ty = p.y; } }
          if (e.kind === 'brute') { const d = Math.hypot(e.tx - e.x, e.ty - e.y) || 1; e.flag = Math.round(((e.tx - e.x) / d) * 1000); e.flag2 = Math.round(((e.ty - e.y) / d) * 1000); }
        }
        break;
      }
      case 'attack': {
        if (e.kind === 'brute') { // telegraphed charge along a locked line
          const sp = ENEMY_SPECIAL.bruteChargeSpeed * DT; const nx = e.x + (e.flag / 1000) * sp, ny = e.y + (e.flag2 / 1000) * sp;
          const [rx, ry] = resolveObstacles(ctx.map, nx, ny, e.radius * 0.8); e.x = rx; e.y = ry; e.face = Math.atan2(e.flag2, e.flag);
          for (const p of Object.values(a.players)) if (targetable(p) && dist(p.x - e.x, p.y - e.y) <= e.radius + WORLD.playerR + 6 && e.cd2 !== 1) { hurtPlayer(a, p, e.dmg, ctx, ctx.roles(p.id)); e.cd2 = 1; }
          if (dist(e.x - WORLD.bx, e.y - WORLD.by) <= e.radius + WORLD.beaconR + 6 && e.cd2 !== 1) { hurtBeacon(a, e.dmg, ctx); e.cd2 = 1; }
          if (++e.st >= ENEMY_SPECIAL.bruteChargeTicks) { e.state = 'recover'; e.st = 0; e.cd2 = 0; }
          break;
        }
        const t = e.target; let hit = false;
        if (t === 'beacon') { hurtBeacon(a, e.dmg, ctx); hit = true; }
        else if (t) {
          const p = a.players[t];
          if (p && dist(p.x - e.x, p.y - e.y) <= e.radius + WORLD.playerR + 14) { hurtPlayer(a, p, e.dmg, ctx, ctx.roles(p.id)); hit = true; if (e.kind === 'leech') { p.slowTicks = ENEMY_SPECIAL.leechSlowTicks; } }
          else if (p && ctx.roles(p.id) === 'scout' && p.burstCd <= 0 && !p.down) { p.burst = PASSIVE.scoutBurstTicks; p.burstCd = PASSIVE.scoutBurstCd; fx(a, 'dash', p.x, p.y, 0, 'evade'); }
        }
        void hit; e.state = 'recover'; e.st = 0; break;
      }
      case 'recover': if (++e.st >= def.recover) { e.state = 'seek'; e.st = 0; } break;
      default: break;
    }
  }
}

function stepSupport(a: Arena, ctx: SimCtx) {
  if (a.beacon.shieldTicks > 0 && --a.beacon.shieldTicks === 0) a.beacon.shield = 0;
  for (const t of a.turrets) {
    t.ttl--; if (t.fireCd > 0) t.fireCd--;
    if (t.fireCd === 0) { const e = nearestEnemy(a, t.x, t.y, ABILITY.engineer.range); if (e) { spawnBullet(a, 'turret', t.owner, t.x, t.y, Math.atan2(e.y - t.y, e.x - t.x), 360, Math.round(ABILITY.engineer.dmg * ctx.assist * damageMult(ctx.team)), 5, ttlFor(ABILITY.engineer.range, 360), up(ctx.team, 'ricochet')); t.fireCd = ABILITY.engineer.fireEvery; } }
  }
  a.turrets = a.turrets.filter((t) => t.ttl > 0);
  const lvl = up(ctx.team, 'gear_drone'); const bonus = lvl > 0 && ctx.hasEngineer ? Math.floor(ctx.drafts / 3) : 0; const want = Math.min(CAPS.drones, lvl + bonus);
  const living = Object.values(a.players).filter((p) => !p.down);
  while (a.drones.length < want && living.length) { const owner = living[a.drones.length % living.length]!; a.drones.push({ id: a.nextId++, owner: owner.id, ang: a.drones.length * Math.PI, fireCd: 8, x: owner.x, y: owner.y }); }
  if (a.drones.length > want) a.drones.length = want;
  for (const d of a.drones) {
    const o = a.players[d.owner]; const ox = o && !o.down ? o.x : WORLD.bx, oy = o && !o.down ? o.y : WORLD.by;
    d.ang += 0.12; d.x = ox + Math.cos(d.ang) * 34; d.y = oy + Math.sin(d.ang) * 34;
    if (d.fireCd > 0) d.fireCd--;
    if (d.fireCd === 0) { const e = nearestEnemy(a, d.x, d.y, UP.droneRange); if (e) { spawnBullet(a, 'drone', d.owner, d.x, d.y, Math.atan2(e.y - d.y, e.x - d.x), 360, UP.droneDmg, 4, ttlFor(UP.droneRange, 360)); d.fireCd = UP.droneEvery; } }
  }
}

function stepBullets(a: Arena, ctx: SimCtx, grid: Map<number, EnemyEnt[]>) {
  const keep: Bullet[] = [];
  for (const b of a.bullets) {
    b.x += b.vx * DT; b.y += b.vy * DT; b.ttl--;
    if (b.ttl <= 0 || b.x < -40 || b.x > WORLD.w + 40 || b.y < -40 || b.y > WORLD.h + 40) continue;
    if (b.src === 'hazard') { // boss orbs hurt avatars only
      let gone = false; for (const p of Object.values(a.players)) if (targetable(p) && dist(p.x - b.x, p.y - b.y) <= WORLD.playerR + b.r) { hurtPlayer(a, p, b.dmg, ctx, ctx.roles(p.id)); gone = true; break; }
      if (!gone) keep.push(b); continue;
    }
    let consumed = false;
    queryGrid(grid, b.x, b.y, 40, (e) => {
      if (consumed || e.hp <= 0 || e.state === 'spawn' || b.hit.includes(e.id)) return;
      if (dist(e.x - b.x, e.y - b.y) > e.radius + b.r) return;
      let dmg = b.dmg;
      if (e.kind === 'mirror' && e.flag < 0 && b.dmg <= ENEMY_SPECIAL.mirrorMaxDmg) { fx(a, 'reflect', e.x, e.y); consumed = true; return; }
      if (e.kind === 'beetle') { const fx0 = Math.cos(e.face), fy0 = Math.sin(e.face); const bl = Math.hypot(b.vx, b.vy) || 1; if ((-b.vx / bl) * fx0 + (-b.vy / bl) * fy0 > ENEMY_SPECIAL.beetleFrontArc) dmg *= 1 - ENEMY_SPECIAL.beetleArmor; }
      dmg = Math.max(1, Math.round(dmg)); e.hp -= dmg; fx(a, 'hit', e.x, e.y, dmg);
      const owner = a.players[b.owner]; if (owner) owner.damageDealt += dmg;
      b.hit.push(e.id);
      if (b.jumps > 0) {
        const nx = nearestEnemy(a, e.x, e.y, UP.ricochetRange, b.hit);
        if (nx) { const ang = Math.atan2(nx.y - e.y, nx.x - e.x); const sp = Math.hypot(b.vx, b.vy); b.vx = Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp; b.x = e.x; b.y = e.y; b.dmg = Math.max(1, b.dmg * UP.ricochetDmg); b.jumps--; b.ttl = Math.max(b.ttl, 8); return; }
      }
      consumed = true;
    });
    if (!consumed) keep.push(b);
  }
  a.bullets = keep;
}

function reap(a: Arena, ctx: SimCtx) {
  const dead = a.enemies.filter((e) => e.hp <= 0 && e.state !== 'dead');
  for (const e of dead) {
    e.state = 'dead'; a.kills++; fx(a, e.boss ? 'boss_down' : 'kill', e.x, e.y);
    if (e.boss) { a.bossCollapse = BOSS.collapseTicks; a.hazards = []; a.bullets = a.bullets.filter((b) => b.src !== 'hazard'); }
    if (e.kind === 'spore') for (let i = 0; i < ENEMY_SPECIAL.sporeSplit; i++) { const m = addEnemy(a, ctx, 'mite', e.x + (i ? 12 : -12), e.y); if (m) m.state = 'seek'; }
  }
  if (dead.length) a.enemies = a.enemies.filter((e) => e.state !== 'dead' || (e.boss && false));
  if (a.bossCollapse > 0 && --a.bossCollapse === 0) a.bossDead = true;
}
export type { Hazard, Fx };

function stepHealing(a: Arena, ctx: SimCtx) {
  const team = ctx.team; const ps = Object.values(a.players);
  for (const m of ps) {
    if (m.down || !ctx.connected(m.id) || ctx.roles(m.id) !== 'medic') continue;
    if (--m.healCd <= 0) {
      m.healCd = PASSIVE.medicHealEvery;
      let best: PlayerEnt | null = null, br = 2;
      for (const q of ps) { if (q.down || q.id === m.id || q.hp >= q.maxHp || dist(q.x - m.x, q.y - m.y) > PASSIVE.medicRange) continue; const r = q.hp / q.maxHp; if (r < br || (r === br && best && q.id < best.id)) { br = r; best = q; } }
      if (best) { best.hp = Math.min(best.maxHp, best.hp + PASSIVE.medicHeal); fx(a, 'heal', best.x, best.y, PASSIVE.medicHeal); }
      // a Medic standing near the beacon also mends it a little (shares the same per-match repair cap as the ability)
      if (dist(WORLD.bx - m.x, WORLD.by - m.y) <= PASSIVE.medicRange + WORLD.beaconR) { const cap = Math.round(a.beacon.max * ABILITY.medic.beaconRepairCapFrac); const r = Math.min(PASSIVE.medicBeaconMend, cap - a.beacon.repaired, a.beacon.max - a.beacon.hp); if (r > 0) { a.beacon.hp += r; a.beacon.repaired += r; fx(a, 'heal', WORLD.bx, WORLD.by, r); } }
    }
  }
  const g = up(team, 'mend_garden');
  if (g > 0 && a.waveTick % UP.gardenEvery === 0) for (const q of ps) if (!q.down && dist(q.x - WORLD.bx, q.y - WORLD.by) <= UP.gardenRange && q.hp < q.maxHp) { q.hp = Math.min(q.maxHp, q.hp + UP.gardenHeal * g); fx(a, 'heal', q.x, q.y, UP.gardenHeal * g); }
}

/** Disconnect policy (published to students): the avatar stays put and cannot be hit for 8 s, at most 3 times per match; it cannot fire either. */
export function protectOnDisconnect(a: Arena, pid: string, used: number): boolean {
  const p = a.players[pid]; if (!p || used >= DISCONNECT.maxProtections || p.down) return false;
  p.protectTicks = DISCONNECT.protectTicks; p.ix = 0; p.iy = 0; return true;
}
export function maxEnemyCount(): number { return CAPS.enemies; }
export { ENEMY_UNLOCK_ORDER };
