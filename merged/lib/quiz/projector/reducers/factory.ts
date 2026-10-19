/** LUCKY FACTORY — production optimisation. Verified answers earn parts points; points build, upgrade and repair machines; every shift the line ships goods.
 *
 *  A SHIFT is one round (every team has had its turn). The shift event (clear, bonus, shortage, breakdown) is drawn from the server-held seed,
 *  stored in the public state and shown for the current and the next two shifts, so every decision is made with the facts on the table. A
 *  breakdown names the machine that will fail; a safety check (only offered when a breakdown is due) saves it. Goods are produced only when a
 *  team ends its turn, never by a button that can be pressed again, and production never creates points. Pure reducer. */
import { err, type AskInfo, type Difficulty, type Env, type GameCommand, type GameState, type ReduceResult, type Standing, type VerifiedAnswer } from '../types';
import { actorTeam, askTeams, endTurn, fx, gradeFraction, log, mayAct, registerGame, type GameModule, type InitArgs } from '../engine';
import { rngFrom } from '../rng';

export type MachineKind = 'conveyor' | 'press' | 'reactor' | 'printer';
export const MACHINE_KINDS: MachineKind[] = ['conveyor', 'press', 'reactor', 'printer'];
export type Machine = { kind: MachineKind; level: number; broken: boolean };
export type FactoryEvent = 'clear' | 'bonus' | 'shortage' | 'breakdown';
export type FactoryTeam = { points: number; shipped: number; machines: Machine[]; upgrades: number; repairs: number; breakdowns: number; inspected: boolean; lastShift: number; lastOutput: number };
export type FactoryG = {
  band: string; shift: number; /** events[0] is the shift being played, [1] and [2] are the public forecast */ events: FactoryEvent[]; slots: number; teams: Record<string, FactoryTeam>;
  latest: { team: string; produced: number; event: FactoryEvent; broke: number | null; saved: boolean } | null;
};
export const PRICE: Record<MachineKind, number> = { conveyor: 4, press: 7, reactor: 10, printer: 13 };
export const OUTPUT: Record<MachineKind, number> = { conveyor: 2, press: 4, reactor: 6, printer: 8 };
export const MAX_LEVEL = 3;
export const REPAIR_COST = 3;
export const INSPECT_COST = 2;
export const EARN = { standard: 8, challenge: 11 } as const;
export const START_POINTS = 4;
export const upgradeCost = (level: number) => 4 + 3 * level;
const tierOf = (v: unknown): 'standard' | 'challenge' => (v === 'challenge' ? 'challenge' : 'standard');

/** Machines the line can run. More slots on a longer lesson. */
export function slotsFor(band: string): number { return band === 'blitz' ? 3 : band === 'short' ? 4 : band === 'standard' ? 5 : band === 'long' ? 6 : 7; }

/** The event of one shift. The first shift is always clear; a breakdown never follows a breakdown; a short lesson is gentler. */
export function drawEvent(seed: string, shift: number, band: string, previous: FactoryEvent | null): FactoryEvent {
  if (shift <= 1) return 'clear';
  const gentle = band === 'blitz' || band === 'short';
  const x = rngFrom(`${seed}:factory:${shift}`).next();
  const t = gentle ? [0.6, 0.8, 0.92] : [0.46, 0.66, 0.83];
  const e: FactoryEvent = x < t[0]! ? 'clear' : x < t[1]! ? 'bonus' : x < t[2]! ? 'shortage' : 'breakdown';
  return e === 'breakdown' && previous === 'breakdown' ? 'clear' : e;
}
/** Which working machine a breakdown takes: public and predictable, so the safety check is an informed choice. */
export function breakdownVictim(t: FactoryTeam, teamIndex: number, shift: number): number | null {
  const working = t.machines.map((m, i) => (m.broken ? -1 : i)).filter((i) => i >= 0);
  return working.length ? working[(shift + teamIndex) % working.length]! : null;
}
export function lineBonusPct(t: FactoryTeam): number { const kinds = new Set(t.machines.filter((m) => !m.broken).map((m) => m.kind)).size; return kinds >= 4 ? 25 : kinds === 3 ? 10 : 0; }
export type ShiftPreview = { base: number; bonusPct: number; event: FactoryEvent; victim: number | null; saved: boolean; output: number };
/** Exactly what the line will ship if this team ended its turn right now. */
export function previewShift(g: FactoryG, t: FactoryTeam, teamIndex: number): ShiftPreview {
  const event = g.events[0]!; const victim = event === 'breakdown' ? breakdownVictim(t, teamIndex, g.shift) : null; const saved = event === 'breakdown' && t.inspected;
  const down = victim !== null && !saved ? victim : -1;
  const base = t.machines.reduce((n, m, i) => n + (m.broken || i === down ? 0 : OUTPUT[m.kind] * m.level), 0);
  const bonusPct = lineBonusPct({ ...t, machines: t.machines.map((m, i) => (i === down ? { ...m, broken: true } : m)) });
  let out = Math.ceil(base * (1 + bonusPct / 100));
  if (event === 'bonus') out = Math.ceil(out * 1.5); else if (event === 'shortage') out = Math.ceil(out / 2);
  return { base, bonusPct, event, victim, saved, output: out };
}

function ship(s: GameState<FactoryG>, teamId: string) {
  const { core: c, g } = s; const t = g.teams[teamId]!; const idx = c.teams.findIndex((x) => x.id === teamId);
  const pv = previewShift(g, t, idx); let broke: number | null = null;
  if (pv.victim !== null && !pv.saved) { t.machines[pv.victim]!.broken = true; t.breakdowns++; broke = pv.victim; log(c, 'machineBroke', teamId, { n: pv.victim + 1 }); }
  else if (pv.saved) log(c, 'checkSavedMachine', teamId);
  t.inspected = false; t.shipped += pv.output; t.lastShift = g.shift; t.lastOutput = pv.output;
  g.latest = { team: teamId, produced: pv.output, event: pv.event, broke, saved: pv.saved };
  log(c, 'production', teamId, { n: pv.output }); fx(c, 'factory', teamId, pv.output);
}

function onAnswer(s: GameState<FactoryG>, a: VerifiedAnswer, ask: AskInfo) {
  const frac = gradeFraction(a); const n = frac <= 0 ? 0 : Math.max(1, Math.round(EARN[tierOf(ask.ref)] * frac));
  s.g.teams[a.teamId]!.points += n; fx(s.core, n ? 'gain' : 'miss', a.teamId); log(s.core, 'earned', a.teamId, { n });
}

const mod: GameModule<FactoryG> = {
  key: 'lucky_factory',
  init(_c, a: InitArgs) {
    const teams: FactoryG['teams'] = {};
    for (const t of a.teams) teams[t.id] = { points: START_POINTS, shipped: 0, machines: [{ kind: 'conveyor', level: 1, broken: false }], upgrades: 0, repairs: 0, breakdowns: 0, inspected: false, lastShift: 0, lastOutput: 0 };
    const e1 = drawEvent(a.seed, 1, a.plan.band, null), e2 = drawEvent(a.seed, 2, a.plan.band, e1), e3 = drawEvent(a.seed, 3, a.plan.band, e2);
    return { band: a.plan.band, shift: 1, events: [e1, e2, e3], slots: slotsFor(a.plan.band), teams, latest: null };
  },
  askSpec(s: GameState<FactoryG>, p: Record<string, unknown>) {
    if (s.core.phase !== 'choose') return err('wrongPhase', { phase: s.core.phase });
    const tier = tierOf(p.tier);
    return { teamIds: askTeams(s.core), topic: null, difficulty: (tier === 'challenge' ? 3 : null) as Difficulty | null, purpose: 'parts', ref: tier };
  },
  onAnswer,
  afterAsk(s) { s.core.phase = 'planning'; },
  /** A new shift begins when every team has had its turn: roll the forecast forward and let the public event queue grow by one. */
  onTurnStart(s) {
    const { core: c, g } = s;
    while (c.round > g.shift) { g.shift++; g.events.shift(); g.events.push(drawEvent(c.seed, g.shift + 2, g.band, g.events[g.events.length - 1] ?? null)); }
  },
  command(s: GameState<FactoryG>, cmd: GameCommand, _env: Env): ReduceResult {
    const { core: c, g } = s; const p = cmd.payload ?? {}; const team = typeof p.team === 'string' ? p.team : actorTeam(c).id;
    if (cmd.action === 'end_turn') {
      if (c.phase !== 'planning') return err('wrongPhase', { phase: c.phase });
      const targets = c.askMode === 'all' ? c.teams.map((t) => t.id) : [actorTeam(c).id];
      for (const id of targets) ship(s, id);
      endTurn(s); return { ok: true, state: s };
    }
    if (!['build', 'upgrade', 'repair', 'inspect'].includes(cmd.action)) return err('unknownAction');
    if (c.phase !== 'planning') return err('wrongPhase', { phase: c.phase });
    const t = g.teams[team]; if (!t) return err('badTeam'); if (!mayAct(c, team)) return err('notYourTurn');
    switch (cmd.action) {
      case 'build': {
        const kind = p.kind as MachineKind;
        if (!MACHINE_KINDS.includes(kind)) return err('badMachine');
        if (t.machines.length >= g.slots) return err('noFreeSlot', { n: g.slots });
        if (t.points < PRICE[kind]) return err('insufficientPoints', { have: t.points, need: PRICE[kind] });
        t.points -= PRICE[kind]; t.machines.push({ kind, level: 1, broken: false }); log(c, 'builtMachine', team, { kind }); fx(c, 'build', team, t.machines.length - 1); break;
      }
      case 'upgrade': {
        const i = Number(p.index), m = Number.isSafeInteger(i) ? t.machines[i] : undefined;
        if (!m) return err('badMachine'); if (m.broken) return err('repairFirst'); if (m.level >= MAX_LEVEL) return err('maxLevel');
        const cost = upgradeCost(m.level); if (t.points < cost) return err('insufficientPoints', { have: t.points, need: cost });
        t.points -= cost; m.level++; t.upgrades++; log(c, 'upgradedMachine', team, { n: i + 1, level: m.level }); fx(c, 'upgrade', team, i); break;
      }
      case 'repair': {
        const i = Number(p.index), m = Number.isSafeInteger(i) ? t.machines[i] : undefined;
        if (!m) return err('badMachine'); if (!m.broken) return err('notBroken');
        if (t.points < REPAIR_COST) return err('insufficientPoints', { have: t.points, need: REPAIR_COST });
        t.points -= REPAIR_COST; m.broken = false; t.repairs++; log(c, 'repairedMachine', team, { n: i + 1 }); fx(c, 'repair', team, i); break;
      }
      case 'inspect': {
        if (g.events[0] !== 'breakdown') return err('noBreakdownDue');
        if (t.inspected) return err('alreadyInspected');
        if (breakdownVictim(t, c.teams.findIndex((x) => x.id === team), g.shift) === null) return err('nothingToProtect');
        if (t.points < INSPECT_COST) return err('insufficientPoints', { have: t.points, need: INSPECT_COST });
        t.points -= INSPECT_COST; t.inspected = true; log(c, 'safetyCheck', team); fx(c, 'inspect', team); break;
      }
    }
    return { ok: true, state: s };
  },
  standings(s): Standing[] { return s.core.teams.map((tm) => { const t = s.g.teams[tm.id]!; return { team: tm.id, score: t.shipped + Math.floor(t.points / 5), rank: 0, detail: { shipped: t.shipped, machines: t.machines.length, upgrades: t.upgrades } }; }); },
  outcome() { return 'factoryResult'; },
  checkEnd() { return null; },
};
registerGame(mod as unknown as GameModule);
export default mod;
