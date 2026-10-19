/** FINAL SHOWDOWN — a staged tournament on a public scoreboard. Qualifiers, pressure, comeback, final.
 *
 *  Before every question the team picks a stance: STEADY (free), DOUBLE (stake 7 points, base score doubles if the answer is verified correct,
 *  the stake is lost otherwise) or SHIELD (pay 5, bank one shield that cancels the next setback). Setbacks exist only in the pressure and final
 *  stages. In the comeback stage the trailing teams are armed with a bonus. Nobody is ever eliminated: the bottom team is shown in the "danger
 *  zone" but keeps full play, and the final stage adds the same bonus for everybody. Stages follow the lesson length, so a short lesson still
 *  ends with a final. Pure reducer; stakes are refunded if a turn is skipped or the match ends before the question is answered. */
import { err, type AskInfo, type Difficulty, type Env, type GameCommand, type GameState, type ReduceResult, type Standing, type VerifiedAnswer } from '../types';
import { actorTeam, askTeams, endTurn, fx, gradeFraction, log, mayAct, registerGame, type GameModule, type InitArgs } from '../engine';

export type ShowdownChoice = 'steady' | 'double' | 'shield';
export type ShowdownStage = 'qualifiers' | 'pressure' | 'comeback' | 'final';
export const STAGES: ShowdownStage[] = ['qualifiers', 'pressure', 'comeback', 'final'];
export type ShowdownTeam = { points: number; correct: number; wrong: number; streak: number; bestStreak: number; shields: number; choice: ShowdownChoice | null; paid: number; boughtShield: boolean; armed: boolean; comebackUsed: number; doubles: number };
export type ShowdownG = { stage: ShowdownStage; teams: Record<string, ShowdownTeam>; last: { team: string; delta: number; stage: ShowdownStage; grade: string; choice: ShowdownChoice; note: string } | null };
export const BASE: Record<ShowdownStage, number> = { qualifiers: 10, pressure: 12, comeback: 12, final: 12 };
export const PENALTY: Record<ShowdownStage, number> = { qualifiers: 0, pressure: 3, comeback: 0, final: 6 };
export const FINAL_BONUS = 6;
export const COMEBACK_BONUS = 5;
export const COMEBACK_USES = 2;
export const DOUBLE_STAKE = 7;
export const SHIELD_PRICE = 5;
export const SHIELD_CAP = 2;
export const STREAK_STEP = 2;
export const STREAK_CAP = 6;
export const PREFERRED_DIFFICULTY: Record<ShowdownStage, Difficulty> = { qualifiers: 1, pressure: 2, comeback: 2, final: 3 };

/** Which stage a given round belongs to, for a lesson of `rounds` rounds. Every lesson ends in a final; longer ones add the other stages. */
export function stageFor(round: number, rounds: number): ShowdownStage {
  if (rounds <= 1) return 'final';
  if (rounds === 2) return round <= 1 ? 'qualifiers' : 'final';
  if (rounds === 3) return round <= 1 ? 'qualifiers' : round === 2 ? 'pressure' : 'final';
  const q = Math.max(1, Math.round(rounds * 0.35)), p = Math.max(1, Math.round(rounds * 0.3)), c = Math.max(1, Math.round(rounds * 0.2));
  return round <= q ? 'qualifiers' : round <= q + p ? 'pressure' : round <= q + p + c ? 'comeback' : 'final';
}
export const stageRank = (s: ShowdownStage) => STAGES.indexOf(s);
/** Trailing means in the lower half AND at least 10 points behind the leader at the moment the stance is chosen. */
export function isTrailing(g: ShowdownG, team: string): boolean {
  const pts = Object.values(g.teams).map((t) => t.points).sort((a, b) => b - a); const mine = g.teams[team]!.points;
  const median = pts[Math.floor((pts.length - 1) / 2)]!;
  return mine <= median && pts[0]! - mine >= 10 && mine < pts[0]!;
}
export const choicePrice = (c: ShowdownChoice) => (c === 'double' ? DOUBLE_STAKE : c === 'shield' ? SHIELD_PRICE : 0);
/** The most this team could gain and lose on the next question under a stance: shown on the buttons before they are pressed. */
export function stancePreview(g: ShowdownG, team: string, choice: ShowdownChoice) {
  const t = g.teams[team]!; const base = BASE[g.stage]; const armed = g.stage === 'comeback' && isTrailing(g, team) && t.comebackUsed < COMEBACK_USES;
  const win = base * (choice === 'double' ? 2 : 1) + (armed ? COMEBACK_BONUS : 0) + (g.stage === 'final' ? FINAL_BONUS : 0) + Math.min(STREAK_CAP, t.streak * STREAK_STEP) * (g.stage === 'qualifiers' ? 1 : 0);
  const shielded = t.shields > 0 || choice === 'shield';
  const setback = PENALTY[g.stage] > 0 && choice !== 'shield' ? (t.shields > 0 ? 0 : Math.min(PENALTY[g.stage], Math.max(0, t.points - choicePrice(choice)))) : 0;
  return { price: choicePrice(choice), win, setback, armed, shielded, affordable: t.points >= choicePrice(choice) };
}

function refundChoice(t: ShowdownTeam) { if (!t.choice) return; t.points += t.paid; if (t.boughtShield) t.shields = Math.max(0, t.shields - 1); t.choice = null; t.paid = 0; t.boughtShield = false; t.armed = false; }

function onAnswer(s: GameState<ShowdownG>, a: VerifiedAnswer, _ask: AskInfo) {
  const { core: c, g } = s; const t = g.teams[a.teamId]!; const stage = g.stage; const choice = t.choice ?? 'steady';
  const frac = gradeFraction(a); let delta = 0; let note = '';
  if (frac > 0) {
    let gain = Math.max(1, Math.round(BASE[stage] * frac * (choice === 'double' ? 2 : 1)));
    if (a.grade === 'correct') {
      if (stage === 'qualifiers') gain += Math.min(STREAK_CAP, t.streak * STREAK_STEP);
      if (t.armed && t.comebackUsed < COMEBACK_USES) { gain += COMEBACK_BONUS; t.comebackUsed++; note = 'comeback'; }
      if (stage === 'final') gain += FINAL_BONUS;
    }
    t.points += gain; delta = gain;
    if (a.grade === 'correct') { t.correct++; t.streak++; t.bestStreak = Math.max(t.bestStreak, t.streak); } else t.streak = 0;
    if (choice === 'double') t.doubles++;
  } else {
    t.wrong++; t.streak = 0;
    const pen = PENALTY[stage];
    if (pen > 0 && t.shields > 0) { t.shields--; note = 'shield'; log(c, 'shieldUsed', a.teamId); }
    else if (pen > 0) { const lost = Math.min(pen, t.points); t.points -= lost; delta = -lost; note = 'setback'; }
  }
  g.last = { team: a.teamId, delta, stage, grade: a.grade, choice, note };
  t.choice = null; t.paid = 0; t.boughtShield = false; t.armed = false;
  log(c, 'showdownAnswer', a.teamId, { n: delta }); fx(c, delta > 0 ? 'score' : 'miss', a.teamId, delta);
}

const mod: GameModule<ShowdownG> = {
  key: 'final_showdown',
  init(core, a: InitArgs) {
    const teams: ShowdownG['teams'] = {};
    for (const t of a.teams) teams[t.id] = { points: 0, correct: 0, wrong: 0, streak: 0, bestStreak: 0, shields: 0, choice: null, paid: 0, boughtShield: false, armed: false, comebackUsed: 0, doubles: 0 };
    return { stage: stageFor(1, Math.ceil(core.turnBudget / a.teams.length)), teams, last: null };
  },
  askSpec(s: GameState<ShowdownG>) {
    if (s.core.phase !== 'choose') return err('wrongPhase', { phase: s.core.phase });
    const ids = askTeams(s.core);
    if (ids.some((id) => !s.g.teams[id]!.choice)) return err('chooseAction');
    return { teamIds: ids, topic: null, difficulty: PREFERRED_DIFFICULTY[s.g.stage], purpose: s.g.stage, ref: s.g.stage };
  },
  onAnswer,
  afterAsk(s) { s.core.phase = 'resolution'; },
  /** The stage follows the round and never moves backwards, even if the teacher extends the lesson. */
  onTurnStart(s) { const { core: c, g } = s; const next = stageFor(c.round, Math.max(c.round, Math.ceil(c.turnBudget / c.teams.length))); if (stageRank(next) > stageRank(g.stage)) { g.stage = next; log(c, 'stageStart', undefined, { stage: next }); fx(c, 'stage', undefined, next); } },
  onSkip(s, teamId) { refundChoice(s.g.teams[teamId]!); },
  onFinish(s) { for (const t of Object.values(s.g.teams)) refundChoice(t); },
  command(s: GameState<ShowdownG>, cmd: GameCommand, _env: Env): ReduceResult {
    const { core: c, g } = s; const p = cmd.payload ?? {}; const team = typeof p.team === 'string' ? p.team : actorTeam(c).id; const t = g.teams[team];
    switch (cmd.action) {
      case 'choose_action': {
        if (c.phase !== 'choose') return err('wrongPhase', { phase: c.phase });
        if (!t) return err('badTeam'); if (!mayAct(c, team)) return err('notYourTurn'); if (t.choice) return err('alreadyChosen');
        const choice = p.choice as ShowdownChoice; if (!['steady', 'double', 'shield'].includes(choice)) return err('badAction');
        const price = choicePrice(choice); if (t.points < price) return err('insufficientPoints', { have: t.points, need: price });
        if (choice === 'shield' && t.shields >= SHIELD_CAP) return err('shieldFull', { n: SHIELD_CAP });
        t.armed = g.stage === 'comeback' && isTrailing(g, team) && t.comebackUsed < COMEBACK_USES;
        t.points -= price; t.paid = price; t.choice = choice;
        if (choice === 'shield') { t.shields++; t.boughtShield = true; }
        log(c, 'showdownChoice', team, { choice }); fx(c, 'choose', team); return { ok: true, state: s };
      }
      case 'cancel_choice': {
        if (c.phase !== 'choose') return err('wrongPhase', { phase: c.phase });
        if (!t) return err('badTeam'); if (!mayAct(c, team)) return err('notYourTurn'); if (!t.choice) return err('nothingToUndo');
        refundChoice(t); log(c, 'undo'); return { ok: true, state: s };
      }
      case 'continue': {
        if (c.phase !== 'resolution') return err('wrongPhase', { phase: c.phase });
        endTurn(s); return { ok: true, state: s };
      }
      default: return err('unknownAction');
    }
  },
  standings(s): Standing[] { return s.core.teams.map((tm) => { const t = s.g.teams[tm.id]!; return { team: tm.id, score: t.points, rank: 0, detail: { correct: t.correct, bestStreak: t.bestStreak, doubles: t.doubles } }; }); },
  outcome() { return 'showdownResult'; },
  checkEnd() { return null; },
};
registerGame(mod as unknown as GameModule);
export default mod;
