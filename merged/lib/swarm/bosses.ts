/** Three boss encounters. Every hazard is telegraphed with the exact geometry that later hurts (the renderer draws these same fields),
 *  and everything is tick-driven, so a quiz freeze simply stops it and the remaining telegraph resumes untouched. */
import type { Arena, EnemyEnt, Hazard, HazardKind, PlanWave } from './domain';
import { BOSS, BOSS_DEFS, CAPS, PASSIVE, WORLD } from './balance';
import { fx, rf, ri, addEnemy, hurtPlayer, type SimCtx } from './sim';

const D2R = Math.PI / 180;
const angDiff = (a: number, b: number) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d); };
const norm = (a: number) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

function addHazard(a: Arena, h: Partial<Hazard> & { kind: HazardKind; x: number; y: number; telegraph: number; dmg: number; src: number }) {
  if (a.hazards.length >= CAPS.hazards) return;
  a.hazards.push({ id: a.nextId++, a0: 0, a1: 0, w: 0, r0: 0, r1: 0, gapA: 0, gapW: 0, telegraphMax: h.telegraph, active: 0, activeMax: 0, t: 0, hit: [], ...h });
}
const aliveTargets = (a: Arena) => Object.values(a.players).filter((p) => !p.down && p.protectTicks <= 0);
function aimAt(a: Arena, b: EnemyEnt): number {
  let best = 1e9, ang = Math.PI / 2;
  for (const p of aliveTargets(a)) { const d = Math.hypot(p.x - b.x, p.y - b.y); if (d < best) { best = d; ang = Math.atan2(p.y - b.y, p.x - b.x); } }
  return ang;
}
/** Boss adds scale gently with team size (never more than the cap allows). */
const summons = (a: Arena, base: number) => Math.max(1, Math.round(base * (a.activeN <= 1 ? 0.5 : a.activeN <= 3 ? 0.75 : 1)));
const phaseOf = (b: EnemyEnt) => (b.hp / b.maxHp > 0.65 ? 0 : b.hp / b.maxHp > 0.3 ? 1 : 2);

/** The hazard geometry test used by BOTH the server (damage) and the renderer (overlay): one definition, no drift. */
export function inHazard(h: Hazard, px: number, py: number, pr: number): boolean {
  const dx = px - h.x, dy = py - h.y, d = Math.hypot(dx, dy);
  if (h.kind === 'arc') return d <= h.r1 + pr && d >= h.r0 && angDiff(Math.atan2(dy, dx), h.a0) <= h.w + pr / Math.max(40, d);
  if (h.kind === 'ring') { if (d < h.r0 - pr || d > h.r1 + pr) return false; return angDiff(Math.atan2(dy, dx), h.gapA) > h.gapW; }
  if (h.kind === 'root') return d <= h.r1 + pr;
  if (h.kind === 'beam') {
    const prog = h.activeMax > 0 ? Math.min(1, h.t / h.activeMax) : 0; const ang = h.a0 + (h.a1 - h.a0) * prog;
    const ux = Math.cos(ang), uy = Math.sin(ang); const along = dx * ux + dy * uy; if (along < 0 || along > h.r1) return false;
    return Math.abs(-dx * uy + dy * ux) <= h.w + pr;
  }
  return false;
}
export const beamAngle = (h: Hazard): number => h.a0 + (h.a1 - h.a0) * (h.activeMax > 0 ? Math.min(1, h.t / h.activeMax) : 0);

export function stepBoss(a: Arena, ctx: SimCtx, wave: PlanWave): void {
  // hazards advance every tick regardless of the boss still standing (the telegraph already shown must resolve fairly)
  for (const h of a.hazards) stepHazard(a, ctx, h);
  a.hazards = a.hazards.filter((h) => !(h.telegraph <= 0 && h.t >= h.activeMax));
  const b = a.enemies.find((e) => e.id === a.bossId && e.boss);
  if (!b || !wave.boss || b.hp <= 0) return;
  const def = BOSS_DEFS[wave.boss.kind]; const tel = ctx.tel;
  const ph = phaseOf(b); if (ph !== b.phase) { b.phase = ph; fx(a, 'boss_phase', b.x, b.y, ph); b.cd = Math.max(b.cd, 40); }
  // drift: keep a respectful distance from avatars; never pin them
  const t = aliveTargets(a).sort((p, q) => Math.hypot(p.x - b.x, p.y - b.y) - Math.hypot(q.x - b.x, q.y - b.y))[0];
  if (t) { const d = Math.hypot(t.x - b.x, t.y - b.y); const dir = d > 165 ? 1 : d < 105 ? -1 : 0; const ang = Math.atan2(t.y - b.y, t.x - b.x); b.x = Math.min(WORLD.w - 80, Math.max(80, b.x + Math.cos(ang) * def.speed * 0.05 * dir)); b.y = Math.min(WORLD.h - 80, Math.max(80, b.y + Math.sin(ang) * def.speed * 0.05 * dir)); b.face = ang; }
  if (b.cd > 0) { b.cd--; return; }
  switch (wave.boss.kind) {
    case 'marrow_drum': drum(a, ctx, b, ph, tel); break;
    case 'glass_heron': heron(a, ctx, b, ph, tel); break;
    case 'orchard_engine': engine(a, ctx, b, ph, tel); break;
  }
}

function stepHazard(a: Arena, ctx: SimCtx, h: Hazard) {
  if (h.telegraph > 0) {
    h.telegraph--;
    if (h.telegraph === 0) { // resolves
      if (h.kind === 'arc' || h.kind === 'ring' || h.kind === 'root') {
        for (const p of Object.values(a.players)) if (!p.down && p.protectTicks <= 0 && inHazard(h, p.x, p.y, 10)) { hurtPlayer(a, p, h.dmg, ctx, ctx.roles(p.id)); if (h.kind === 'root') p.rootTicks = 10; }
        fx(a, 'pulse', h.x, h.y, h.r1, h.kind); h.activeMax = 4; h.t = 0;
      } else if (h.kind === 'beam') { h.t = 0; }
    }
    return;
  }
  h.t++;
  if (h.kind === 'beam') for (const p of Object.values(a.players)) if (!p.down && p.protectTicks <= 0 && !h.hit.includes(p.id) && inHazard(h, p.x, p.y, WORLD.playerR * 0.5)) { h.hit.push(p.id); hurtPlayer(a, p, h.dmg, ctx, ctx.roles(p.id)); }
}

function arcs(a: Arena, b: EnemyEnt, centre: number, count: number, tel: number, dmg: number, reach: number) {
  for (let i = 0; i < count; i++) addHazard(a, { kind: 'arc', x: b.x, y: b.y, a0: norm(centre + (i * 2 * Math.PI) / count), w: BOSS.drum.arcHalfDeg * D2R, r0: b.radius * 0.5, r1: reach, telegraph: Math.round(BOSS.telegraph.arc * tel), dmg, src: b.id });
}
function ring(a: Arena, b: EnemyEnt, r0: number, r1: number, gapDeg: number, tel: number, dmg: number, gapA?: number) {
  addHazard(a, { kind: 'ring', x: b.x, y: b.y, r0, r1, gapA: gapA ?? norm(rf(a) * 2 * Math.PI - Math.PI), gapW: (gapDeg * D2R) / 2, telegraph: Math.round(BOSS.telegraph.ring * tel), dmg, src: b.id });
}
function drum(a: Arena, ctx: SimCtx, b: EnemyEnt, ph: number, tel: number) {
  const d = BOSS.drum; const aim = aimAt(a, b);
  if (ph === 0) { arcs(a, b, aim, d.arcCount, tel, d.arcDmg, d.arcReach); fx(a, 'boss_phase', b.x, b.y, 10); b.cd = 80 + Math.round(20 * tel); return; }
  if (ph === 1) {
    b.idx++;
    if (b.idx % 2 === 0) ring(a, b, 110, 230, d.ringGapDeg + 6, tel, d.ringDmg, aim);
    else for (let i = 0; i < summons(a, d.summonCount); i++) { const ang = rf(a) * Math.PI * 2; addEnemy(a, ctx, 'mite', Math.min(WORLD.w - 20, Math.max(20, b.x + Math.cos(ang) * (b.radius + 20))), Math.min(WORLD.h - 20, Math.max(20, b.y + Math.sin(ang) * (b.radius + 20)))); }
    b.cd = d.summonEvery; return;
  }
  // phase C: two successive warning arcs, then 1.5 s recovery
  arcs(a, b, aim, d.arcCount, tel, d.arcDmg, d.arcReach);
  const first = Math.round(BOSS.telegraph.arc * tel) + 4;
  b.cd = first + BOSS.recover + 30;
  const delayed = { kind: 'arc' as const, x: b.x, y: b.y, w: d.arcHalfDeg * D2R, r0: b.radius * 0.5, r1: d.arcReach, dmg: d.arcDmg, src: b.id };
  for (let i = 0; i < d.arcCount; i++) addHazard(a, { ...delayed, a0: norm(aim + Math.PI / d.arcCount + (i * 2 * Math.PI) / d.arcCount), telegraph: Math.round((BOSS.telegraph.arc + 22) * tel) });
}
function heron(a: Arena, ctx: SimCtx, b: EnemyEnt, ph: number, tel: number) {
  const h = BOSS.heron; const aim = aimAt(a, b); const deg = ph === 2 ? h.sweepDegC : h.sweepDegA;
  b.idx++; const dir = ri(a, 2) === 0 ? 1 : -1; // seed-deterministic side
  const sweep = (rot: number, extraDelay = 0) => addHazard(a, { kind: 'beam', x: b.x, y: b.y, a0: norm(aim - (dir * deg * D2R) / 2 + rot), a1: norm(aim + (dir * deg * D2R) / 2 + rot), w: h.beamHalf, r1: h.beamLen, telegraph: Math.round(BOSS.telegraph.beam * tel) + extraDelay, activeMax: h.sweepTicks, dmg: h.beamDmg, src: b.id });
  sweep(0);
  if (ph >= 1) { for (let i = 0; i < summons(a, 2); i++) { const ang = rf(a) * Math.PI * 2; addEnemy(a, ctx, 'mirror', Math.min(WORLD.w - 20, Math.max(20, b.x + Math.cos(ang) * 70)), Math.min(WORLD.h - 20, Math.max(20, b.y + Math.sin(ang) * 70))); } }
  if (ph === 2) sweep(Math.PI, Math.round(h.sweepTicks * 0.5 * 1) + 8);
  b.cd = Math.round(BOSS.telegraph.beam * tel) + h.sweepTicks + (ph === 2 ? 70 : 40);
}
function engine(a: Arena, _ctx: SimCtx, b: EnemyEnt, ph: number, tel: number) {
  const e = BOSS.engine;
  if (ph === 0) { // slow radial projectiles with two clear gaps
    const gaps = [ri(a, e.orbCount), 0]; gaps[1] = (gaps[0]! + e.orbCount / 2) % e.orbCount;
    for (let i = 0; i < e.orbCount; i++) { if (gaps.some((g) => i === g || i === (g + 1) % e.orbCount)) continue; const ang = (i / e.orbCount) * Math.PI * 2 + b.idx * 0.13; a.bullets.push({ id: a.nextId++, src: 'hazard', owner: String(b.id), x: b.x, y: b.y, vx: Math.cos(ang) * e.orbSpeed, vy: Math.sin(ang) * e.orbSpeed, dmg: e.orbDmg, ttl: 140, r: 8, jumps: 0, hit: [], reflected: false }); }
    b.idx++; fx(a, 'pulse', b.x, b.y, 80, 'orbs'); b.cd = 50; return;
  }
  if (ph === 1) { // root tiles near avatars, outlined 1.1 s before they trigger
    const ts = aliveTargets(a); const n = Math.min(3, Math.max(1, ts.length));
    for (let i = 0; i < n; i++) { const p = ts[(ri(a, ts.length) + i) % Math.max(1, ts.length)]; if (!p) continue; addHazard(a, { kind: 'root', x: Math.min(WORLD.w - 40, Math.max(40, p.x + (rf(a) - 0.5) * 60)), y: Math.min(WORLD.h - 40, Math.max(40, p.y + (rf(a) - 0.5) * 60)), r1: e.rootR, telegraph: Math.round(BOSS.telegraph.root * tel), dmg: e.rootDmg, src: b.id }); }
    b.cd = 70; return;
  }
  ring(a, b, 70, 210, 44, tel, e.pulseDmg); b.cd = e.pulseEvery;
}
export { PASSIVE };
