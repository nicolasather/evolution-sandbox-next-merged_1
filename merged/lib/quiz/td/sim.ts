/** Deterministic wave simulation at a 20 Hz logical tick, integer state only.
 *
 *  The SERVER runs a whole wave in one call when the build phase closes (`runWave`) and stores the result: that is the authoritative outcome.
 *  Every BROWSER receives the same frozen input and replays it tick by tick (`WaveSim.step`) to draw the battle. Same code + same input +
 *  integer arithmetic ⇒ the same kills, leaks and core health on every device, whatever its frame rate. The client never decides damage.
 *  Movement uses distance along the lane; range checks use squared integer distances; ties are broken by (progress, id). */
import {
  ARMOR_MELT_PCT, BEACON_LEVEL_AURA, BEACON_TEAM_CAP_PCT, BOSS_TELEGRAPH_TICKS, ENEMIES, LEVEL_DAMAGE_PCT, LEVEL_RANGE_PCT,
  LOW_PRESSURE_BOSS_LEAK, MAX_ACTIVE_ENEMIES, MAX_BOSS_WAVE_TICKS, MAX_SLOW_PCT, MAX_WAVE_TICKS, SALVO_DAMAGE, SALVO_RADIUS, SPLIT_CHILD_HP_PCT, TOWERS, hpScale, speedScale, ticks,
} from './balance';
import type { TDBossId, TDEnemyKind, TDTowerKind, TDWaveInput, TDWaveResult } from './domain';
import { mapPath, MAPS, padCenter } from './maps';
import { dist2, pointAt, type PathData, type Pt } from './path';

export type SimEnemy = {
  id: number; kind: TDEnemyKind; hp: number; maxHp: number; armor: number; speed: number; d: number; alive: boolean;
  flying: boolean; shield: number; slowPct: number; slowUntil: number; poison: { dps: number; until: number; src: string }[]; armorDebuff: number; armorDebuffUntil: number;
  sprintUntil: number; sprinted: boolean; jammed: boolean; boss: TDBossId | null; mini: boolean;
  // boss runtime
  phase: number; nextCycle: number; teleKind: string | null; teleUntil: number; immuneUntil: number; armorUpUntil: number; surgeUntil: number; reduceUntil: number;
  dropped: boolean; cracked: boolean; spawnedAt: number; nextSummon: number; landed: boolean;
};
export type SimTower = {
  id: string; padId: string; kind: TDTowerKind; level: 1 | 2 | 3; branch: string | null; targeting: string; pos: Pt;
  range: number; damage: number; cooldown: number; nextFire: number; jammedUntil: number; disabled: boolean; dmgDone: number; boostPct: number; reinforced: boolean;
};
export type SimEvent =
  | { t: 'spawn'; tick: number; e: number; kind: TDEnemyKind }
  | { t: 'fire'; tick: number; tower: string; target: number }
  | { t: 'hit'; tick: number; e: number; dmg: number; src: string; blocked?: boolean }
  | { t: 'chain'; tick: number; tower: string; ids: number[] }
  | { t: 'splash'; tick: number; tower: string; at: Pt; r: number }
  | { t: 'slow'; tick: number; e: number }
  | { t: 'poison'; tick: number; e: number; stacks: number }
  | { t: 'kill'; tick: number; e: number }
  | { t: 'leak'; tick: number; e: number; dmg: number; blocked: boolean }
  | { t: 'split'; tick: number; parent: number; children: number[] }
  | { t: 'jam'; tick: number; tower: string; e: number; purified: boolean }
  | { t: 'boss'; tick: number; e: number; what: string; ref?: string }
  | { t: 'salvo'; tick: number; at: Pt }
  | { t: 'retreat'; tick: number; count: number };

const CHAIN_REACH = 2000; // milli-tiles between chain hops
const NEAR = 1500; // "next to" for secondary effects

export class WaveSim {
  readonly path: PathData; tick = 0; core: number; readonly maxCore: number; done = false;
  enemies: SimEnemy[] = []; towers: SimTower[] = []; private spawnIdx = 0; private nextId = 1000;
  leaks = 0; kills = 0; blocked = 0; purified = 0; coreDamage = 0; retreated = 0; cracked: string | null = null; bossDefeated: boolean | null = null;
  private protect: number; private purify: number; private salvo: number[]; private readonly maxTicks: number; private readonly input: TDWaveInput;
  private readonly splashPct: number; private readonly statusPct: number;

  constructor(input: TDWaveInput) {
    this.input = input; this.path = mapPath(input.mapId); this.core = input.coreHP; this.maxCore = input.maxCoreHP;
    this.protect = input.armed.protect; this.purify = input.armed.purify; this.salvo = [...input.armed.salvo].sort((a, b) => a - b);
    this.maxTicks = input.boss ? MAX_BOSS_WAVE_TICKS : MAX_WAVE_TICKS;
    this.splashPct = input.roleMods.splashPct; this.statusPct = input.roleMods.statusPct;
    const map = MAPS[input.mapId];
    const sorted = [...input.towers].sort((a, b) => (a.padId < b.padId ? -1 : a.padId > b.padId ? 1 : 0));
    for (const t of sorted) {
      const pad = map.pads.find((p) => p.id === t.padId); if (!pad) continue;
      const st = TOWERS[t.kind]; const lv = t.level - 1;
      let range = Math.round((st.range * LEVEL_RANGE_PCT[lv]!) / 100); if (t.reinforced) range = Math.round((range * 115) / 100);
      if (t.kind === 'beacon' && t.branch === 'range_aura') range += 1000;
      this.towers.push({ id: t.id, padId: t.padId, kind: t.kind, level: t.level, branch: t.branch, targeting: t.targeting, pos: padCenter(pad), range, damage: Math.round((st.damage * LEVEL_DAMAGE_PCT[lv]!) / 100), cooldown: st.cooldownTicks, nextFire: 0, jammedUntil: -1, disabled: false, dmgDone: 0, boostPct: 0, reinforced: t.reinforced });
    }
    // Beacon aura: nearby towers fire faster, capped per tower
    for (const b of this.towers.filter((x) => x.kind === 'beacon')) {
      const aura = BEACON_LEVEL_AURA[b.level - 1]! + (b.branch === 'range_aura' ? 5 : 0);
      for (const t of this.towers) if (t !== b && t.kind !== 'beacon' && dist2(t.pos, b.pos) <= b.range * b.range) t.boostPct = Math.min(BEACON_TEAM_CAP_PCT + (b.branch === 'range_aura' ? 5 : 0), t.boostPct + aura);
    }
    for (const t of this.towers) if (t.cooldown > 0) { t.cooldown = Math.max(4, Math.round((t.cooldown * 100) / (100 + t.boostPct))); t.nextFire = Math.floor(t.cooldown / 3); }
  }

  pos(e: SimEnemy): Pt { return pointAt(this.path, e.d); }
  private alive() { return this.enemies.filter((e) => e.alive); }
  private effSpeed(e: SimEnemy): number {
    let pct = 100 - (this.tick < e.slowUntil ? e.slowPct : 0);
    if (this.tick < e.sprintUntil) pct = (pct * (100 + (ENEMIES[e.kind].sprint?.pct ?? 0))) / 100;
    if (e.boss && this.tick < e.surgeUntil) pct = (pct * 160) / 100;
    if (e.boss === 'skywork_leviathan' && e.phase >= 3) pct = (pct * 85) / 100;
    return Math.max(1, Math.floor((e.speed * pct) / 100));
  }
  private add(kind: TDEnemyKind, hp: number, d: number, extra: Partial<SimEnemy> = {}, ev?: SimEvent[]): SimEnemy {
    const st = ENEMIES[kind];
    const e: SimEnemy = {
      id: this.nextId++, kind, hp, maxHp: hp, armor: st.armorPct, speed: Math.round(st.speed * speedScale(this.input.wave)), d, alive: true,
      flying: !!st.flying, shield: st.shield ?? 0, slowPct: 0, slowUntil: 0, poison: [], armorDebuff: 0, armorDebuffUntil: 0, sprintUntil: 0, sprinted: false, jammed: false,
      boss: null, mini: false, phase: 1, nextCycle: 0, teleKind: null, teleUntil: 0, immuneUntil: 0, armorUpUntil: 0, surgeUntil: 0, reduceUntil: 0, dropped: false, cracked: false, spawnedAt: this.tick, nextSummon: 0, landed: false, ...extra,
    };
    this.enemies.push(e); ev?.push({ t: 'spawn', tick: this.tick, e: e.id, kind });
    return e;
  }

  /** Advance one logical tick and return what happened (for drawing). */
  step(): SimEvent[] {
    if (this.done) return [];
    const ev: SimEvent[] = []; const tick = this.tick;
    // 1 spawns (a full board delays a spawn by a tick, never drops it)
    const spawns = this.input.spawns;
    while (this.spawnIdx < spawns.length && spawns[this.spawnIdx]!.tick <= tick && this.alive().length < MAX_ACTIVE_ENEMIES) {
      const s = spawns[this.spawnIdx++]!;
      const e = this.add(s.kind, s.hp, 0, { id: s.id, armor: s.armor, speed: s.speed, boss: s.boss ?? null, mini: !!s.mini, flying: s.boss === 'skywork_leviathan' ? true : !!ENEMIES[s.kind].flying }, undefined);
      this.nextId = Math.max(this.nextId, s.id + 1000); e.nextCycle = tick + ticks(4); e.nextSummon = tick + ticks(2);
      ev.push({ t: 'spawn', tick, e: e.id, kind: s.kind });
    }
    // 2 bosses: phases and telegraphed effects (every effect is announced at least one second ahead)
    for (const e of this.alive()) if (e.boss) this.bossTick(e, ev);
    // 3 movement, sappers, leaks
    for (const e of this.alive()) {
      const st = ENEMIES[e.kind];
      if (st.sprint && !e.sprinted && e.d * 1000 >= st.sprint.atPermille * this.path.length) { e.sprinted = true; e.sprintUntil = tick + st.sprint.ticks; }
      e.d += this.effSpeed(e);
      if (st.jamTicks && !e.jammed) {
        const here = this.pos(e); let best: SimTower | null = null; let bd = Infinity;
        for (const t of this.towers) { const dd = dist2(t.pos, here); if (dd <= NEAR * NEAR && dd < bd) { bd = dd; best = t; } }
        if (best) {
          e.jammed = true;
          if (this.purify > 0) { this.purify--; this.purified++; ev.push({ t: 'jam', tick, tower: best.id, e: e.id, purified: true }); }
          else { best.jammedUntil = tick + Math.round((st.jamTicks * 100) / 100); ev.push({ t: 'jam', tick, tower: best.id, e: e.id, purified: false }); }
        }
      }
      if (e.d >= this.path.length) {
        e.alive = false;
        let dmg = e.boss ? ENEMIES.colossus.leak : st.leak;
        if (e.boss && this.input.lowPressure) dmg = Math.min(dmg, LOW_PRESSURE_BOSS_LEAK);
        if (this.protect > 0) { this.protect--; this.blocked++; ev.push({ t: 'leak', tick, e: e.id, dmg: 0, blocked: true }); }
        else { this.core = Math.max(0, this.core - dmg); this.coreDamage += dmg; this.leaks++; ev.push({ t: 'leak', tick, e: e.id, dmg, blocked: false }); }
        if (e.boss) this.bossDefeated = false;
      }
    }
    // 4 poison, once per second
    if (tick % 20 === 0) for (const e of this.alive()) {
      e.poison = e.poison.filter((p) => p.until > tick);
      // each stack is credited to the Thorn that planted it (per-tower damage report)
      for (const p of e.poison) this.damage(e, p.dps, 'poison', ev, { bypassShield: true, armorless: true, tower: this.towers.find((t) => t.id === p.src) });
    }
    // 5 artillery salvo (armed by an Artillerist): the first non-boss enemy to reach the mark triggers one strike
    if (this.salvo.length) {
      const lead = this.alive().filter((e) => !e.boss).sort((a, b) => b.d - a.d || a.id - b.id)[0];
      if (lead && lead.d * 1000 >= this.salvo[0]! * this.path.length) {
        this.salvo.shift(); const at = this.pos(lead); ev.push({ t: 'salvo', tick, at });
        const dmg = Math.round(SALVO_DAMAGE * hpScale(this.input.wave));
        for (const e of this.alive()) if (!e.boss && dist2(this.pos(e), at) <= SALVO_RADIUS * SALVO_RADIUS) this.damage(e, dmg, 'salvo', ev, {});
      }
    }
    // 6 towers fire in a stable order
    for (const t of this.towers) this.fire(t, ev);
    // 7 deaths, splits
    for (const e of this.enemies) if (e.alive && e.hp <= 0) this.kill(e, ev);
    this.enemies = this.enemies.filter((e) => e.alive);
    // 8 end
    this.tick++;
    const pending = this.spawnIdx < spawns.length;
    if (this.core <= 0 || (!pending && this.enemies.length === 0) || this.tick >= this.maxTicks) {
      if (this.enemies.length && this.core > 0) { this.retreated = this.enemies.length; ev.push({ t: 'retreat', tick: this.tick, count: this.enemies.length }); if (this.enemies.some((e) => e.boss)) this.bossDefeated = false; }
      if (this.input.boss && this.bossDefeated === null) this.bossDefeated = this.core > 0;
      this.done = true;
    }
    return ev;
  }

  private bossTick(e: SimEnemy, ev: SimEvent[]) {
    const tick = this.tick; const pct = (e.hp * 100) / e.maxHp;
    const want = e.boss === 'skywork_leviathan' && e.phase === 1 && tick - e.spawnedAt >= ticks(20) ? 2 : pct <= 35 ? 3 : pct <= 70 ? 2 : 1;
    if (want > e.phase) { e.phase = want; e.nextCycle = tick + ticks(1.5); ev.push({ t: 'boss', tick, e: e.id, what: `phase${want}` }); if (e.boss === 'skywork_leviathan' && want >= 2 && !e.landed) { e.landed = true; e.flying = false; ev.push({ t: 'boss', tick, e: e.id, what: 'land' }); } }
    const tele = (kind: string) => { e.teleKind = kind; e.teleUntil = tick + BOSS_TELEGRAPH_TICKS; ev.push({ t: 'boss', tick, e: e.id, what: `warn_${kind}` }); };
    // resolve a telegraphed effect exactly when its warning ends
    if (e.teleKind && tick === e.teleUntil) {
      const k = e.teleKind; e.teleKind = null;
      if (k === 'shield') { e.immuneUntil = tick + ticks(2); ev.push({ t: 'boss', tick, e: e.id, what: 'shield' }); }
      if (k === 'surge') { e.surgeUntil = tick + ticks(1); ev.push({ t: 'boss', tick, e: e.id, what: 'surge' }); }
      if (k === 'armor') { e.armorUpUntil = tick + ticks(3); ev.push({ t: 'boss', tick, e: e.id, what: 'armor' }); }
      if (k === 'guard') { e.reduceUntil = tick + ticks(3); ev.push({ t: 'boss', tick, e: e.id, what: 'guard' }); }
      if (k === 'crack') {
        const here = this.pos(e); const target = [...this.towers].filter((t) => !t.disabled).sort((a, b) => dist2(a.pos, here) - dist2(b.pos, here) || (a.id < b.id ? -1 : 1))[0];
        if (target) { target.disabled = true; this.cracked = target.id; ev.push({ t: 'boss', tick, e: e.id, what: 'crack', ref: target.id }); }
      }
    }
    if (e.teleKind) return;
    if (e.boss === 'copper_colossus') {
      if (e.phase === 1 && tick >= e.nextSummon) { e.nextSummon = tick + ticks(5); this.summon(e, 'zipper', 2, ev); }
      if (e.phase === 2 && tick >= e.nextCycle) { e.nextCycle = tick + ticks(6); tele('shield'); }
      if (e.phase === 3 && tick >= e.nextCycle) { e.nextCycle = tick + ticks(6); tele('surge'); }
    } else if (e.boss === 'quarry_crawler') {
      if (e.phase <= 2 && tick >= e.nextCycle) { e.nextCycle = tick + ticks(7); tele('armor'); }
      if (!e.dropped && (e.hp * 100) / e.maxHp <= 60) { e.dropped = true; this.summon(e, 'sapper', 2, ev); ev.push({ t: 'boss', tick, e: e.id, what: 'drop' }); }
      if (e.phase === 3 && !e.cracked) { e.cracked = true; tele('crack'); }
    } else if (e.boss === 'skywork_leviathan') {
      if (e.phase === 1 && tick >= e.nextSummon) { e.nextSummon = tick + ticks(6); this.summon(e, 'skimmer', 3, ev); ev.push({ t: 'boss', tick, e: e.id, what: 'swarm' }); }
      if (e.phase === 2 && tick >= e.nextCycle) { e.nextCycle = tick + ticks(6); tele('guard'); }
    }
  }
  private summon(boss: SimEnemy, kind: TDEnemyKind, n: number, ev: SimEvent[]) {
    for (let i = 0; i < n && this.alive().length < MAX_ACTIVE_ENEMIES; i++) this.add(kind, Math.round(ENEMIES[kind].hp * hpScale(this.input.wave)), Math.max(0, boss.d - 300 - i * 250), {}, ev);
  }

  private effArmor(e: SimEnemy, tower: SimTower | null): number {
    let a = e.armor + (this.tick < e.armorDebuffUntil ? -e.armorDebuff : 0);
    if (e.boss === 'quarry_crawler' && this.tick < e.armorUpUntil) a = 35;
    a = Math.max(0, a);
    if (tower?.kind === 'ember') a = Math.round((a * (100 - ARMOR_MELT_PCT)) / 100);
    if (tower?.branch === 'armor_melt') a = Math.round(a / 2);
    return a;
  }
  private damage(e: SimEnemy, raw: number, src: string, ev: SimEvent[], o: { tower?: SimTower; bypassShield?: boolean; armorless?: boolean }) {
    if (!e.alive || e.hp <= 0) return;
    if (e.boss && this.tick < e.immuneUntil) { ev.push({ t: 'hit', tick: this.tick, e: e.id, dmg: 0, src, blocked: true }); return; }
    let dmg = raw;
    if (!o.armorless) dmg = Math.round((dmg * (100 - this.effArmor(e, o.tower ?? null))) / 100);
    if (e.boss === 'skywork_leviathan' && this.tick < e.reduceUntil) dmg = Math.round((dmg * 60) / 100);
    dmg = Math.max(1, dmg);
    if (e.shield > 0 && !o.bypassShield) { const absorbed = Math.min(e.shield, dmg); e.shield -= absorbed; dmg -= absorbed; if (dmg <= 0) { ev.push({ t: 'hit', tick: this.tick, e: e.id, dmg: 0, src, blocked: true }); return; } }
    const dealt = Math.min(dmg, e.hp); e.hp -= dmg; if (o.tower) o.tower.dmgDone += dealt;
    ev.push({ t: 'hit', tick: this.tick, e: e.id, dmg: dealt, src });
  }
  private targetable(t: SimTower, e: SimEnemy) { return e.alive && e.hp > 0 && !(e.flying && TOWERS[t.kind].groundOnly); }
  private pick(t: SimTower): SimEnemy | null {
    const r2 = t.range * t.range; let best: SimEnemy | null = null;
    for (const e of this.enemies) {
      if (!this.targetable(t, e) || dist2(this.pos(e), t.pos) > r2) continue;
      if (!best) { best = e; continue; }
      const better = t.targeting === 'strongest' ? e.hp > best.hp || (e.hp === best.hp && (e.d > best.d || (e.d === best.d && e.id < best.id)))
        : t.targeting === 'fastest' ? this.effSpeed(e) > this.effSpeed(best) || (this.effSpeed(e) === this.effSpeed(best) && (e.d > best.d || (e.d === best.d && e.id < best.id)))
          : t.targeting === 'lowest_health' ? e.hp < best.hp || (e.hp === best.hp && (e.d > best.d || (e.d === best.d && e.id < best.id)))
            : e.d > best.d || (e.d === best.d && e.id < best.id);
      if (better) best = e;
    }
    return best;
  }
  private nearestOther(from: SimEnemy, exclude: Set<number>, reach: number, filter: (e: SimEnemy) => boolean): SimEnemy | null {
    const at = this.pos(from); let best: SimEnemy | null = null; let bd = Infinity;
    for (const e of this.enemies) { if (exclude.has(e.id) || !e.alive || e.hp <= 0 || !filter(e)) continue; const dd = dist2(this.pos(e), at); if (dd <= reach * reach && (dd < bd || (dd === bd && best && e.id < best.id))) { bd = dd; best = e; } }
    return best;
  }
  private fire(t: SimTower, ev: SimEvent[]) {
    const tick = this.tick;
    if (t.kind === 'beacon' || t.disabled || tick < t.jammedUntil || tick < t.nextFire) return;
    const target = this.pick(t); if (!target) return;
    t.nextFire = tick + t.cooldown; ev.push({ t: 'fire', tick, tower: t.id, target: target.id });
    const st = TOWERS[t.kind]; const status = (n: number) => Math.round((n * (100 + this.statusPct)) / 100);
    switch (t.kind) {
      case 'bolt': {
        this.damage(target, t.damage, t.id, ev, { tower: t });
        if (t.branch === 'double_barrel') this.damage(target, Math.round((t.damage * 60) / 100), t.id, ev, { tower: t });
        if (t.branch === 'chain_node') { const o = this.nearestOther(target, new Set([target.id]), NEAR, (e) => this.targetable(t, e)); if (o) { this.damage(o, Math.round(t.damage / 2), t.id, ev, { tower: t }); ev.push({ t: 'chain', tick, tower: t.id, ids: [target.id, o.id] }); } }
        break;
      }
      case 'frost': {
        this.damage(target, t.damage, t.id, ev, { tower: t });
        const pct = t.branch === 'deep_freeze' ? 40 : st.slowPct!; const dur = status(t.branch === 'deep_freeze' ? ticks(3) : st.slowTicks!);
        const chill = (e: SimEnemy) => { if (e.boss && this.tick < e.immuneUntil) return; e.slowPct = Math.min(MAX_SLOW_PCT, Math.max(this.tick < e.slowUntil ? e.slowPct : 0, pct)); e.slowUntil = Math.max(e.slowUntil, tick + dur); ev.push({ t: 'slow', tick, e: e.id }); };
        chill(target);
        if (t.branch === 'ice_trail') { const o = this.nearestOther(target, new Set([target.id]), NEAR, () => true); if (o) chill(o); }
        break;
      }
      case 'ember': {
        const r = Math.round((st.splash! * (t.branch === 'wide_ember' ? 140 : 100) * (100 + this.splashPct)) / 10000);
        const at = this.pos(target); ev.push({ t: 'splash', tick, tower: t.id, at, r });
        for (const e of [...this.enemies].sort((a, b) => a.id - b.id)) {
          if (!this.targetable(t, e) || dist2(this.pos(e), at) > r * r) continue;
          this.damage(e, t.damage, t.id, ev, { tower: t, bypassShield: true });
          if (t.branch === 'armor_melt') { e.armorDebuff = 10; e.armorDebuffUntil = tick + ticks(3); }
        }
        break;
      }
      case 'thorn': {
        this.damage(target, t.damage, t.id, ev, { tower: t });
        const cap = t.branch === 'lasting_sap' ? 4 : st.poisonCap!; const dur = status(t.branch === 'lasting_sap' ? ticks(5) : st.poisonTicks!);
        const seed = (e: SimEnemy) => { e.poison = e.poison.filter((p) => p.until > tick); if (e.poison.length >= cap) e.poison.shift(); e.poison.push({ dps: st.poisonDps!, until: tick + dur, src: t.id }); ev.push({ t: 'poison', tick, e: e.id, stacks: e.poison.length }); };
        seed(target);
        if (t.branch === 'vine_spread') { const o = this.nearestOther(target, new Set([target.id]), NEAR, (e) => this.targetable(t, e)); if (o) seed(o); }
        break;
      }
      case 'arc': {
        const hops = (st.chain ?? 2) + (t.branch === 'jump_chain' ? 1 : 0); const fall = t.branch === 'jump_chain' ? 25 : st.chainFalloffPct!;
        const reach = Math.round((CHAIN_REACH * (100 + this.splashPct)) / 100);
        const hit = new Set<number>([target.id]); const ids = [target.id]; let dmg = t.branch === 'charged_strike' ? Math.round((t.damage * 140) / 100) : t.damage;
        this.damage(target, dmg, t.id, ev, { tower: t, bypassShield: true });
        let last = target;
        for (let h = 0; h < hops; h++) {
          const o = this.nearestOther(last, hit, reach, (e) => this.targetable(t, e)); if (!o) break;
          dmg = Math.max(1, Math.round((dmg * (100 - fall)) / 100)); hit.add(o.id); ids.push(o.id);
          this.damage(o, dmg, t.id, ev, { tower: t, bypassShield: true }); last = o;
        }
        ev.push({ t: 'chain', tick, tower: t.id, ids });
        break;
      }
    }
  }
  private kill(e: SimEnemy, ev: SimEvent[]) {
    e.alive = false; this.kills++; ev.push({ t: 'kill', tick: this.tick, e: e.id });
    if (e.boss) this.bossDefeated = true;
    const split = ENEMIES[e.kind].split;
    if (split) {
      const children: number[] = [];
      for (let i = 0; i < split && this.enemies.filter((x) => x.alive).length < MAX_ACTIVE_ENEMIES; i++) {
        const c = this.add('drifter', Math.max(1, Math.round((ENEMIES.drifter.hp * hpScale(this.input.wave) * SPLIT_CHILD_HP_PCT) / 100)), Math.max(0, e.d + (i === 0 ? 150 : -150)));
        children.push(c.id);
      }
      ev.push({ t: 'split', tick: this.tick, parent: e.id, children });
    }
  }

  result(): TDWaveResult {
    const damageByTower: Record<string, number> = {}; for (const t of this.towers) damageByTower[t.id] = t.dmgDone;
    return {
      wave: this.input.wave, outcome: this.core <= 0 ? 'fallen' : this.retreated > 0 ? 'held' : 'cleared', leaks: this.leaks, coreDamage: this.coreDamage, kills: this.kills,
      ticks: this.tick, damageByTower, bossDefeated: this.input.boss ? this.bossDefeated : null, blocked: this.blocked, purified: this.purified,
      cracked: this.cracked,
    };
  }
  /** Small digest of the outcome, used by replay tests to prove server and browser agree. */
  digest(): string { const r = this.result(); return `${r.wave}:${r.ticks}:${this.core}:${r.kills}:${r.leaks}:${r.blocked}:${r.purified}:${Object.values(r.damageByTower).join(',')}`; }
}

/** Authoritative: simulate a whole wave in one bounded loop. */
export function runWave(input: TDWaveInput): { result: TDWaveResult; core: number; digest: string } {
  const sim = new WaveSim(input); let guard = 0;
  while (!sim.done && guard++ < 10_000) sim.step();
  return { result: sim.result(), core: sim.core, digest: sim.digest() };
}
