/** EMPIRE RACE — hex territory control. Answering earns planning energy; the map consequence is a deliberate choice, never automatic. */
import { err, type AskInfo, type Core, type Difficulty, type GameCommand, type GameState, type ReduceResult, type Standing, type TeamRef, type VerifiedAnswer, type Env, type EmpireWorld, type EmpireObjective } from '../types';
import { actorTeam, askTeams, endTurn, fx, log, mayAct, registerGame, teamName, type GameModule, type InitArgs } from '../engine';
import { rngFrom } from '../rng';

export type Tile = { id: number; q: number; r: number; biome: string; topic: string | null; diff: Difficulty; value: Difficulty; owner: string | null; fort: boolean; capital: string | null; hidden: boolean; relic: number; review: boolean; misses: number };
export type Duel = { tile: number; attacker: string; defender: string; stage: 'attack' | 'defend'; atk: number | null };
export type EmpireG = {
  world: EmpireWorld; objective: EmpireObjective; tiles: Tile[]; blocked: string[]; bridges: string[]; energy: Record<string, number>;
  target: number | null; duel: Duel | null; comeback: boolean; gained: Record<string, number>; lastDuel: { tile: number; winner: string; attacker: string } | null; minCapitalDistance: number;
};

export const ENERGY_CAP = 4;
export const COST = { claim: 1, fortify: 1, research: 1, bridge: 2, challenge: 2 } as const;
const DIRS: [number, number][] = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
export const ek = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
export const hexDist = (a: { q: number; r: number }, b: { q: number; r: number }) => (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
export const hexXY = (t: { q: number; r: number }) => ({ x: Math.sqrt(3) * (t.q + t.r / 2), y: 1.5 * t.r });
const BIOMES: Record<EmpireWorld, string[]> = { archipelago: ['coast', 'forest', 'harbor', 'hills'], river_kingdom: ['farmland', 'forest', 'marsh', 'hills'], desert_crossing: ['dune', 'oasis', 'mesa', 'ruins'] };

export function neighborsOf(g: EmpireG, id: number): number[] {
  const t = g.tiles[id]!; const out: number[] = [];
  for (const [dq, dr] of DIRS) { const n = g.tiles.find((x) => x.q === t.q + dq && x.r === t.r + dr); if (n) out.push(n.id); }
  return out;
}
export const edgeOpen = (g: EmpireG, a: number, b: number) => !g.blocked.includes(ek(a, b)) || g.bridges.includes(ek(a, b));
export const ownedBy = (g: EmpireG, team: string) => g.tiles.filter((t) => t.owner === team);
/** adjacent to one of the team's tiles across an OPEN edge */
export function reachable(g: EmpireG, team: string, id: number): boolean { return neighborsOf(g, id).some((n) => g.tiles[n]!.owner === team && edgeOpen(g, n, id)); }

function genShape(n: number, rng: ReturnType<typeof rngFrom>) {
  const key = (q: number, r: number) => `${q},${r}`; const set = new Map<string, { q: number; r: number }>([[key(0, 0), { q: 0, r: 0 }]]);
  while (set.size < n) {
    let best: { q: number; r: number } | null = null, bs = 1e9;
    for (const t of set.values()) for (const [dq, dr] of DIRS) {
      const q = t.q + dq, r = t.r + dr; if (set.has(key(q, r))) continue;
      const score = hexDist({ q, r }, { q: 0, r: 0 }) + rng.next() * 1.9; if (score < bs) { bs = score; best = { q, r }; }
    }
    set.set(key(best!.q, best!.r), best!);
  }
  return [...set.values()];
}

export function buildMap(teams: TeamRef[], tilesWanted: number, world: EmpireWorld, objective: EmpireObjective, topics: string[], seed: string): { tiles: Tile[]; blocked: string[]; minCapitalDistance: number } {
  const rng = rngFrom(`${seed}:empire`);
  const shape = genShape(tilesWanted, rng).sort((a, b) => a.r - b.r || a.q - b.q);
  const tiles: Tile[] = shape.map((s, i) => ({ id: i, q: s.q, r: s.r, biome: '', topic: null, diff: 1, value: 1, owner: null, fort: false, capital: null, hidden: false, relic: 0, review: false, misses: 0 }));
  const g0 = { tiles } as EmpireG; g0.blocked = []; g0.bridges = [];
  // water: straits (archipelago) or a river with a few fords (river kingdom); the desert has none
  const blocked: string[] = [];
  const xs = tiles.map((t) => hexXY(t).x).sort((a, b) => a - b);
  const cutEdges = (thr: (y: number) => number, keep: number) => {
    const cross: string[] = [];
    for (const t of tiles) for (const n of neighborsOf(g0, t.id)) if (n > t.id) {
      const a = hexXY(t), b = hexXY(tiles[n]!); const th = thr((a.y + b.y) / 2);
      if ((a.x < th && b.x >= th) || (b.x < th && a.x >= th)) cross.push(ek(t.id, n));
    }
    const kept = new Set(rng.shuffle(cross).slice(0, keep)); cross.forEach((e) => { if (!kept.has(e)) blocked.push(e); });
  };
  if (world === 'archipelago') { cutEdges(() => xs[Math.floor(xs.length / 3)]! - 0.01, 1); cutEdges(() => xs[Math.floor((xs.length * 2) / 3)]! - 0.01, 1); }
  else if (world === 'river_kingdom') cutEdges((y) => xs[Math.floor(xs.length / 2)]! + Math.sin(y * 1.1) * 0.8, 2);
  // capitals: farthest-first so every team starts equally far from rivals
  const first = rng.pick(tiles.filter((t) => hexDist(t, { q: 0, r: 0 }) >= Math.max(...tiles.map((x) => hexDist(x, { q: 0, r: 0 }))) - 0.01));
  const caps = [first];
  while (caps.length < teams.length) {
    let best = tiles[0]!, bd = -1;
    for (const t of tiles) { if (caps.includes(t)) continue; const d = Math.min(...caps.map((c) => hexDist(c, t))) + rng.next() * 0.01; if (d > bd) { bd = d; best = t; } }
    caps.push(best);
  }
  const order = rng.shuffle(teams.map((t) => t.id));
  caps.forEach((c, i) => { c.owner = order[i]!; c.capital = order[i]!; c.fort = true; });
  let minCap = 99; for (let i = 0; i < caps.length; i++) for (let j = i + 1; j < caps.length; j++) minCap = Math.min(minCap, hexDist(caps[i]!, caps[j]!));
  // topic zones: farthest-first seeds, nearest-seed assignment → contiguous, legible regions
  const k = Math.min(topics.length, 6, Math.max(1, Math.floor(tiles.length / 3)));
  if (k > 0) {
    const seeds = [rng.pick(tiles)]; while (seeds.length < k) { let b = tiles[0]!, bd = -1; for (const t of tiles) { if (seeds.includes(t)) continue; const d = Math.min(...seeds.map((s) => hexDist(s, t))); if (d > bd) { bd = d; b = t; } } seeds.push(b); }
    tiles.forEach((t) => { let bi = 0, bd = 1e9; seeds.forEach((s, i) => { const d = hexDist(s, t) + i * 1e-6; if (d < bd) { bd = d; bi = i; } }); t.topic = topics[bi % topics.length]!; });
  }
  const maxD = Math.max(1, ...tiles.map((t) => Math.min(...caps.map((c) => hexDist(c, t)))));
  const biomes = BIOMES[world];
  tiles.forEach((t) => {
    const d = Math.min(...caps.map((c) => hexDist(c, t))) / maxD;
    t.diff = d <= 1 / 3 ? 1 : d <= 2 / 3 ? 2 : 3; t.value = t.diff;
    const zi = t.topic ? topics.indexOf(t.topic) : 0; t.biome = biomes[(zi + (t.id % 2)) % biomes.length]!;
  });
  const rel = Math.round(tiles.length * (objective === 'expedition' ? 0.35 : 0.2));
  rng.shuffle(tiles.filter((t) => !t.capital)).slice(0, rel).forEach((t) => { t.hidden = true; t.relic = objective === 'expedition' ? 3 : 2; });
  return { tiles, blocked, minCapitalDistance: minCap };
}

export function scoreOf(g: EmpireG, team: string): number {
  let s = 0;
  for (const t of g.tiles) if (t.owner === team) {
    s += t.value + (t.fort ? 1 : 0) + t.relic;
    if (t.capital) s += g.objective === 'capital' ? 6 : 3;
  }
  return s;
}
const wrongs = (c: Core, team: string) => c.evidence.filter((e) => e.team === team && e.grade === 'wrong').length;

function onAnswer(s: GameState<EmpireG>, a: VerifiedAnswer, ask: AskInfo) {
  const { core: c, g } = s;
  const frac = a.grade === 'correct' ? 1 : a.grade === 'partial' ? 0.5 : 0;
  if (ask.purpose === 'turn') {
    const gain = a.grade === 'correct' ? 2 : a.grade === 'partial' ? 1 : 0;
    g.energy[a.teamId] = Math.min(ENERGY_CAP, (g.energy[a.teamId] ?? 0) + gain); g.gained[a.teamId] = gain;
    log(c, `ans_${a.grade}`, a.teamId, { gain }); fx(c, a.grade === 'wrong' ? 'miss' : 'energy', a.teamId);
    if (a.grade === 'wrong' && ask.ref !== null) { const t = g.tiles[Number(ask.ref)]; if (t) { t.misses++; if (t.misses >= 2) t.review = true; } }
    if (a.grade !== 'wrong' && ask.ref !== null) { const t = g.tiles[Number(ask.ref)]; if (t) { t.review = false; } }
  } else if (ask.purpose === 'duel_attack' && g.duel) { g.duel.atk = frac; g.duel.stage = 'defend'; log(c, `duel_${a.grade}`, a.teamId); }
  else if (ask.purpose === 'duel_defend' && g.duel) {
    const d = g.duel, tile = g.tiles[d.tile]!; const bonus = tile.fort ? 0.5 : 0;
    const win = (d.atk ?? 0) > frac + bonus;
    if (win) { const had = tile.capital; tile.owner = d.attacker; tile.fort = false; log(c, had ? 'captureCapital' : 'duelWon', d.attacker, { tile: tile.id }); fx(c, 'capture', d.attacker, tile.id); }
    else { log(c, 'duelHeld', d.defender, { tile: tile.id }); fx(c, 'hold', d.defender, tile.id); }
    g.lastDuel = { tile: d.tile, winner: win ? d.attacker : d.defender, attacker: d.attacker }; g.duel = null;
  }
}
function afterAsk(s: GameState<EmpireG>) {
  const { core: c, g } = s; const a = c.ask!;
  if (a.purpose === 'turn') {
    const anyEnergy = a.teamIds.some((id) => (g.energy[id] ?? 0) > 0);
    c.phase = anyEnergy ? 'planning' : 'review';
  } else c.phase = 'planning';
}

function askSpec(s: GameState<EmpireG>, p: Record<string, unknown>) {
  const { core: c, g } = s;
  if (g.duel) {
    const t = g.tiles[g.duel.tile]!; const attack = g.duel.stage === 'attack';
    return { teamIds: [attack ? g.duel.attacker : g.duel.defender], topic: t.topic, difficulty: Math.max(2, t.diff) as Difficulty, purpose: attack ? 'duel_attack' : 'duel_defend', ref: String(t.id) };
  }
  if (c.phase !== 'choose') return err('wrongPhase', { phase: c.phase });
  let tileId = typeof p.tile === 'number' ? p.tile : g.target;
  if (tileId === null || tileId === undefined) {
    const me = actorTeam(c).id; const cand = g.tiles.find((t) => t.owner === null && reachable(g, me, t.id)) ?? g.tiles.find((t) => t.owner === null);
    tileId = cand ? cand.id : null;
  }
  const t = tileId !== null ? g.tiles[tileId] : undefined;
  return { teamIds: askTeams(c), topic: t?.topic ?? null, difficulty: (t?.diff ?? null) as Difficulty | null, purpose: 'turn', ref: t ? String(t.id) : null };
}

function command(s: GameState<EmpireG>, cmd: GameCommand, _env: Env): ReduceResult {
  const { core: c, g } = s; const p = (cmd.payload ?? {}) as Record<string, unknown>;
  const team = typeof p.team === 'string' ? p.team : actorTeam(c).id;
  const tileId = typeof p.tile === 'number' ? p.tile : -1; const tile = g.tiles[tileId];
  const spend = (n: number) => { g.energy[team] = (g.energy[team] ?? 0) - n; };
  switch (cmd.action) {
    case 'choose_zone': {
      if (c.phase !== 'choose') return err('wrongPhase', { phase: c.phase });
      if (!tile) return err('badTile'); g.target = tile.id; log(c, 'zoneChosen', actorTeam(c).id, { tile: tile.id }); fx(c, 'target', actorTeam(c).id, tile.id); return { ok: true, state: s };
    }
    case 'cancel_choice': { if (c.phase !== 'choose' || g.target === null) return err('nothingToUndo'); g.target = null; log(c, 'undo'); return { ok: true, state: s }; }
    case 'continue': { if (c.phase !== 'review') return err('wrongPhase', { phase: c.phase }); endTurn(s); return { ok: true, state: s }; }
    case 'end_turn': { if (c.phase !== 'planning') return err('wrongPhase', { phase: c.phase }); if (g.duel) return err('duelOpen'); endTurn(s); return { ok: true, state: s }; }
    case 'claim': case 'fortify': case 'research': case 'bridge': case 'challenge': {
      if (c.phase !== 'planning') return err('wrongPhase', { phase: c.phase });
      if (g.duel) return err('duelOpen');
      if (!c.teams.some((t) => t.id === team)) return err('badTeam');
      if (!mayAct(c, team)) return err('notYourTurn');
      const cost = COST[cmd.action];
      if ((g.energy[team] ?? 0) < cost) return err('noEnergy', { need: cost, have: g.energy[team] ?? 0 });
      if (cmd.action === 'bridge') {
        const a = typeof p.a === 'number' ? p.a : -1, b = typeof p.b === 'number' ? p.b : -1; const key = ek(a, b);
        if (!g.tiles[a] || !g.tiles[b] || !neighborsOf(g, a).includes(b)) return err('badEdge');
        if (!g.blocked.includes(key)) return err('notBlocked'); if (g.bridges.includes(key)) return err('alreadyBridged');
        if (g.tiles[a]!.owner !== team && g.tiles[b]!.owner !== team) return err('bridgeNeedsOwned');
        g.bridges.push(key); spend(cost); log(c, 'bridge', team); fx(c, 'bridge', team, key); return { ok: true, state: s };
      }
      if (!tile) return err('badTile');
      if (cmd.action === 'claim') {
        if (tile.owner) return err('tileTaken'); if (!reachable(g, team, tile.id)) return err('notAdjacent');
        tile.owner = team; tile.review = false; spend(cost); log(c, 'claim', team, { tile: tile.id }); fx(c, 'claim', team, tile.id); return { ok: true, state: s };
      }
      if (cmd.action === 'fortify') {
        if (tile.owner !== team) return err('notOwned'); if (tile.fort) return err('alreadyFort');
        tile.fort = true; spend(cost); log(c, 'fortify', team, { tile: tile.id }); fx(c, 'fortify', team, tile.id); return { ok: true, state: s };
      }
      if (cmd.action === 'research') {
        if (!(tile.owner === team || reachable(g, team, tile.id))) return err('notAdjacent'); if (!tile.hidden) return err('nothingHidden');
        tile.hidden = false; spend(cost); log(c, 'research', team, { tile: tile.id, pts: tile.relic }); fx(c, 'research', team, tile.id); return { ok: true, state: s };
      }
      // challenge
      if (!tile.owner || tile.owner === team) return err('notEnemy'); if (!reachable(g, team, tile.id)) return err('notAdjacent');
      g.duel = { tile: tile.id, attacker: team, defender: tile.owner, stage: 'attack', atk: null }; spend(cost);
      log(c, 'challenge', team, { tile: tile.id }); fx(c, 'challenge', team, tile.id); return { ok: true, state: s };
    }
    default: return err('unknownAction');
  }
}

function standings(s: GameState<EmpireG>): Standing[] {
  const { core: c, g } = s;
  const rows = c.teams.map((t) => ({ team: t.id, score: scoreOf(g, t.id), rank: 0, detail: { tiles: ownedBy(g, t.id).length, forts: ownedBy(g, t.id).filter((x) => x.fort).length, misses: wrongs(c, t.id) } }));
  // tie-break: fewer incorrect attempts; shown as a fraction so an exact tie stays a shared rank
  return rows.map((r) => ({ ...r, score: r.score + 0 })).sort((a, b) => b.score - a.score || (a.detail.misses - b.detail.misses));
}

const mod: GameModule<EmpireG> = {
  key: 'empire_race',
  init(core, a: InitArgs) {
    const world = a.settings.world ?? 'archipelago'; const objective = a.settings.objective ?? 'territory';
    const topics = [...new Set(a.pool.filter((p) => p.repeatOf === null && p.topic).map((p) => p.topic!))];
    const map = buildMap(a.teams, a.plan.tiles, world, objective, topics, a.seed);
    const energy: Record<string, number> = {}; a.teams.forEach((t) => { energy[t.id] = 0; });
    void core;
    return { world, objective, tiles: map.tiles, blocked: map.blocked, bridges: [], energy, target: null, duel: null, comeback: a.settings.comeback !== false, gained: {}, lastDuel: null, minCapitalDistance: map.minCapitalDistance };
  },
  askSpec: askSpec as GameModule<EmpireG>['askSpec'], onAnswer, afterAsk, command, standings,
  outcome(s, reason) { const top = standings(s); return reason === 'objective' ? 'objective' : top.length > 1 && top[0]!.score === top[1]!.score ? 'draw' : 'winner'; },
  checkEnd(s) {
    const { g } = s;
    if (g.tiles.every((t) => t.owner)) return 'objective';
    if (g.objective === 'capital') { const caps = g.tiles.filter((t) => t.capital); const owners = new Set(caps.map((t) => t.owner)); if (owners.size === 1) return 'objective'; }
    return null;
  },
  onTurnStart(s) {
    const { core: c, g } = s;
    if (!g.comeback || c.teams.length < 3 || c.round <= 1 || c.askMode === 'all') return;
    const me = actorTeam(c).id; const sc = c.teams.map((t) => scoreOf(g, t.id)); const min = Math.min(...sc);
    if (scoreOf(g, me) === min && sc.filter((x) => x === min).length === 1 && (g.energy[me] ?? 0) < ENERGY_CAP) { g.energy[me] = (g.energy[me] ?? 0) + 1; log(c, 'comeback', me); }
    g.target = null; void teamName;
  },
};
registerGame(mod as unknown as GameModule);
export default mod;
