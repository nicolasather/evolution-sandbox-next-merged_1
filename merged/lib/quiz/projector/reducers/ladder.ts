/** RISK LADDER — climb, bank or review. Difficulty comes from question metadata (or format complexity), the consequence is shown BEFORE the choice. */
import { err, type AskInfo, type Difficulty, type Env, type GameCommand, type GameState, type LadderMission, type PoolQuestion, type ReduceResult, type Standing, type VerifiedAnswer } from '../types';
import { actorTeam, askTeams, endTurn, fx, log, mayAct, registerGame, type GameModule, type InitArgs } from '../engine';

export type LadderTeam = { tier: number; checkpoint: number; unbanked: number; banked: number; streak: number; shield: number; halfStep: 0 | 1; reviewUsed: number; chosen: 'climb' | 'bank' | 'review' | null; route: 'steady' | 'steep' | 'normal'; confidence: ('low' | 'mid' | 'high' | null); missed: string[]; calibration: { sure: number; sureRight: number; unsure: number; unsureRight: number }; falls: number };
export type LadderG = { mission: LadderMission; summit: number; maxDifficulty: Difficulty; singleBand: boolean; teams: Record<string, LadderTeam>; groupGoal: number; last: { team: string; kind: string; tier: number; gain: number } | null };
export const REVIEW_LIMIT = 2; export const SHIELD_CAP = 2;

export const tierDifficulty = (g: LadderG, tier: number): Difficulty => { const f = tier / g.summit; const d = (f <= 1 / 3 ? 1 : f <= 2 / 3 ? 2 : 3) as Difficulty; return Math.min(d, g.maxDifficulty) as Difficulty; };
export const branchTier = (g: LadderG, tier: number) => g.summit >= 6 && tier > 0 && tier < g.summit - 1 && tier % 3 === 0;
export function rewardFor(_g: LadderG, tier: number, route: LadderTeam['route']): number { return route === 'steep' ? 16 + 3 * tier : route === 'steady' ? 8 + 2 * tier : 10 + 2 * tier; }
export function nextDifficulty(g: LadderG, t: LadderTeam): Difficulty { const base = tierDifficulty(g, t.tier + 1); return (t.route === 'steep' ? Math.min(g.maxDifficulty, base + 1) : t.route === 'steady' ? Math.max(1, base - 1) : base) as Difficulty; }
/** What the team sees before deciding: gain, setback and what is at risk. */
export function previewFor(g: LadderG, t: LadderTeam) {
  const gain = rewardFor(g, t.tier + 1, t.route);
  return { gain, difficulty: nextDifficulty(g, t), fallsTo: t.shield > 0 ? t.tier : t.checkpoint, atRisk: t.shield > 0 ? 0 : t.unbanked, canBank: t.unbanked > 0, canReview: t.reviewUsed < REVIEW_LIMIT, atSummit: t.tier >= g.summit };
}

function onAnswer(s: GameState<LadderG>, a: VerifiedAnswer, ask: AskInfo) {
  const { g, core: c } = s; const t = g.teams[a.teamId]!;
  if (ask.purpose === 'review') {
    t.reviewUsed++; if (a.grade === 'correct' && t.shield < SHIELD_CAP) { t.shield++; log(c, 'shieldGained', a.teamId); fx(c, 'shield', a.teamId); } else log(c, 'reviewDone', a.teamId);
    g.last = { team: a.teamId, kind: 'review', tier: t.tier, gain: 0 }; return;
  }
  const reward = rewardFor(g, t.tier + 1, t.route);
  if (t.confidence) { const sure = t.confidence === 'high'; if (sure) { t.calibration.sure++; if (a.grade === 'correct') t.calibration.sureRight++; } else { t.calibration.unsure++; if (a.grade === 'correct') t.calibration.unsureRight++; } }
  if (a.grade === 'correct') { t.tier = Math.min(g.summit, t.tier + 1); t.unbanked += reward; t.streak++; t.halfStep = 0; log(c, 'climb', a.teamId, { tier: t.tier }); fx(c, 'climb', a.teamId, t.tier); g.last = { team: a.teamId, kind: 'climb', tier: t.tier, gain: reward }; }
  else if (a.grade === 'partial') {
    if (t.halfStep === 1) { t.tier = Math.min(g.summit, t.tier + 1); t.halfStep = 0; t.unbanked += Math.floor(reward / 2); log(c, 'climbBridge', a.teamId, { tier: t.tier }); fx(c, 'climb', a.teamId, t.tier); g.last = { team: a.teamId, kind: 'climb', tier: t.tier, gain: Math.floor(reward / 2) }; }
    else { t.halfStep = 1; t.unbanked += Math.floor(reward / 2); log(c, 'halfStep', a.teamId); fx(c, 'half', a.teamId); g.last = { team: a.teamId, kind: 'half', tier: t.tier, gain: Math.floor(reward / 2) }; }
  } else {
    if (a.topic) t.missed.push(a.topic); t.streak = 0; t.halfStep = 0;
    if (t.shield > 0) { t.shield--; log(c, 'shieldUsed', a.teamId); fx(c, 'shield', a.teamId); g.last = { team: a.teamId, kind: 'shielded', tier: t.tier, gain: 0 }; }
    else { const from = t.tier; t.tier = t.checkpoint; t.unbanked = 0; t.falls++; log(c, 'fall', a.teamId, { from, to: t.tier }); fx(c, 'fall', a.teamId, t.tier); g.last = { team: a.teamId, kind: 'fall', tier: t.tier, gain: 0 }; }
  }
  t.chosen = null; t.confidence = null; t.route = 'normal';
}
function afterAsk(s: GameState<LadderG>) {
  const { core: c } = s; const a = c.ask!; const wrong = a.teamIds.some((id) => c.evidence.find((e) => e.team === id && e.pos === a.position)?.grade === 'wrong');
  c.phase = wrong ? 'review' : 'resolution';
  for (const id of a.teamIds) { const t = s.g.teams[id]!; t.chosen = null; }
}
function askSpec(s: GameState<LadderG>, _p: Record<string, unknown>, env: Env) {
  const { g, core: c } = s; if (c.phase !== 'choose') return err('wrongPhase', { phase: c.phase });
  const ids = askTeams(c).filter((id) => g.teams[id]!.chosen === 'climb' || g.teams[id]!.chosen === 'review');
  if (!ids.length) return err('chooseAction');
  const review = ids.length === 1 && g.teams[ids[0]!]!.chosen === 'review';
  if (review) { const t = g.teams[ids[0]!]!; const topic = t.missed[t.missed.length - 1] ?? null; return { teamIds: ids, topic, difficulty: 1 as Difficulty, purpose: 'review', ref: null }; }
  if (ids.some((id) => g.teams[id]!.chosen === 'review')) return err('reviewSingleOnly');
  const diffs = ids.map((id) => nextDifficulty(g, g.teams[id]!)); const d = Math.round(diffs.reduce((x, y) => x + y, 0) / diffs.length) as Difficulty;
  void env; return { teamIds: ids, topic: null, difficulty: d, purpose: 'climb', ref: null };
}

function command(s: GameState<LadderG>, cmd: GameCommand, _env: Env): ReduceResult {
  const { g, core: c } = s; const p = (cmd.payload ?? {}) as Record<string, unknown>;
  const team = typeof p.team === 'string' ? p.team : actorTeam(c).id; const t = g.teams[team];
  switch (cmd.action) {
    case 'choose_action': {
      if (c.phase !== 'choose') return err('wrongPhase', { phase: c.phase }); if (!t) return err('badTeam'); if (!mayAct(c, team)) return err('notYourTurn');
      const a = p.action as 'climb' | 'bank' | 'review';
      if (!['climb', 'bank', 'review'].includes(a)) return err('badAction');
      if (a === 'climb' && t.tier >= g.summit) return err('atSummit');
      if (a === 'bank') {
        if (t.unbanked <= 0) return err('nothingToBank');
        t.checkpoint = t.tier; const amt = t.unbanked; t.banked += amt; t.unbanked = 0; t.chosen = null; log(c, 'bank', team, { pts: amt, tier: t.tier }); fx(c, 'bank', team, t.tier); g.last = { team, kind: 'bank', tier: t.tier, gain: amt };
        // banking is the turn: in single flow it ends the turn, in synchronized flow once every team has acted
        if (c.askMode === 'single') { endTurn(s); } return { ok: true, state: s };
      }
      if (a === 'review') { if (t.reviewUsed >= REVIEW_LIMIT) return err('reviewLimit'); if (c.askMode === 'all') return err('reviewSingleOnly'); }
      const route = p.route === 'steep' || p.route === 'steady' ? p.route : 'normal';
      if (route !== 'normal' && !branchTier(g, t.tier)) return err('noBranch');
      t.chosen = a; t.route = a === 'climb' ? route : 'normal'; t.confidence = p.confidence === 'low' || p.confidence === 'mid' || p.confidence === 'high' ? p.confidence : null;
      log(c, 'chose', team, { action: a }); fx(c, 'choose', team); return { ok: true, state: s };
    }
    case 'cancel_choice': { if (c.phase !== 'choose' || !t || !t.chosen) return err('nothingToUndo'); t.chosen = null; t.route = 'normal'; log(c, 'undo'); return { ok: true, state: s }; }
    case 'continue': { if (c.phase !== 'resolution' && c.phase !== 'review') return err('wrongPhase', { phase: c.phase }); endTurn(s); return { ok: true, state: s }; }
    case 'end_turn': { if (c.phase !== 'choose') return err('wrongPhase', { phase: c.phase }); endTurn(s); return { ok: true, state: s }; }
    default: return err('unknownAction');
  }
}
function standings(s: GameState<LadderG>): Standing[] {
  const { g, core: c } = s;
  return c.teams.map((tm) => { const t = g.teams[tm.id]!; return { team: tm.id, score: t.tier * 1000 + t.banked + t.unbanked, rank: 0, detail: { tier: t.tier, points: t.banked + t.unbanked, falls: t.falls } }; });
}
const mod: GameModule<LadderG> = {
  key: 'risk_ladder',
  init(core, a: InitArgs) {
    const plan = a.plan; const pool = a.pool as PoolQuestion[];
    const maxD = Math.max(1, ...pool.filter((p) => p.repeatOf === null).map((p) => p.difficulty ?? 1)) as Difficulty;
    const diffs = new Set(pool.filter((p) => p.repeatOf === null).map((p) => p.difficulty ?? 1));
    const teams: Record<string, LadderTeam> = {}; a.teams.forEach((t) => { teams[t.id] = { tier: 0, checkpoint: 0, unbanked: 0, banked: 0, streak: 0, shield: 0, halfStep: 0, reviewUsed: 0, chosen: null, route: 'normal', confidence: null, missed: [], calibration: { sure: 0, sureRight: 0, unsure: 0, unsureRight: 0 }, falls: 0 }; });
    const summit = plan.ladderTiers; void core;
    return { mission: a.settings.mission ?? 'highest', summit, maxDifficulty: maxD, singleBand: diffs.size <= 1, teams, groupGoal: Math.max(summit, Math.round(summit * a.teams.length * 0.7)), last: null };
  },
  askSpec: askSpec as GameModule<LadderG>['askSpec'], onAnswer, afterAsk, command, standings,
  outcome(s, reason) { return reason === 'objective' ? (s.g.mission === 'group' ? 'groupSummit' : 'summit') : 'timeUp'; },
  checkEnd(s) {
    const { g } = s; const ts = Object.values(g.teams);
    if (g.mission === 'first' && ts.some((t) => t.tier >= g.summit)) return 'objective';
    if (g.mission === 'group' && ts.reduce((x, t) => x + t.tier, 0) >= g.groupGoal) return 'objective';
    return null;
  },
};
registerGame(mod as unknown as GameModule);
export default mod;
