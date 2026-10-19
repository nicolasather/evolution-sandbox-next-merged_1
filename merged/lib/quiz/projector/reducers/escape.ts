/** ESCAPE ROOM — point-and-click puzzle adventure. Rewards are information and access: a question unlocks a clue item, items unlock locks, locks open doors. */
import { err, type AskInfo, type CampaignId, type Difficulty, type Env, type GameCommand, type GameState, type ReduceResult, type Standing, type VerifiedAnswer } from '../types';
import { actorTeam, askTeams, endTurn, finish, fx, log, mayAct, registerGame, type GameModule, type InitArgs } from '../engine';
import { CAMPAIGNS, hotspotNeeds, type Campaign, type Hotspot } from '../content/escape-campaigns';

export type EscapeG = {
  campaign: CampaignId; rooms: number; maxTier: 1 | 2 | 3; roomIdx: number; shared: boolean;
  inv: Record<string, string[]>; solved: string[]; inspected: string[]; opened: string[]; hints: Record<string, 0 | 1 | 2>; hintTokens: number;
  cooldown: Record<string, number>; attempts: Record<string, number>; partial: string[]; bypassed: string[]; selected: string | null;
  seals: number; escaped: boolean; trades: number; transition: { n: number; from: number; to: number } | null; topics: string[];
};
export const HINT_TOKENS = 3;
const camp = (g: EscapeG): Campaign => CAMPAIGNS[g.campaign];
export const roomOf = (g: EscapeG) => camp(g).rooms[g.roomIdx]!;
const spot = (g: EscapeG, id: string): Hotspot | undefined => roomOf(g).hotspots.find((h) => h.id === id);
const invKey = (g: EscapeG, team: string) => (g.shared ? 'shared' : team);
const held = (g: EscapeG, team: string) => g.inv[invKey(g, team)] ?? [];
export const activeSpots = (g: EscapeG) => roomOf(g).hotspots.filter((h) => h.tier <= g.maxTier);
const needsMet = (g: EscapeG, h: Hotspot, team: string) => hotspotNeeds(h, g.maxTier).every((i) => held(g, team).includes(i));

/** Rooms used = what the time allows AND what the question budget can feed (retries need slack). */
export function roomsFor(campaign: Campaign, wanted: number, maxTier: 1 | 2 | 3, budget: number): number {
  let n = Math.min(wanted, campaign.rooms.length);
  const perRoom = (t: 1 | 2 | 3) => campaign.rooms[0]!.hotspots.filter((h) => h.question && h.tier <= t).length;
  while (n > 1 && Math.ceil(perRoom(maxTier) * n * 1.35) > budget) n--;
  return Math.max(1, n);
}

function solve(s: GameState<EscapeG>, h: Hotspot, team: string, partial: boolean, bypass = false) {
  const { g, core: c } = s;
  g.solved.push(h.id); if (partial) g.partial.push(h.id); if (bypass) g.bypassed.push(h.id);
  if (h.grants) {
    if (h.slot === 'X') g.seals++;
    const k = invKey(g, team); (g.inv[k] ??= []).push(h.grants);
  }
  g.selected = null; log(c, bypass ? 'bypass' : 'solved', team, { hs: h.id }); fx(c, 'solve', team, h.id);
}

function onAnswer(s: GameState<EscapeG>, a: VerifiedAnswer, ask: AskInfo) {
  const { g, core: c } = s; const h = spot(g, ask.ref ?? '');
  if (!h) return; g.attempts[h.id] = (g.attempts[h.id] ?? 0) + 1;
  if (g.solved.includes(h.id)) return; // another team already solved it this round (synchronized): evidence only
  if (a.grade === 'wrong') { g.cooldown[h.id] = c.round; log(c, 'miss', a.teamId, { hs: h.id }); fx(c, 'miss', a.teamId, h.id); }
  else solve(s, h, a.teamId, a.grade === 'partial');
}
function afterAsk(s: GameState<EscapeG>) {
  const { g, core: c } = s; const a = c.ask!; const wrong = a.teamIds.some((id) => c.evidence.find((e) => e.team === id && e.pos === a.position)?.grade === 'wrong');
  c.phase = wrong && !g.solved.includes(a.ref ?? '') ? 'review' : 'planning';
}

function askSpec(s: GameState<EscapeG>) {
  const { g, core: c } = s;
  if (c.phase !== 'choose' && c.phase !== 'planning') return err('wrongPhase', { phase: c.phase });
  const h = g.selected ? spot(g, g.selected) : undefined;
  if (!h || !h.question) return err('chooseHotspot');
  if (h.tier > g.maxTier) return err('tierLocked'); if (g.solved.includes(h.id)) return err('alreadySolved');
  const team = actorTeam(c).id;
  if (!needsMet(g, h, team)) return err('needsItems');
  if ((g.cooldown[h.id] ?? -1) >= c.round) return err('cooldown', { turns: 1 });
  const topic = g.topics.length ? g.topics[g.roomIdx % g.topics.length]! : null;
  return { teamIds: askTeams(c), topic, difficulty: h.diff as Difficulty, purpose: 'puzzle', ref: h.id };
}

function command(s: GameState<EscapeG>, cmd: GameCommand, _env: Env): ReduceResult {
  const { g, core: c } = s; const p = (cmd.payload ?? {}) as Record<string, unknown>;
  const team = typeof p.team === 'string' ? p.team : actorTeam(c).id;
  const hid = typeof p.hotspot === 'string' ? p.hotspot : ''; const h = hid ? spot(g, hid) : undefined;
  const free = c.phase === 'choose' || c.phase === 'planning';
  switch (cmd.action) {
    case 'inspect': {
      if (!free) return err('wrongPhase', { phase: c.phase }); if (!h || h.tier > g.maxTier) return err('badHotspot');
      if (!g.inspected.includes(h.id)) g.inspected.push(h.id);
      g.selected = h.id; log(c, 'inspect', actorTeam(c).id, { hs: h.id }); fx(c, 'inspect', actorTeam(c).id, h.id); return { ok: true, state: s };
    }
    case 'cancel_choice': { if (!free || !g.selected) return err('nothingToUndo'); g.selected = null; log(c, 'undo'); return { ok: true, state: s }; }
    case 'hint': {
      if (!free) return err('wrongPhase', { phase: c.phase }); if (!h || !h.question || g.solved.includes(h.id)) return err('badHotspot');
      if ((g.hints[h.id] ?? 0) >= 2) return err('noMoreHints'); if (g.hintTokens <= 0) return err('noHintTokens');
      g.hintTokens--; g.hints[h.id] = (((g.hints[h.id] ?? 0) + 1) as 1 | 2); log(c, 'hint', actorTeam(c).id, { hs: h.id, level: g.hints[h.id]! }); fx(c, 'hint', actorTeam(c).id, h.id); return { ok: true, state: s };
    }
    case 'unlock': case 'combine': {
      if (!free) return err('wrongPhase', { phase: c.phase }); if (!h || (h.kind !== 'lock' && h.kind !== 'door') || h.tier > g.maxTier) return err('badHotspot');
      if (!mayAct(c, team)) return err('notYourTurn'); if (g.opened.includes(h.id)) return err('alreadyOpen');
      if (!needsMet(g, h, team)) return err('needsItems');
      const k = invKey(g, team);
      g.inv[k] = (g.inv[k] ?? []).filter((i) => !h.consumes.includes(i)); g.opened.push(h.id);
      if (h.grants) g.inv[k]!.push(h.grants);
      log(c, h.kind === 'door' ? 'doorOpen' : 'lockOpen', team, { hs: h.id }); fx(c, h.kind === 'door' ? 'door' : 'unlock', team, h.id);
      if (h.kind === 'door') {
        if (g.roomIdx + 1 >= g.rooms) { g.escaped = true; finish(s, 'objective'); }
        else { g.transition = { n: (g.transition?.n ?? 0) + 1, from: g.roomIdx, to: g.roomIdx + 1 }; g.roomIdx++; g.selected = null; g.hintTokens = HINT_TOKENS; log(c, 'roomEntered', team, { room: g.roomIdx + 1 }); }
      }
      return { ok: true, state: s };
    }
    case 'trade': {
      if (!free) return err('wrongPhase', { phase: c.phase }); if (g.shared) return err('sharedInventory');
      const from = String(p.from ?? ''), to = String(p.to ?? ''), item = String(p.item ?? '');
      if (!g.inv[from]?.includes(item) || !c.teams.some((t) => t.id === to) || from === to) return err('badTrade');
      g.inv[from] = g.inv[from]!.filter((i, ix, a) => i !== item || a.indexOf(i) !== ix); (g.inv[to] ??= []).push(item); g.trades++; log(c, 'trade', from, { item }); fx(c, 'trade', to); return { ok: true, state: s };
    }
    case 'bypass': {
      if (!free) return err('wrongPhase', { phase: c.phase }); const reason = String(p.reason ?? '').trim();
      if (reason.length < 3) return err('reasonRequired'); if (!h || !h.question || g.solved.includes(h.id) || h.tier > g.maxTier) return err('badHotspot');
      if (!needsMet(g, h, team)) return err('needsItems');
      c.skipped.push({ team, reason }); solve(s, h, team, false, true); return { ok: true, state: s };
    }
    case 'continue': { if (c.phase !== 'review') return err('wrongPhase', { phase: c.phase }); endTurn(s); return { ok: true, state: s }; }
    case 'end_turn': { if (!free) return err('wrongPhase', { phase: c.phase }); endTurn(s); return { ok: true, state: s }; }
    default: return err('unknownAction');
  }
}

function standings(s: GameState<EscapeG>): Standing[] {
  const { core: c } = s;
  return c.teams.map((t) => { const ev = c.evidence.filter((e) => e.team === t.id); return { team: t.id, score: ev.filter((e) => e.grade !== 'wrong').length, rank: 1, detail: { answered: ev.length, correct: ev.filter((e) => e.grade === 'correct').length } }; });
}
const mod: GameModule<EscapeG> = {
  key: 'escape_room',
  init(core, a: InitArgs) {
    const plan = a.plan;
    const cid = a.settings.campaign ?? 'clockhouse'; const campaign = CAMPAIGNS[cid];
    const rooms = roomsFor(campaign, plan.escapeRooms, plan.escapeMaxTier, a.turnBudget);
    const topics = [...new Set(a.pool.filter((p) => p.repeatOf === null && p.topic).map((p) => p.topic!))];
    void core;
    return { campaign: cid, rooms, maxTier: plan.escapeMaxTier, roomIdx: 0, shared: (plan.minutes ?? 45) <= 20 || a.teams.length <= 2, inv: {}, solved: [], inspected: [], opened: [], hints: {}, hintTokens: HINT_TOKENS, cooldown: {}, attempts: {}, partial: [], bypassed: [], selected: null, seals: 0, escaped: false, trades: 0, transition: null, topics };
  },
  askSpec: askSpec as GameModule<EscapeG>['askSpec'], onAnswer, afterAsk, command, standings,
  outcome(s) { return s.g.escaped ? 'escaped' : 'inProgress'; },
  checkEnd() { return null; },
};
registerGame(mod as unknown as GameModule);
export default mod;
