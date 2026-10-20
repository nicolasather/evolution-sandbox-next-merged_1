/** AUCTION HOUSE — earned points buy mystery lots at a classroom auction.
 *
 *  Round = one turn for every team. Each round a small LINEUP of lots stands on the stage (fewer lots than teams in big classes, so there is
 *  real competition). Every team answers a question, earns bid points only through its VERIFIED grade, then raises one paddle: a lot and an
 *  amount, reserved from its points. When the round is complete the gavel falls: the highest bid on each lot wins (a rotating priority order
 *  breaks ties), the winner pays, every other bid is refunded in full. Lot values stay hidden until the gavel; the shared screen only ever
 *  receives an appraisal band, and the amounts on the paddles stay hidden from the projector until the gavel. Pure reducer, no clock, no network. */
import { err, type AskInfo, type Difficulty, type Env, type GameCommand, type GameState, type ReduceResult, type Standing, type VerifiedAnswer } from '../types';
import { actorTeam, askTeams, fx, gradeFraction, log, mayAct, registerGame, endTurn, type GameModule, type InitArgs } from '../engine';
import { rngFrom } from '../rng';

export type LotKind = 'relic' | 'artifact' | 'blueprint' | 'wildcard';
export const LOT_KINDS: LotKind[] = ['relic', 'artifact', 'blueprint', 'wildcard'];
export type AuctionLot = { id: number; round: number; kind: LotKind; title: string; /** hidden from every screen until the gavel */ value: number; low: number; high: number; /** blueprints add bid points to every later correct answer */ income: number };
export type AuctionBid = { lot: number; amount: number };
export type AuctionTeam = { points: number; reserved: number; prizes: number; wins: number; spent: number; kinds: Record<LotKind, number>; income: number; passed: boolean; collections: number };
export type Resolved = { round: number; lot: AuctionLot; winner: string | null; price: number; bidders: number; tie: boolean };
export type AuctionG = {
  round: number; lotsPerRound: number; lineup: AuctionLot[]; bids: Record<string, AuctionBid>; teams: Record<string, AuctionTeam>;
  resolved: Resolved[]; nextLot: number; latest: { lot: AuctionLot; winner: string | null; price: number } | null; voided: boolean;
};

export const START_POINTS = 8;
export const EARN = { standard: 6, challenge: 9 } as const;
export const COLLECTION_BONUS = 12;
export const INCOME_CAP = 4;
const TITLES: Record<LotKind, string[]> = {
  relic: ['Ancient Compass', 'Amber Gear', 'Sun Medallion', 'Bronze Astrolabe', 'Jade Seal', 'Glass Hourglass'],
  artifact: ['Clockwork Automaton', 'Silver Observatory', 'Brass Orrery', 'Crystal Lantern', 'Iron Chronometer', 'Marble Sundial'],
  blueprint: ['Golden Blueprint', 'Workshop Plans', 'Bridge Schematic', 'Engine Drawings', 'Map Of Tunnels', 'Tower Design'],
  wildcard: ['Wildcard Crate', 'Sealed Trunk', 'Mystery Barrel', 'Locked Parcel', 'Auction Surprise', 'Covered Cart'],
};
const BASE: Record<LotKind, [number, number]> = { relic: [10, 15], artifact: [13, 19], blueprint: [7, 10], wildcard: [5, 22] };

/** How many lots stand on the stage each round. Fewer lots than teams means some paddles must lose. */
export function lotsPerRound(teams: number, turnsPerTeam: number): number { return turnsPerTeam <= 1 ? 3 : Math.max(2, Math.min(4, Math.ceil(teams / 2))); }

/** Deterministic lineup for a round: distinct kinds first, values hidden inside an appraisal band. Called on the server only. */
export function makeLineup(seed: string, round: number, count: number, firstId: number): AuctionLot[] {
  const r = rngFrom(`${seed}:auction:${round}`);
  const kinds = r.shuffle(LOT_KINDS); const inflate = 1 + Math.min(round - 1, 10) * 0.04;
  return Array.from({ length: count }, (_, i) => {
    const kind = kinds[i % kinds.length]!; const [lo, hi] = BASE[kind];
    const value = Math.round((lo + r.int(hi - lo + 1)) * inflate);
    const spread = kind === 'wildcard' ? 8 : 3;
    const low = Math.max(1, value - 2 - r.int(spread)), high = value + 2 + r.int(spread);
    const title = TITLES[kind][(round + i + r.int(3)) % TITLES[kind].length]!;
    return { id: firstId + i, round, kind, title, value, low, high, income: kind === 'blueprint' ? 1 : 0 };
  });
}
const emptyTeam = (): AuctionTeam => ({ points: START_POINTS, reserved: 0, prizes: 0, wins: 0, spent: 0, kinds: { relic: 0, artifact: 0, blueprint: 0, wildcard: 0 }, income: 0, passed: false, collections: 0 });
/** Priority order for tied bids: the team list rotated by the lot number, so every team gets first priority in turn. */
export function priorityOrder(teamIds: string[], lotId: number): string[] { const k = lotId % teamIds.length; return [...teamIds.slice(k), ...teamIds.slice(0, k)]; }
export const earnFor = (tier: 'standard' | 'challenge', t: AuctionTeam, frac: number) => (frac <= 0 ? 0 : Math.max(1, Math.round(EARN[tier] * frac)) + (frac >= 1 ? t.income : 0));
export const teamScore = (t: AuctionTeam) => t.points + t.reserved + t.prizes + t.collections * COLLECTION_BONUS;

/** What the gavel would do right now, for the teacher's preview. The projector never receives this. */
export function maxBid(g: AuctionG, team: string): number { return g.teams[team]?.points ?? 0; }

function refund(g: AuctionG, team: string) { const b = g.bids[team]; if (!b) return; const t = g.teams[team]!; t.points += b.amount; t.reserved -= b.amount; delete g.bids[team]; }

/** The gavel: settle every lot on the stage, refund every losing bid, set up the next lineup. */
function gavel(s: GameState<AuctionG>) {
  const { core: c, g } = s; const ids = c.teams.map((t) => t.id);
  for (const lot of g.lineup) {
    const entries = Object.entries(g.bids).filter(([, b]) => b.lot === lot.id);
    const order = priorityOrder(ids, lot.id);
    entries.sort((a, b) => b[1].amount - a[1].amount || order.indexOf(a[0]) - order.indexOf(b[0]));
    const top = entries[0]; const tie = !!top && entries.filter(([, b]) => b.amount === top[1].amount).length > 1;
    if (top) {
      const [winner, bid] = top; const t = g.teams[winner]!;
      t.reserved -= bid.amount; t.spent += bid.amount; t.prizes += lot.value; t.wins++; t.kinds[lot.kind]++; t.income = Math.min(INCOME_CAP, t.income + lot.income);
      delete g.bids[winner];
      if (LOT_KINDS.every((k) => t.kinds[k] > t.collections)) { t.collections++; log(c, 'collectionBonus', winner, { n: COLLECTION_BONUS }); }
      log(c, 'lotWon', winner, { price: bid.amount, value: lot.value, lot: lot.title }); fx(c, 'auction', winner, lot.id);
      g.latest = { lot, winner, price: bid.amount };
    } else { log(c, 'lotUnsold', undefined, { lot: lot.title }); g.latest = { lot, winner: null, price: 0 }; }
    g.resolved.push({ round: g.round, lot, winner: top?.[0] ?? null, price: top?.[1].amount ?? 0, bidders: entries.length, tie });
    for (const [team] of entries.slice(1)) refund(g, team); // losing paddles come back whole
  }
  for (const team of Object.keys(g.bids)) refund(g, team); // defensive: a stale bid on a lot that is not on the stage
  if (g.resolved.length > 80) g.resolved.splice(0, g.resolved.length - 80);
  for (const t of Object.values(g.teams)) t.passed = false;
  g.round = c.round; g.lineup = makeLineup(c.seed, c.round, g.lotsPerRound, g.nextLot); g.nextLot += g.lotsPerRound;
}

function onAnswer(s: GameState<AuctionG>, a: VerifiedAnswer, ask: AskInfo) {
  const t = s.g.teams[a.teamId]!; const tier = ask.ref === 'challenge' ? 'challenge' : 'standard';
  const earned = earnFor(tier, t, gradeFraction(a)); t.points += earned;
  log(s.core, 'earned', a.teamId, { n: earned }); fx(s.core, earned ? 'gain' : 'miss', a.teamId);
}

const mod: GameModule<AuctionG> = {
  key: 'auction_house',
  /** Native spendable balance: Secret Wager and Steal the Question settle here (one ledger, never teams.points). */
  wallet: {
    balance: (s, team) => s.g.teams[team]?.points ?? 0,
    add: (s, team, delta) => { const t = s.g.teams[team]; if (t) t.points = Math.max(0, t.points + delta); },
    earn: (fraction) => (fraction <= 0 ? 0 : Math.max(1, Math.round(EARN.standard * fraction))),
    wagerCap: EARN.standard,
  },
  init(_core, a: InitArgs) {
    const teams: AuctionG['teams'] = {}; for (const t of a.teams) teams[t.id] = emptyTeam();
    const per = lotsPerRound(a.teams.length, a.plan.turnsPerTeam);
    return { round: 1, lotsPerRound: per, lineup: makeLineup(a.seed, 1, per, 1), bids: {}, teams, resolved: [], nextLot: per + 1, latest: null, voided: false };
  },
  askSpec(s: GameState<AuctionG>, p: Record<string, unknown>) {
    if (s.core.phase !== 'choose') return err('wrongPhase', { phase: s.core.phase });
    const tier = p.tier === 'challenge' ? 'challenge' : 'standard';
    return { teamIds: askTeams(s.core), topic: null, difficulty: (tier === 'challenge' ? 3 : null) as Difficulty | null, purpose: 'earn', ref: tier };
  },
  onAnswer,
  afterAsk(s) { s.core.phase = 'planning'; },
  /** A new round began (every team has had its turn): the gavel falls on the previous lineup. */
  onTurnStart(s) { if (s.core.round > s.g.round) gavel(s); },
  onSkip(s, teamId) { refund(s.g, teamId); },
  onFinish(s) {
    // A complete round is settled. An unfinished round (time ran out part-way, or the teacher ended early) is withdrawn and every paddle refunded:
    // lots must never go to the teams that happened to have a turn.
    if (s.core.round > s.g.round) gavel(s);
    else { for (const team of Object.keys(s.g.bids)) refund(s.g, team); if (s.g.lineup.length) s.g.voided = true; }
  },
  command(s: GameState<AuctionG>, cmd: GameCommand, _env: Env): ReduceResult {
    const { core: c, g } = s; const p = cmd.payload ?? {}; const team = typeof p.team === 'string' ? p.team : actorTeam(c).id; const t = g.teams[team];
    switch (cmd.action) {
      case 'bid': {
        if (c.phase !== 'planning') return err('wrongPhase', { phase: c.phase });
        if (!t) return err('badTeam'); if (!mayAct(c, team)) return err('notYourTurn');
        if (g.bids[team]) return err('alreadyBid');
        const lot = Number(p.lot), amount = Number(p.amount);
        if (!g.lineup.some((l) => l.id === lot)) return err('badLot');
        if (!Number.isSafeInteger(amount) || amount < 1) return err('badAmount');
        if (amount > t.points) return err('insufficientPoints', { have: t.points, need: amount });
        t.points -= amount; t.reserved += amount; g.bids[team] = { lot, amount }; t.passed = false;
        log(c, 'paddleRaised', team); fx(c, 'bid', team, lot); return { ok: true, state: s };
      }
      case 'retract_bid': {
        if (c.phase !== 'planning') return err('wrongPhase', { phase: c.phase });
        if (!t) return err('badTeam'); if (!mayAct(c, team)) return err('notYourTurn');
        if (!g.bids[team]) return err('nothingToUndo');
        refund(g, team); log(c, 'paddleLowered', team); return { ok: true, state: s };
      }
      case 'pass_bid': {
        if (c.phase !== 'planning') return err('wrongPhase', { phase: c.phase });
        if (!t) return err('badTeam'); if (!mayAct(c, team)) return err('notYourTurn'); if (g.bids[team]) return err('alreadyBid');
        t.passed = true; log(c, 'bidPassed', team); return { ok: true, state: s };
      }
      case 'end_turn': {
        if (c.phase !== 'planning') return err('wrongPhase', { phase: c.phase });
        endTurn(s); return { ok: true, state: s };
      }
      default: return err('unknownAction');
    }
  },
  standings(s): Standing[] { return s.core.teams.map((tm) => { const t = s.g.teams[tm.id]!; return { team: tm.id, score: teamScore(t), rank: 0, detail: { points: t.points, prizes: t.prizes, lots: t.wins, collections: t.collections } }; }); },
  outcome(s, r) { return r === 'objective' ? 'auctionComplete' : s.g.voided ? 'auctionWithdrawn' : 'auctionComplete'; },
  checkEnd() { return null; },
};
registerGame(mod as unknown as GameModule);
export default mod;
