/** PIRATE VOYAGE — sail a connected island chain, chart hidden chests, haul treasure home and raid rivals at sea.
 *
 *  Verified answers earn sailing points. Points pay for sailing along a marked route (storms cost more and are forecast one round ahead), for
 *  charting an island's chest (which reveals it to everyone), for a guard against raids, and for a raid on a rival sharing the same island.
 *  Treasure is CARGO until the ship docks at the home harbour, where it is banked; a raid can only take cargo. The winner is the team with the
 *  most banked treasure (cargo still on board counts half). Chests refill over a long voyage so a long lesson never runs dry. Geography is a
 *  fixed, validated chain; only the chest sizes and the storm tracks are drawn from the server seed. Pure reducer. */
import { err, type AskInfo, type Difficulty, type Env, type GameCommand, type GameState, type ReduceResult, type Standing, type VerifiedAnswer } from '../types';
import { actorTeam, askTeams, endTurn, fx, gradeFraction, log, mayAct, registerGame, type GameModule, type InitArgs } from '../engine';
import { rngFrom } from '../rng';

export type Island = { id: number; name: string; x: number; y: number; treasure: number; base: number; charted: boolean; hops: number; neighbors: number[] };
export type PirateTeam = { points: number; banked: number; cargo: number; position: number; guard: number; sails: number; raids: number; stolen: number; charts: number; visited: number[] };
export type PirateG = {
  round: number; islands: Island[]; storms: number[]; nextStorms: number[]; teams: Record<string, PirateTeam>;
  last: { team: string; kind: 'sail' | 'chart' | 'raid' | 'guard' | 'dock'; from?: number; to?: number; n?: number } | null;
};
/** Scene coordinates (1280 x 720). The array order guarantees that any prefix is a connected chain, so a short lesson uses fewer islands. */
export const ISLAND_DATA: { name: string; x: number; y: number }[] = [
  { name: 'Home Harbour', x: 120, y: 400 }, { name: 'Windward Isle', x: 300, y: 250 }, { name: 'Coral Reef', x: 310, y: 560 }, { name: 'Foghorn Rock', x: 510, y: 400 },
  { name: 'Iron Reef', x: 690, y: 215 }, { name: 'Crescent Bay', x: 700, y: 580 }, { name: 'Lighthouse Point', x: 890, y: 400 }, { name: 'Golden Cove', x: 1070, y: 560 },
  { name: 'Starfall Isle', x: 1090, y: 240 }, { name: 'Mist Isle', x: 500, y: 190 }, { name: 'Shark Bay', x: 500, y: 610 }, { name: 'Sunken Gate', x: 890, y: 195 }, { name: 'Dragon Spine', x: 1190, y: 400 },
];
export const ISLAND_EDGES: [number, number][] = [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4], [3, 5], [4, 6], [5, 6], [6, 7], [6, 8], [7, 8], [1, 9], [9, 4], [2, 10], [10, 5], [4, 11], [11, 8], [7, 12], [8, 12]];
export const EARN = { standard: 6, challenge: 9 } as const;
export const START_POINTS = 5;
export const COST = { calm: 3, storm: 5, chart: 2, guard: 2, raid: 4 } as const;
export const MAX_STEAL = 5;
const tierOf = (v: unknown): 'standard' | 'challenge' => (v === 'challenge' ? 'challenge' : 'standard');

export function islandCount(band: string): number { return band === 'blitz' ? 7 : band === 'short' ? 9 : band === 'standard' ? 11 : band === 'long' ? 12 : 13; }
export const connected = (g: PirateG, a: number, b: number) => g.islands[a]?.neighbors.includes(b) ?? false;
export const sailCost = (g: PirateG, to: number) => (g.storms.includes(to) ? COST.storm : COST.calm);
export const stormCostNext = (g: PirateG, to: number) => (g.nextStorms.includes(to) ? COST.storm : COST.calm);
export const teamScore = (t: PirateTeam) => t.banked + Math.floor(t.cargo / 2);
export function stealAmount(rival: PirateTeam): number { return Math.min(MAX_STEAL, Math.max(rival.cargo > 0 ? 1 : 0, Math.ceil(rival.cargo * 0.3))); }

function drawStorms(seed: string, round: number, count: number, islands: number): number[] {
  const r = rngFrom(`${seed}:storms:${round}`); const pool = Array.from({ length: islands - 1 }, (_, i) => i + 1);
  return r.shuffle(pool).slice(0, Math.min(count, pool.length)).sort((a, b) => a - b);
}
export function stormCount(islands: number) { return Math.max(1, Math.round(islands * 0.22)); }

export type SailPreview = { ok: boolean; cost: number; reason: string; storm: boolean; stormNext: boolean; docks: boolean; chest: number | null };
/** What sailing to this island would cost and do, shown before the teacher commits. */
export function previewSail(g: PirateG, team: string, to: number): SailPreview {
  const t = g.teams[team], isl = g.islands[to];
  const no = (reason: string): SailPreview => ({ ok: false, cost: 0, reason, storm: false, stormNext: false, docks: false, chest: null });
  if (!t || !isl) return no('Pick an island on the chart.');
  if (t.position === to) return no('The ship is already here.');
  if (!connected(g, t.position, to)) return no('No marked route leads there from this island.');
  const cost = sailCost(g, to);
  return { ok: t.points >= cost, cost, reason: t.points >= cost ? '' : `Needs ${cost} points; this team has ${t.points}.`, storm: g.storms.includes(to), stormNext: g.nextStorms.includes(to), docks: to === 0, chest: isl.charted ? isl.treasure : null };
}

function onAnswer(s: GameState<PirateG>, a: VerifiedAnswer, ask: AskInfo) {
  const frac = gradeFraction(a); const n = frac <= 0 ? 0 : Math.max(1, Math.round(EARN[tierOf(ask.ref)] * frac));
  s.g.teams[a.teamId]!.points += n; log(s.core, 'earned', a.teamId, { n }); fx(s.core, n ? 'wind' : 'miss', a.teamId);
}
function refill(g: PirateG) { for (const i of g.islands) if (i.id !== 0 && i.treasure === 0) { i.treasure = Math.max(3, Math.round(i.base * 0.7)); i.charted = false; } }

const mod: GameModule<PirateG> = {
  key: 'pirate_voyage',
  init(_c, a: InitArgs) {
    const n = islandCount(a.plan.band); const r = rngFrom(`${a.seed}:pirates`);
    const islands: Island[] = ISLAND_DATA.slice(0, n).map((d, id) => ({ ...d, id, treasure: 0, base: 0, charted: id === 0, hops: 0, neighbors: [] }));
    ISLAND_EDGES.filter(([x, y]) => x < n && y < n).forEach(([x, y]) => { islands[x]!.neighbors.push(y); islands[y]!.neighbors.push(x); });
    // hop distance from the home harbour (breadth-first), so far islands hold bigger chests
    const q = [0]; const seen = new Set([0]); while (q.length) { const cur = q.shift()!; for (const nb of islands[cur]!.neighbors) if (!seen.has(nb)) { seen.add(nb); islands[nb]!.hops = islands[cur]!.hops + 1; q.push(nb); } }
    for (const i of islands) if (i.id !== 0) { i.base = Math.round((6 + r.int(8)) * (1 + 0.3 * i.hops)); i.treasure = i.base; }
    const teams: PirateG['teams'] = {}; for (const t of a.teams) teams[t.id] = { points: START_POINTS, banked: 0, cargo: 0, position: 0, guard: 0, sails: 0, raids: 0, stolen: 0, charts: 0, visited: [0] };
    const k = stormCount(n);
    return { round: 1, islands, storms: drawStorms(a.seed, 1, k, n), nextStorms: drawStorms(a.seed, 2, k, n), teams, last: null };
  },
  askSpec(s: GameState<PirateG>, p: Record<string, unknown>) {
    if (s.core.phase !== 'choose') return err('wrongPhase', { phase: s.core.phase });
    const tier = tierOf(p.tier);
    return { teamIds: askTeams(s.core), topic: null, difficulty: (tier === 'challenge' ? 3 : null) as Difficulty | null, purpose: 'sailing', ref: tier };
  },
  onAnswer,
  afterAsk(s) { s.core.phase = 'planning'; },
  /** A new round: storms move on to the forecast track, a fresh forecast is drawn, and long voyages refill the chests. */
  onTurnStart(s) {
    const { core: c, g } = s; const k = stormCount(g.islands.length);
    while (c.round > g.round) { g.round++; g.storms = g.nextStorms; g.nextStorms = drawStorms(c.seed, g.round + 1, k, g.islands.length); if (g.round % 4 === 0) refill(g); }
  },
  command(s: GameState<PirateG>, cmd: GameCommand, _env: Env): ReduceResult {
    const { core: c, g } = s; const p = cmd.payload ?? {}; const team = typeof p.team === 'string' ? p.team : actorTeam(c).id;
    if (cmd.action === 'end_turn') { if (c.phase !== 'planning') return err('wrongPhase', { phase: c.phase }); endTurn(s); return { ok: true, state: s }; }
    if (!['sail', 'chart', 'raid', 'guard'].includes(cmd.action)) return err('unknownAction');
    if (c.phase !== 'planning') return err('wrongPhase', { phase: c.phase });
    const t = g.teams[team]; if (!t) return err('badTeam'); if (!mayAct(c, team)) return err('notYourTurn');
    switch (cmd.action) {
      case 'sail': {
        const to = Number(p.to); if (!Number.isSafeInteger(to) || !g.islands[to]) return err('badIsland');
        const pv = previewSail(g, team, to);
        if (!pv.ok) return err(pv.cost > 0 ? 'insufficientPoints' : 'notAdjacent', { have: t.points, need: pv.cost });
        const from = t.position; t.points -= pv.cost; t.position = to; t.sails++; if (!t.visited.includes(to)) t.visited.push(to);
        const isl = g.islands[to]!; let got = 0;
        if (to === 0) { const docked = t.cargo; if (docked > 0) { t.banked += docked; t.cargo = 0; log(c, 'dock', team, { n: docked }); } g.last = { team, kind: 'dock', from, to, n: docked }; }
        else { got = isl.treasure; if (got > 0) { t.cargo += got; isl.treasure = 0; } isl.charted = true; g.last = { team, kind: 'sail', from, to, n: got }; }
        log(c, to === 0 ? 'sailHome' : 'sail', team, { from: from + 1, to: to + 1, n: got, island: isl.name }); fx(c, 'sail', team, to); break;
      }
      case 'chart': {
        const id = Number(p.island); const isl = Number.isSafeInteger(id) ? g.islands[id] : undefined;
        if (!isl || id === 0) return err('badIsland'); if (isl.charted) return err('alreadyCharted');
        if (t.points < COST.chart) return err('insufficientPoints', { have: t.points, need: COST.chart });
        t.points -= COST.chart; isl.charted = true; t.charts++; g.last = { team, kind: 'chart', to: id }; log(c, 'chart', team, { island: isl.name }); fx(c, 'chart', team, id); break;
      }
      case 'guard': {
        if (t.guard >= 1) return err('alreadyGuarded'); if (t.points < COST.guard) return err('insufficientPoints', { have: t.points, need: COST.guard });
        t.points -= COST.guard; t.guard = 1; g.last = { team, kind: 'guard' }; log(c, 'guard', team); fx(c, 'guard', team); break;
      }
      case 'raid': {
        const rival = typeof p.rival === 'string' ? p.rival : ''; const target = g.teams[rival];
        if (!target || rival === team) return err('badRaid'); if (target.position !== t.position) return err('notSameIsland');
        if (t.position === 0) return err('safeHarbour'); if (target.cargo <= 0) return err('nothingToTake');
        if (t.points < COST.raid) return err('insufficientPoints', { have: t.points, need: COST.raid });
        t.points -= COST.raid; t.raids++;
        if (target.guard > 0) { target.guard = 0; log(c, 'raidBlocked', team); g.last = { team, kind: 'raid', n: 0 }; }
        else { const take = Math.min(target.cargo, stealAmount(target)); target.cargo -= take; t.cargo += take; t.stolen += take; g.last = { team, kind: 'raid', n: take }; log(c, 'raid', team, { n: take }); }
        fx(c, 'raid', team, t.position); break;
      }
    }
    return { ok: true, state: s };
  },
  standings(s): Standing[] { return s.core.teams.map((tm) => { const t = s.g.teams[tm.id]!; return { team: tm.id, score: teamScore(t), rank: 0, detail: { banked: t.banked, cargo: t.cargo, islands: t.visited.length } }; }); },
  outcome() { return 'voyageComplete'; },
  checkEnd() { return null; },
};
registerGame(mod as unknown as GameModule);
export default mod;
