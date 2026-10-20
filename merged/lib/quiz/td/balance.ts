/** Every tuning number of Tower Defense, as plain data. These are the GDD's starting balance proposals (02_TOWERS_ENEMIES_BOSSES.md);
 *  changes must come with before/after simulation evidence (see __tests__/balance.test.ts). One currency: integer POINTS. */
import type { TDBossId, TDEnemyKind, TDRole, TDTowerKind } from './domain';

export const TICK_MS = 50; // 20 Hz logical tick
export const TICKS_PER_SECOND = 1000 / TICK_MS;
export const ticks = (seconds: number) => Math.round(seconds * TICKS_PER_SECOND);

export type TowerStats = {
  name: string; cost: number; damage: number; cooldownTicks: number; range: number; upgrade: readonly [number, number];
  splash?: number; slowPct?: number; slowTicks?: number; poisonDps?: number; poisonTicks?: number; poisonCap?: number; chain?: number; chainFalloffPct?: number;
  auraPct?: number; groundOnly?: boolean; role: string;
};
/** range / splash in milli-tiles (1000 = one tile). Damage is the GDD proposal × 1.6 and enemy HP × 0.9 — tuned with whole-match simulations
 *  (__tests__/balance.test.ts): at the GDD values even a 95%-accurate squad fell by wave 6. Costs, cooldowns, ranges and ratios are unchanged. */
export const TOWERS: Record<TDTowerKind, TowerStats> = {
  bolt: { name: 'Bolt Turret', cost: 120, damage: 25, cooldownTicks: ticks(0.95), range: 3600, upgrade: [115, 200], role: 'Fast single target' },
  frost: { name: 'Frost Lens', cost: 150, damage: 11, cooldownTicks: ticks(1.25), range: 3200, upgrade: [145, 235], slowPct: 25, slowTicks: ticks(2), role: 'Slows enemies' },
  ember: { name: 'Ember Kiln', cost: 175, damage: 48, cooldownTicks: ticks(1.9), range: 3000, upgrade: [165, 270], splash: 1300, groundOnly: true, role: 'Area damage, cuts armor' },
  thorn: { name: 'Thorn Planter', cost: 130, damage: 13, cooldownTicks: ticks(1.2), range: 3400, upgrade: [125, 210], poisonDps: 10, poisonTicks: ticks(3), poisonCap: 3, groundOnly: true, role: 'Poison over time' },
  arc: { name: 'Arc Coil', cost: 205, damage: 28, cooldownTicks: ticks(1.55), range: 3500, upgrade: [180, 295], chain: 2, chainFalloffPct: 35, role: 'Chains between enemies' },
  beacon: { name: 'Beacon Lantern', cost: 160, damage: 0, cooldownTicks: 0, range: 2600, upgrade: [155, 250], auraPct: 10, role: 'Speeds up nearby towers' },
};
export const MAX_SLOW_PCT = 45;
export const ARMOR_MELT_PCT = 50; // Ember: armor counts half (GDD proposal 20%; raised so armored waves have a real counter)
export const BEACON_TEAM_CAP_PCT = 20; // total attack-rate boost any one tower can receive
export const LEVEL_DAMAGE_PCT = [100, 130, 176] as const; // L2 +30%, L3 another +35% on top of L2 (1.30 × 1.35 = 1.755)
export const LEVEL_RANGE_PCT = [100, 110, 110] as const;
export const BEACON_LEVEL_AURA = [10, 13, 16] as const;
export const MAX_LEVEL = 3;
export const SELL_REFUND_PCT = 50;
export const MOVE_COST_PCT = 25; // moving a tower to another free pad costs a quarter of what was spent (free after a cracked pad)
export const TARGET_CHANGE_COST = 10; // changing a tower's targeting policy (one free change per wave for a Tactician)

export type BranchInfo = { name: string; effect: string; tradeoff: string };
export const BRANCHES: Record<string, BranchInfo> = {
  double_barrel: { name: 'Double Barrel', effect: 'Every volley fires a second bolt at the same target.', tradeoff: 'All damage stays on one enemy.' },
  chain_node: { name: 'Chain Node', effect: 'Each bolt also hits one more enemy for half damage.', tradeoff: 'Less damage on the main target than Double Barrel.' },
  deep_freeze: { name: 'Deep Freeze', effect: 'Slow becomes 40% and lasts 3 s.', tradeoff: 'Still one target per shot.' },
  ice_trail: { name: 'Ice Trail', effect: 'The slow also lands on the nearest second enemy.', tradeoff: 'Slow strength stays at 25%.' },
  wide_ember: { name: 'Wide Ember', effect: 'Splash radius grows by 40%.', tradeoff: 'Armor is cut as before.' },
  armor_melt: { name: 'Armor Melt', effect: 'Hit enemies lose 10 armor points for 3 s and armor counts half.', tradeoff: 'Splash radius stays small.' },
  vine_spread: { name: 'Vine Spread', effect: 'Poison also lands on one enemy next to the target.', tradeoff: 'Poison length stays 3 s.' },
  lasting_sap: { name: 'Lasting Sap', effect: 'Poison lasts 5 s and stacks up to 4 times.', tradeoff: 'Only the target is poisoned.' },
  jump_chain: { name: 'Jump Chain', effect: 'Chains to one extra enemy and loses only 25% per hop.', tradeoff: 'First hit is not stronger.' },
  charged_strike: { name: 'Charged Strike', effect: 'The first hit deals 40% more damage.', tradeoff: 'Chain length stays 2.' },
  range_aura: { name: 'Range Aura', effect: 'Aura reaches one tile further and gives 5 more percent.', tradeoff: 'No core healing.' },
  core_relief: { name: 'Core Relief', effect: 'Restores 1 core health after every wave the core survives.', tradeoff: 'Aura stays the same size.' },
};

export type EnemyStats = { name: string; hp: number; speed: number; armorPct: number; leak: number; weightX10: number; flying?: boolean; shield?: number; split?: number; jamTicks?: number; sprint?: { atPermille: number; pct: number; ticks: number } };
/** speed in milli-tiles per tick (60 = 1.2 tiles per second = the GDD's speed 1.00, so a lane takes about 25 s to walk). */
export const ENEMIES: Record<TDEnemyKind, EnemyStats> = {
  drifter: { name: 'Drifter', hp: 59, speed: 60, armorPct: 0, leak: 1, weightX10: 10 },
  zipper: { name: 'Zipper', hp: 36, speed: 98, armorPct: 0, leak: 1, weightX10: 12, sprint: { atPermille: 400, pct: 80, ticks: ticks(1.5) } },
  bulwark: { name: 'Bulwark', hp: 162, speed: 38, armorPct: 45, leak: 2, weightX10: 30 },
  skimmer: { name: 'Skimmer', hp: 54, speed: 74, armorPct: 0, leak: 1, weightX10: 18, flying: true },
  warden: { name: 'Warden', hp: 86, speed: 55, armorPct: 25, leak: 1, weightX10: 22, shield: 60 },
  splitter: { name: 'Splitter', hp: 86, speed: 58, armorPct: 0, leak: 1, weightX10: 25, split: 2 },
  sapper: { name: 'Sapper', hp: 68, speed: 66, armorPct: 0, leak: 1, weightX10: 20, jamTicks: ticks(1.6) },
  colossus: { name: 'Colossus', hp: 630, speed: 32, armorPct: 25, leak: 5, weightX10: 80 },
};
export const LOW_PRESSURE_BOSS_LEAK = 3;
export const SPLIT_CHILD_HP_PCT = 45;

export type BossInfo = { name: string; map: string; flying: boolean; summary: string; phases: [string, string, string] };
export const BOSSES: Record<TDBossId, BossInfo> = {
  copper_colossus: { name: 'Copper Colossus', map: 'meadow_circuit', flying: false, summary: 'Sends Zippers, then raises short shields, then surges.', phases: ['Sends two Zippers every 5 s', 'Raises a 2 s shield (warned 1 s ahead)', 'Short speed surges (warned 1 s ahead)'] },
  quarry_crawler: { name: 'Quarry Crawler', map: 'coral_quarry', flying: false, summary: 'Hardens its armor, drops Sappers, cracks one build pad.', phases: ['Armor rises to 35% for 3 s (warned)', 'Drops two Sappers at 60% health', 'Cracks the pad of the nearest tower for this wave (warned); that tower moves free afterwards'] },
  skywork_leviathan: { name: 'Skywork Leviathan', map: 'skyworks', flying: true, summary: 'Flies with a Skimmer swarm, lands behind a shield, slows for the finale.', phases: ['Flying: launches three Skimmers every 6 s', 'Lands: takes 40% less damage for 3 s at a time (warned)', 'Finale: 15% slower'] },
};
export const BOSS_TELEGRAPH_TICKS = ticks(1); // every boss effect is announced at least one second ahead

/** Growth curves. The GDD's starting formulas (HP 1 + 0.13(w−1) + 0.012·max(0,w−6)², budget 9 + 2.4w + 0.06w²) outgrew a quiz-driven economy by far
 *  in whole-match simulations (squads fell at wave 4–6 at every accuracy). The tuned values below were chosen with __tests__/balance.test.ts;
 *  the shape (linear + late quadratic, capped) is unchanged. */
export const GROWTH = { hpLinear: 0.08, hpQuad: 0.004, hpQuadFrom: 8, hpCap: 2.8, budgetBase: 9, budgetLinear: 1.7, budgetQuad: 0.03, awardGrowthPct: 6 };
export function hpScale(wave: number): number { const w = Math.max(1, wave); return Math.min(GROWTH.hpCap, 1 + GROWTH.hpLinear * (w - 1) + GROWTH.hpQuad * Math.max(0, w - GROWTH.hpQuadFrom) ** 2); }
export function speedScale(wave: number): number { return Math.min(1.24, 1 + 0.016 * (Math.max(1, wave) - 1)); }
export function waveBudgetX10(wave: number, lowPressure: boolean): number { const b = Math.round((GROWTH.budgetBase + GROWTH.budgetLinear * wave + GROWTH.budgetQuad * wave * wave) * 10); return lowPressure ? Math.round(b * 0.85) : b; }
/** The squad award grows a little each round, the same for every squad, so a long lesson's later waves stay winnable. */
export function roundAward(round: number): number { return Math.round(BASE_AWARD * (100 + GROWTH.awardGrowthPct * Math.max(0, round - 1)) / 100); }
export const MAX_ACTIVE_ENEMIES = 40;
export const MAX_SPAWNS_PER_WAVE = 140;
export const MAX_WAVE_TICKS = ticks(70); // a normal wave never runs longer; what is left retreats (no damage)
export const MAX_BOSS_WAVE_TICKS = ticks(100);

/** One currency. */
export const STARTING_POINTS = 240;
export const STARTING_CORE_HP = 24;
export const BASE_AWARD = 80; // a fully correct synchronized round for a whole squad
export const INDEPENDENT_BASE_AWARD = 40; // per personal answer, divided across the squad roster
export const MAX_TOWERS_PER_TEAM = 24;
export const MAX_SEATS_PER_TEAM = 5;
export const MAX_TEAMS = 4;
export const MAX_PLAYERS = 20;
export const COMEBACK_KIT_PCT = 50; // the next Bolt costs half, once per chapter, when a squad cannot afford any tower and has fewer than two
export const WAGER_CAP = 100;

/** Normalised synchronized award (03_QUESTION_INTEGRATION §2): one capable 5-person squad does not get five times the economy of a solo player.
 *  `correctMilli` is the sum of answer fractions in thousandths (a full correct answer = 1000). Zero correct → zero points. */
export function syncTeamAward(base: number, correctMilli: number, eligible: number): number {
  if (!Number.isSafeInteger(base) || base < 0) throw new Error('bad base award');
  if (!Number.isSafeInteger(correctMilli) || !Number.isSafeInteger(eligible) || eligible < 1 || correctMilli < 0 || correctMilli > eligible * 1000) throw new Error('bad roster');
  if (correctMilli === 0) return 0;
  // integer arithmetic: base × (600·eligible + 400·correctShare) / (1000·eligible)
  return Math.round((base * (600 * eligible * 1000 + 400 * correctMilli)) / (1000 * 1000 * eligible));
}
/** Independent flow: one personal answer earns its share of the squad's per-answer award; the per-round cap keeps fast tappers from farming. */
export function independentAward(correctMilli: number, roster: number): number {
  if (correctMilli <= 0) return 0;
  return Math.max(1, Math.round((INDEPENDENT_BASE_AWARD * correctMilli) / 1000 / Math.max(1, roster)));
}

export type RoleInfo = { name: string; passive: string; active: string; weakness: string; ability: 'reinforce' | 'scan' | 'salvo' | 'purify' | 'protect' };
export const ROLES: Record<TDRole, RoleInfo> = {
  architect: { name: 'Architect', passive: 'Your first tower each build costs 10% less (rounded up).', active: 'Reinforce: one tower gets +15% range for the next wave.', weakness: 'No direct extra damage.', ability: 'reinforce' },
  tactician: { name: 'Tactician', passive: 'One free targeting change per wave (normally 10 points).', active: 'Scan: see which enemy types the next wave brings.', weakness: 'Less raw damage.', ability: 'scan' },
  artillerist: { name: 'Artillerist', passive: 'Ember and Arc splash +8% (squad cap +16%).', active: 'Salvo: mark a spot on the path; one strike hits the first group to reach it (not bosses).', weakness: 'Weak against armored bosses.', ability: 'salvo' },
  alchemist: { name: 'Alchemist', passive: 'Frost and Thorn effects last 10% longer (squad cap +20%).', active: 'Purify: the first jammed tower next wave is freed at once.', weakness: 'Low base damage.', ability: 'purify' },
  warden: { name: 'Warden', passive: '+2 core health at the start (squad cap +4).', active: 'Protect: the next enemy that reaches the core does no damage.', weakness: 'Defensive only.', ability: 'protect' },
};
export const ROLE_CAPS = { splashPct: 16, statusPct: 20, wardenHP: 4 } as const;
export const SALVO_DAMAGE = 90;
export const SALVO_RADIUS = 1500;

/** Question reading time by format, in seconds (GDD §5). Mixed quizzes use the real composition, never "all multiple choice". */
export const READ_SECONDS = { multiple_choice: 38, answer_forge: 55, connection_rush: 65, truth_hunt: 48, fill_table: 75 } as const;
export const NETWORK_GRACE_MS = 1500; // the same bounded allowance for every student after a deadline


// ── Game 1 corrective pass: chronological tower unlocks, enemy field notes, role sets by squad size ─────────────────────────────────────────
import type { TDTowerKind as _TK, TDEnemyKind as _EK, TDRole as _R } from './domain';
/** Towers follow the history of defence technology: each one is a recognisable step on the timeline, and a squad meets them in that order.
 *  `wave` is the first wave a squad may BUILD it (waves are 1-based; the unlock is checked against the round the next wave belongs to). */
export type TowerAge = { age: string; era: string; wave: number; story: string };
export const TOWER_AGES: Record<_TK, TowerAge> = {
  thorn: { age: 'Stone Age', era: 'about 100,000 years ago', wave: 1, story: 'Poisoned thorns and plant toxins were among the first things people used to hold off a threat.' },
  bolt: { age: 'Ancient world', era: 'about 400 BCE', wave: 1, story: 'The first bolt-throwers (the gastraphetes and later ballistae) launched bolts with a mechanical stock.' },
  ember: { age: 'Bronze and Iron Age', era: 'about 3000 BCE', wave: 2, story: 'Kilns and furnaces made metal possible — and a sheet of fire stops armoured foes.' },
  beacon: { age: 'Classical age', era: 'about 280 BCE', wave: 3, story: 'Lighthouses and signal fires let a whole coastline work together at once.' },
  frost: { age: 'Renaissance', era: 'about 1600 CE', wave: 4, story: 'Ground lenses — telescopes and microscopes — learned to bend and focus light, and with it, cold to a point.' },
  arc: { age: 'Industrial age', era: 'about 1800 CE', wave: 5, story: 'Voltaic piles and coils turned electricity into a force that jumps from one target to the next.' },
};
export const TOWER_TIMELINE: readonly _TK[] = ['thorn', 'bolt', 'ember', 'beacon', 'frost', 'arc'];
/** First wave a tower can be built, capped so short matches still reach every tower before their final wave. */
export const unlockWave = (kind: _TK, waves: number): number => {
  const last = Math.max(1, waves - 1); const w = TOWER_AGES[kind].wave; // short matches compress the table evenly instead of piling every late tower onto one wave
  return last >= 5 ? w : Math.max(1, Math.min(last, Math.round((w * last) / 5)));
};
export const isUnlocked = (kind: _TK, round: number, waves: number): boolean => round >= unlockWave(kind, waves);
export const nextUnlock = (round: number, waves: number): { kind: _TK; wave: number } | null => {
  const left = TOWER_TIMELINE.map((k) => ({ kind: k, wave: unlockWave(k, waves) })).filter((x) => x.wave > round).sort((a, b) => a.wave - b.wave);
  return left[0] ?? null;
};

export type EnemyInfo = { type: string; threat: 1 | 2 | 3 | 4 | 5; story: string; behaviour: string; counter: string };
export const ENEMY_INFO: Record<_EK, EnemyInfo> = {
  drifter: { type: 'Walker', threat: 1, story: 'A wobbly toy scout that follows the lane without a plan.', behaviour: 'Walks at a steady pace and has no special trait.', counter: 'Any tower. A good target for your first Thorn Planter or Bolt Turret.' },
  zipper: { type: 'Runner', threat: 2, story: 'A spring-loaded runner that cannot sit still.', behaviour: 'Fast, low health, and sprints for a second and a half when it is 40% along the lane.', counter: 'Frost Lens slows it before the sprint; Bolt Turrets have the fire rate to hit it.' },
  bulwark: { type: 'Heavy', threat: 3, story: 'A tin-plated tank that shrugs off small hits.', behaviour: 'Slow, very tough, armour cuts 45% of every hit, and it hurts the core for 2 when it arrives.', counter: 'Ember Kiln melts armour. Several Bolts also work if you upgrade them.' },
  skimmer: { type: 'Flyer', threat: 2, story: 'A paper kite that ignores the lane’s corners.', behaviour: 'Flies over the lane, so ground-only towers cannot touch it.', counter: 'Bolt, Frost and Arc can hit flyers. Ember and Thorn cannot.' },
  warden: { type: 'Shielded', threat: 3, story: 'A guard with a spare shield strapped to its back.', behaviour: 'Carries a 60-point shield before its health is touched, and 25% armour.', counter: 'Burst the shield down with fast hits (Bolt, Arc); Ember’s armour melt helps against the 25% armour.' },
  splitter: { type: 'Swarm maker', threat: 3, story: 'Looks like one enemy but pops into two.', behaviour: 'When it falls it splits into two smaller enemies with 45% of its health each.', counter: 'Ember splash and Arc chains clear the pieces together.' },
  sapper: { type: 'Saboteur', threat: 3, story: 'A tinkerer with a screwdriver and bad intentions.', behaviour: 'Jams the nearest tower for about one and a half seconds as it passes.', counter: 'Alchemist’s Purify, or kill it early with long-range towers.' },
  colossus: { type: 'Boss', threat: 5, story: 'A giant that appears at the end of a chapter, with a warning before every trick.', behaviour: 'Huge health, 25% armour, and it hurts the core for 5. Each boss has three phases with a one-second telegraph.', counter: 'Upgrade your best towers, keep Frost Lenses on the lane, and read the warning banner.' },
};

/** OS-style role gating: which roles a squad of N may pick. One student gets one balanced solo role; bigger squads add complementary roles. */
export const SOLO_ROLE: _R = 'architect';
export const ROLES_BY_SIZE: Record<number, readonly _R[]> = {
  1: ['architect'], 2: ['architect', 'tactician'], 3: ['architect', 'tactician', 'warden'], 4: ['architect', 'tactician', 'warden', 'alchemist'], 5: ['architect', 'tactician', 'warden', 'alchemist', 'artillerist'],
};
export const rolesForSquad = (size: number): readonly _R[] => ROLES_BY_SIZE[Math.max(1, Math.min(5, Math.floor(size) || 1))];
export const ROLE_REASON: Record<_R, string> = {
  architect: 'Cheaper first tower: the solo-ready role.', tactician: 'Free targeting and a scan: pairs well with a builder.', warden: 'Extra core health: a safety net once three can share the work.',
  alchemist: 'Longer Frost and Thorn effects: needs a squad that runs those towers.', artillerist: 'Salvo and splash: shines when four others hold the lane.',
};
