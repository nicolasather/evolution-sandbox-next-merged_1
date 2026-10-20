/** TERRITORY WAR — a tactical square-grid war, different from Empire Race's hex exploration.
 *
 *  Teams earn SUPPLY POINTS from verified answers and spend them in the planning phase: capture a neutral square, breach a wall, seize a square
 *  with no wall left, or fortify their own. A square only counts at full value while it is CONNECTED to a headquarters flag by a chain of the
 *  team's own squares (its supply line); cut-off squares are worth one point and are cheap to take. Objective towers are worth 4. Spawn points sit
 *  on a symmetric ring and objectives are chosen where every headquarters is about the same distance away. Nobody is ever eliminated: a team that
 *  loses its last square lands a free flag on any open square. Pure reducer. */
import { err, type AskInfo, type Difficulty, type Env, type GameCommand, type GameState, type ReduceResult, type Standing, type TerritoryBoard, type VerifiedAnswer } from '../types';
import { actorTeam, askTeams, endTurn, fx, gradeFraction, log, mayAct, registerGame, type GameModule, type InitArgs } from '../engine';
import { rngFrom } from '../rng';

export type Terrain = 'plain' | 'forest' | 'hill' | 'water';
export type TerritoryCell = { id: number; x: number; y: number; terrain: Terrain; owner: string | null; wall: number; objective: boolean; hq: string | null };
export type TerritoryTeam = { points: number; captures: number; seizures: number; breaches: number; lost: number; fortifies: number };
export type TerritoryG = {
  board: TerritoryBoard; width: number; height: number; cells: TerritoryCell[]; teams: Record<string, TerritoryTeam>;
  last: { id: number; team: string; action: 'capture' | 'breach' | 'seize' | 'fortify' | 'landing' } | null;
};
export const WALL_MAX = 3;
export const EARN = { standard: 5, challenge: 8 } as const;
export const START_POINTS = 3;
export const COST = { plain: 3, forest: 4, hill: 4, breach: 3, seize: 4, seizeHq: 5, cutOff: 2, fortifyBase: 2 } as const;
const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export const cellAt = (g: TerritoryG, x: number, y: number) => (x >= 0 && y >= 0 && x < g.width && y < g.height ? g.cells[y * g.width + x] : undefined);
export const neighbours = (g: TerritoryG, c: TerritoryCell) => DIRS.map(([dx, dy]) => cellAt(g, c.x + dx, c.y + dy)).filter((n): n is TerritoryCell => !!n && n.terrain !== 'water');
export const manhattan = (a: TerritoryCell, b: TerritoryCell) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** Squares of this team that are joined to a supply base. A base is any headquarters square the team holds; with none, its largest group is the base. */
export function supplied(g: TerritoryG, team: string): Set<number> {
  const own = g.cells.filter((c) => c.owner === team);
  const bases = own.filter((c) => c.hq);
  const seen = new Set<number>();
  const flood = (start: TerritoryCell[]) => { const out = new Set<number>(); const q = [...start]; start.forEach((c) => out.add(c.id)); while (q.length) { const cur = q.shift()!; for (const n of neighbours(g, cur)) if (n.owner === team && !out.has(n.id)) { out.add(n.id); q.push(n); } } return out; };
  if (bases.length) return flood(bases);
  let best = new Set<number>();
  for (const c of own) { if (seen.has(c.id)) continue; const comp = flood([c]); comp.forEach((id) => seen.add(id)); if (comp.size > best.size) best = comp; }
  return best;
}
export const cellValue = (c: TerritoryCell, isSupplied: boolean) => (isSupplied ? 2 + (c.objective ? 4 : 0) + c.wall : 1);
export function territoryScore(g: TerritoryG, team: string): number {
  const sup = supplied(g, team);
  return g.cells.filter((c) => c.owner === team).reduce((n, c) => n + cellValue(c, sup.has(c.id)), 0) + Math.floor((g.teams[team]?.points ?? 0) / 4);
}

export type ActionKey = 'capture' | 'breach' | 'seize' | 'fortify' | 'landing';
export type Preview = { action: ActionKey | null; cost: number; ok: boolean; reason: string; result: string };
/** What would happen if this team acted on this square: the single legal action, its cost, and the plain-language reason when it cannot be done. */
export function previewCell(g: TerritoryG, team: string, cellId: number, names: (id: string) => string = (id) => id): Preview {
  const c = g.cells[cellId]; const w = g.teams[team];
  if (!c || !w) return { action: null, cost: 0, ok: false, reason: 'Pick a square on the map.', result: '' };
  if (c.terrain === 'water') return { action: null, cost: 0, ok: false, reason: 'Water cannot be crossed or held.', result: '' };
  const mine = g.cells.some((x) => x.owner === team);
  const sup = supplied(g, team); const touching = neighbours(g, c).some((n) => n.owner === team && sup.has(n.id));
  const afford = (cost: number, action: ActionKey, result: string): Preview => ({ action, cost, ok: w.points >= cost, reason: w.points >= cost ? '' : `Needs ${cost} points; this team has ${w.points}.`, result });
  if (!mine) { if (c.owner) return { action: null, cost: 0, ok: false, reason: 'This team has no squares. Land a free flag on any open square.', result: '' }; return { action: 'landing', cost: 0, ok: true, reason: '', result: 'Plants a free flag: this team re-enters the map.' }; }
  if (!c.owner) {
    if (!touching) return { action: 'capture', cost: COST[c.terrain], ok: false, reason: 'Not next to a connected square of this team.', result: '' };
    return afford(COST[c.terrain], 'capture', `Claims the square${c.objective ? ' and its objective tower' : ''}.`);
  }
  if (c.owner === team) {
    if (c.wall >= WALL_MAX) return { action: 'fortify', cost: 0, ok: false, reason: `The wall is already at its maximum of ${WALL_MAX}.`, result: '' };
    return afford(COST.fortifyBase + c.wall, 'fortify', `Raises the wall from ${c.wall} to ${c.wall + 1}.`);
  }
  if (!touching) return { action: c.wall > 0 ? 'breach' : 'seize', cost: 0, ok: false, reason: 'Not next to a connected square of this team.', result: '' };
  const cut = !supplied(g, c.owner).has(c.id);
  if (c.wall > 0) return afford(cut ? COST.cutOff : COST.breach, 'breach', `Cracks the wall from ${c.wall} to ${c.wall - 1}.`);
  return afford(cut ? COST.cutOff : c.hq ? COST.seizeHq : COST.seize, 'seize', `Takes the square from ${names(c.owner)}${c.hq ? ' (a headquarters, worth a 3 point bonus)' : ''}.`);
}

/** Which squares this team can act on right now, for the map's highlights. */
export function legalTargets(g: TerritoryG, team: string): Record<number, ActionKey> {
  const out: Record<number, ActionKey> = {};
  for (const c of g.cells) { const p = previewCell(g, team, c.id); if (p.action && p.ok && !(p.action === 'fortify')) out[c.id] = p.action; }
  return out;
}

/* ---------- board generation (server only, deterministic) ---------- */
export function boardSize(teams: number, turnsPerTeam: number): { width: number; height: number } {
  const target = Math.max(24, teams * 6, Math.min(80, Math.round(teams * (2.4 + turnsPerTeam * 1.1))));
  const width = Math.min(10, Math.max(6, Math.ceil(Math.sqrt(target * 1.6)))); const height = Math.min(8, Math.max(4, Math.ceil(target / width)));
  return { width, height };
}
function components(cells: TerritoryCell[], w: number, h: number): TerritoryCell[][] {
  const seen = new Set<number>(); const out: TerritoryCell[][] = [];
  for (const c of cells) {
    if (c.terrain === 'water' || seen.has(c.id)) continue;
    const comp: TerritoryCell[] = []; const q = [c]; seen.add(c.id);
    while (q.length) { const cur = q.shift()!; comp.push(cur); for (const [dx, dy] of DIRS) { const nx = cur.x + dx, ny = cur.y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue; const n = cells[ny * w + nx]!; if (n.terrain !== 'water' && !seen.has(n.id)) { seen.add(n.id); q.push(n); } } }
    out.push(comp);
  }
  return out;
}
function bfsDist(cells: TerritoryCell[], w: number, h: number, from: number): number[] {
  const d = new Array<number>(cells.length).fill(-1); d[from] = 0; const q = [cells[from]!];
  while (q.length) { const cur = q.shift()!; for (const [dx, dy] of DIRS) { const nx = cur.x + dx, ny = cur.y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue; const n = cells[ny * w + nx]!; if (n.terrain !== 'water' && d[n.id] === -1) { d[n.id] = d[cur.id]! + 1; q.push(n); } } }
  return d;
}
export function generateBoard(seed: string, teams: string[], turnsPerTeam: number, board: TerritoryBoard): { width: number; height: number; cells: TerritoryCell[] } {
  const r = rngFrom(`${seed}:territory:${board}`); const { width, height } = boardSize(teams.length, turnsPerTeam);
  const cells: TerritoryCell[] = Array.from({ length: width * height }, (_, id) => ({ id, x: id % width, y: Math.floor(id / width), terrain: 'plain' as Terrain, owner: null, wall: 0, objective: false, hq: null }));
  const cx = (width - 1) / 2, cy = (height - 1) / 2;
  // terrain by theme
  if (board === 'frontier') { for (const c of cells) { const n = r.next(); c.terrain = n < 0.2 ? 'forest' : n < 0.28 ? 'hill' : 'plain'; } }
  else if (board === 'canyon') {
    const col = Math.floor(width / 2) + (r.int(2) - 0);
    for (const c of cells) { const n = r.next(); c.terrain = n < 0.18 ? 'hill' : n < 0.26 ? 'forest' : 'plain'; if (c.x === col && c.y % 3 !== 1) c.terrain = 'water'; }
  } else { // delta: lakes
    const lakes = 2 + (teams.length > 4 ? 1 : 0);
    for (let i = 0; i < lakes; i++) { const lx = 1 + r.int(width - 2), ly = 1 + r.int(height - 2), rad = 1 + r.next() * 0.9; for (const c of cells) if (Math.hypot(c.x - lx, (c.y - ly) * 1.25) < rad && (Math.abs(c.x - cx) > 1 || Math.abs(c.y - cy) > 0.6)) c.terrain = 'water'; }
    for (const c of cells) if (c.terrain === 'plain') { const n = r.next(); if (n < 0.14) c.terrain = 'forest'; else if (n < 0.2) c.terrain = 'hill'; }
  }
  // keep one connected landmass: reopen the water square that joins two separate groups
  for (let guard = 0; guard < 80; guard++) {
    const comps = components(cells, width, height); if (comps.length <= 1) break;
    const compOf = new Map<number, number>(); comps.forEach((cp, i) => cp.forEach((c) => compOf.set(c.id, i)));
    const landAround = (c: TerritoryCell) => DIRS.map(([dx, dy]) => cells[(c.y + dy) * width + c.x + dx]).filter((n, i) => !!n && (c.x + DIRS[i]![0]) >= 0 && (c.x + DIRS[i]![0]) < width && (c.y + DIRS[i]![1]) >= 0 && (c.y + DIRS[i]![1]) < height && n.terrain !== 'water');
    const bridge = cells.find((c) => c.terrain === 'water' && new Set(landAround(c).map((n) => compOf.get(n!.id))).size >= 2);
    if (bridge) { bridge.terrain = 'plain'; continue; }
    const any = cells.find((c) => c.terrain === 'water' && landAround(c).length > 0);
    if (!any) break; any.terrain = 'plain';
  }
  const land = cells.filter((c) => c.terrain !== 'water');
  // symmetric ring of headquarters
  const used = new Set<number>(); const hqs: TerritoryCell[] = []; const off = r.next() * 0.4;
  teams.forEach((_t, i) => {
    const a = (Math.PI * 2 * i) / teams.length - Math.PI / 2 + off; const tx = cx + Math.cos(a) * cx * 0.8, ty = cy + Math.sin(a) * cy * 0.8;
    const pick = land.filter((c) => !used.has(c.id) && !hqs.some((h) => manhattan(h, c) < 2)).sort((p, q) => Math.hypot(p.x - tx, p.y - ty) - Math.hypot(q.x - tx, q.y - ty))[0] ?? land.find((c) => !used.has(c.id))!;
    used.add(pick.id); hqs.push(pick);
  });
  hqs.forEach((cell, i) => { cell.terrain = 'plain'; cell.owner = teams[i]!; cell.wall = 2; cell.hq = teams[i]!; });
  // objectives where every headquarters is about equally far away
  const dists = hqs.map((h) => bfsDist(cells, width, height, h.id));
  const want = Math.max(3, Math.min(8, Math.round(land.length / 9)));
  const scored = land.filter((c) => !c.hq && hqs.every((h) => manhattan(h, c) >= 2)).map((c) => { const ds = dists.map((d) => d[c.id]!); const mean = ds.reduce((x, y) => x + y, 0) / ds.length; const vr = ds.reduce((x, y) => x + (y - mean) ** 2, 0) / ds.length; return { c, vr, mean, j: r.next() }; })
    .sort((a, b) => (a.vr - b.vr) || (a.mean - b.mean) || (a.j - b.j));
  const objs: TerritoryCell[] = [];
  for (const { c } of scored) { if (objs.length >= want) break; if (objs.every((o) => manhattan(o, c) >= 3)) objs.push(c); }
  for (const { c } of scored) { if (objs.length >= Math.min(want, 3)) break; if (!objs.includes(c)) objs.push(c); }
  objs.forEach((o) => { o.objective = true; });
  return { width, height, cells };
}

const tierOf = (v: unknown): 'standard' | 'challenge' => (v === 'challenge' ? 'challenge' : 'standard');
function onAnswer(s: GameState<TerritoryG>, a: VerifiedAnswer, ask: AskInfo) {
  const frac = gradeFraction(a); const earn = frac <= 0 ? 0 : Math.max(1, Math.round(EARN[tierOf(ask.ref)] * frac));
  s.g.teams[a.teamId]!.points += earn; fx(s.core, earn ? 'gain' : 'miss', a.teamId); log(s.core, 'earned', a.teamId, { n: earn });
}

const mod: GameModule<TerritoryG> = {
  key: 'territory_war',
  /** Native spendable balance: Secret Wager and Steal the Question settle here (one ledger, never teams.points). */
  wallet: {
    balance: (s, team) => s.g.teams[team]?.points ?? 0,
    add: (s, team, delta) => { const t = s.g.teams[team]; if (t) t.points = Math.max(0, t.points + delta); },
    earn: (fraction) => (fraction <= 0 ? 0 : Math.max(1, Math.round(EARN.standard * fraction))),
    wagerCap: EARN.standard,
  },
  init(_c, a: InitArgs) {
    const board: TerritoryBoard = a.settings.board ?? (['frontier', 'canyon', 'delta'] as const)[rngFrom(`${a.seed}:board`).int(3)]!;
    const b = generateBoard(a.seed, a.teams.map((t) => t.id), a.plan.turnsPerTeam, board);
    const teams: TerritoryG['teams'] = {}; for (const t of a.teams) teams[t.id] = { points: START_POINTS, captures: 0, seizures: 0, breaches: 0, lost: 0, fortifies: 0 };
    return { board, ...b, teams, last: null };
  },
  askSpec(s: GameState<TerritoryG>, p: Record<string, unknown>) {
    if (s.core.phase !== 'choose') return err('wrongPhase', { phase: s.core.phase });
    const tier = tierOf(p.tier);
    return { teamIds: askTeams(s.core), topic: null, difficulty: (tier === 'challenge' ? 3 : null) as Difficulty | null, purpose: 'supply', ref: tier };
  },
  onAnswer,
  afterAsk(s) { s.core.phase = 'planning'; },
  command(s: GameState<TerritoryG>, cmd: GameCommand, _env: Env): ReduceResult {
    const { core: c, g } = s; const p = cmd.payload ?? {}; const team = typeof p.team === 'string' ? p.team : actorTeam(c).id;
    if (cmd.action === 'end_turn') { if (c.phase !== 'planning') return err('wrongPhase', { phase: c.phase }); endTurn(s); return { ok: true, state: s }; }
    if (!['capture', 'breach', 'seize', 'fortify', 'landing'].includes(cmd.action)) return err('unknownAction');
    if (c.phase !== 'planning') return err('wrongPhase', { phase: c.phase });
    const w = g.teams[team]; if (!w) return err('badTeam'); if (!mayAct(c, team)) return err('notYourTurn');
    const id = Number(p.cell); if (!Number.isSafeInteger(id) || !g.cells[id]) return err('badCell');
    const cell = g.cells[id]!; const pv = previewCell(g, team, id);
    if (pv.action === null) return err('notReachable');
    if (pv.action !== cmd.action) return err('wrongAction', { want: pv.action });
    if (!pv.ok) return err(w.points < pv.cost ? 'insufficientPoints' : 'notReachable', { have: w.points, need: pv.cost });
    w.points -= pv.cost;
    const prev = cell.owner;
    switch (pv.action) {
      case 'landing': case 'capture': cell.owner = team; cell.wall = 0; w.captures++; log(c, pv.action === 'landing' ? 'landing' : 'capture', team, { cell: id + 1 }); fx(c, 'capture', team, id); break;
      case 'breach': cell.wall--; w.breaches++; log(c, 'breach', team, { cell: id + 1 }); fx(c, 'attack', team, id); break;
      case 'seize': cell.owner = team; cell.wall = 0; w.seizures++; if (prev) g.teams[prev]!.lost++; if (cell.hq) w.points += 3; log(c, cell.hq ? 'seizeHq' : 'seize', team, { cell: id + 1 }); fx(c, 'attack', team, id); break;
      case 'fortify': cell.wall++; w.fortifies++; log(c, 'fortify', team, { cell: id + 1, tile: id + 1 }); fx(c, 'fortify', team, id); break;
    }
    g.last = { id, team, action: pv.action }; return { ok: true, state: s };
  },
  standings(s): Standing[] { return s.core.teams.map((t) => ({ team: t.id, score: territoryScore(s.g, t.id), rank: 0, detail: { squares: s.g.cells.filter((x) => x.owner === t.id).length, objectives: s.g.cells.filter((x) => x.owner === t.id && x.objective).length } })); },
  outcome(_s, r) { return r === 'objective' ? 'mapFilled' : 'territoryResult'; },
  checkEnd(s) { return s.g.cells.every((c) => c.terrain === 'water' || c.owner !== null) ? 'objective' : null; },
};
registerGame(mod as unknown as GameModule);
export default mod;
