/** The shared turn engine. Pure: (state, command, env) → next state, or a Need the server must satisfy first (open a question,
 *  grade an answer, reveal). Reducers never read a clock, a network or a claimed result; correctness only arrives as `env.answer`,
 *  which the server builds from a committed submission row. */
import { pickQuestion, topicsOf } from './planner';
import type { AskInfo, Core, Env, GameCommand, GameKey, GameState, LearningFocus, ProjectorModifier, ReduceResult, Standing, TeamRef, VerifiedAnswer } from './types';
import { err } from './types';
import type { Plan } from './scale';
import type { ProjectorSettings } from './types';

export type InitArgs = { seed: string; focus: LearningFocus; lowPressure: boolean; teams: TeamRef[]; turnBudget: number; secondsPerTurn: number; askMode: 'single' | 'all'; pool: Env['pool']; settings: ProjectorSettings; plan: Plan; mods?: readonly ProjectorModifier[] };

/** A game whose score is a native, spendable points balance exposes it here. Only such games accept Secret Wager and Steal the Question:
 *  both are settled in that balance, never in a separate ledger. */
export type Wallet<G> = {
  balance(s: GameState<G>, team: string): number;
  add(s: GameState<G>, team: string, delta: number): void;
  /** what one standard question earns at this answer fraction (0..1): the reward for a successful steal */
  earn(fraction: number): number;
  /** the largest wager a team may commit (also capped by its balance) */
  wagerCap: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each reducer narrows its own state shape; the registry stores them type-erased
export interface GameModule<G = any> {
  key: GameKey;
  init(core: Core, a: InitArgs): G;
  /** build the question request for the `ask` action (or an error) */
  askSpec(s: GameState<G>, payload: Record<string, unknown>, env: Env): { teamIds: string[]; topic: string | null; difficulty: 1 | 2 | 3 | null; purpose: string; ref: string | null; kinds?: readonly string[] } | ReduceResult & { ok: false };
  onAnswer(s: GameState<G>, a: VerifiedAnswer, ask: AskInfo): void;
  afterAsk(s: GameState<G>): void;
  command(s: GameState<G>, cmd: GameCommand, env: Env): ReduceResult;
  standings(s: GameState<G>): Standing[];
  outcome(s: GameState<G>, reason: string): string;
  /** objective check after any state change; return a reason to end the match */
  checkEnd(s: GameState<G>): 'objective' | 'defeat' | null;
  /** extra turns are rarely needed by games (kept for symmetry) */
  onTurnStart?(s: GameState<G>): void;
  /** called when the teacher skips the acting team's turn, BEFORE the turn advances (refund stakes, void unpaid choices) */
  onSkip?(s: GameState<G>, teamId: string): void;
  /** called once, BEFORE standings are computed, whenever the match ends for any reason (settle or void pending commitments) */
  onFinish?(s: GameState<G>, reason: string): void;
  /** present only on games whose score is a native spendable balance (see Wallet) */
  wallet?: Wallet<G>;
}

const MODULES: Partial<Record<GameKey, GameModule>> = {};
export function registerGame(m: GameModule) { MODULES[m.key] = m; }
export function moduleFor(k: GameKey): GameModule { const m = MODULES[k]; if (!m) throw new Error(`Game module not registered: ${k}`); return m; }

export function initCore(game: GameKey, a: InitArgs): Core {
  return {
    v: 1, game, seed: a.seed, focus: a.focus, lowPressure: a.lowPressure, teams: a.teams, askMode: a.askMode, turnBudget: a.turnBudget,
    turnsUsed: 0, round: 1, actor: 0, phase: 'choose', ask: null, consumed: [], usedPositions: [], evidence: [], log: [], seq: 0, fx: null,
    finishAfterTurn: false, extensions: [], finished: null, skipped: [], secondsPerTurn: a.secondsPerTurn,
    mods: { wager: !!a.mods?.includes('secret_wager'), rebound: !!a.mods?.includes('steal_question') && a.askMode === 'single' }, wagers: {}, rebound: null,
  };
}

export const teamName = (c: Core, id: string) => c.teams.find((t) => t.id === id)?.name ?? '?';
export const actorTeam = (c: Core): TeamRef => c.teams[c.actor % c.teams.length]!;
export function log(c: Core, k: string, team?: string, p?: Record<string, string | number>) {
  c.seq++; c.log.push({ n: c.seq, k, ...(team ? { team } : {}), ...(p ? { p } : {}) }); if (c.log.length > 40) c.log.shift();
}
export function fx(c: Core, kind: string, team?: string, ref?: string | number) { c.fx = { n: (c.fx?.n ?? 0) + 1, kind, ...(team ? { team } : {}), ...(ref !== undefined ? { ref } : {}) }; }

export function finish(s: GameState, reason: Core['finished'] extends infer F ? (F extends { reason: infer R } ? R : never) : never) {
  const m = moduleFor(s.core.game);
  if (s.core.wagers && Object.keys(s.core.wagers).length) { s.core.wagers = {}; log(s.core, 'wagersVoided'); } // an unsettled wager costs nothing
  s.core.rebound = null;
  m.onFinish?.(s, reason);
  const standings = m.standings(s).sort((a, b) => b.score - a.score);
  let rank = 0, prev: number | null = null;
  standings.forEach((st, i) => { if (st.score !== prev) rank = i + 1; st.rank = rank; prev = st.score; });
  s.core.phase = 'finished'; s.core.ask = null;
  s.core.finished = { reason, outcome: m.outcome(s, reason), standings };
  log(s.core, 'finished', undefined, { reason });
  fx(s.core, 'finish');
}

/** End of a turn: count it, rotate, check objective / budget. Same transition for every game. */
export function endTurn(s: GameState) {
  const c = s.core, m = moduleFor(c.game);
  c.ask = null; c.rebound = null;
  if (c.wagers) for (const k of Object.keys(c.wagers)) delete c.wagers[k]; // wagers only ever ride on the question of their own turn
  if (c.askMode === 'all') { c.turnsUsed += c.teams.length; c.actor = 0; c.round++; }
  else {
    c.turnsUsed++;
    const wrapped = (c.actor + 1) % c.teams.length === 0;
    c.actor = (c.actor + 1) % c.teams.length; if (wrapped) c.round++;
  }
  c.phase = 'choose';
  const end = m.checkEnd(s);
  if (end) return finish(s, end);
  if (c.finishAfterTurn) return finish(s, 'time');
  if (c.turnsUsed >= c.turnBudget) return finish(s, 'turns');
  m.onTurnStart?.(s);
  const end2 = m.checkEnd(s);
  if (end2) finish(s, end2);
}

const canAct = (c: Core) => c.phase !== 'finished';
const TEXT = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Entry point for every teacher command. */
export function reduce(state: GameState, cmd: GameCommand, env: Env): ReduceResult {
  const s = JSON.parse(JSON.stringify(state)) as GameState;
  const c = s.core, m = moduleFor(c.game);
  const p = (cmd.payload ?? {}) as Record<string, unknown>;
  if (c.phase === 'finished' && !['noop'].includes(cmd.action)) return err('finished');
  switch (cmd.action) {
    case 'finish_now': finish(s, 'teacher'); return { ok: true, state: s };
    case 'finish_turn': c.finishAfterTurn = true; log(c, 'finishTurnSet'); fx(c, 'note'); return { ok: true, state: s };
    case 'time_up': {
      if (c.phase === 'asking' || c.phase === 'planning' || c.phase === 'review') { c.finishAfterTurn = true; log(c, 'timeUpFinishTurn'); }
      else finish(s, 'time');
      return { ok: true, state: s };
    }
    case 'extend': {
      const minutes = Math.round(Number(p.minutes)); const reason = TEXT(p.reason, 120);
      if (!(minutes >= 1 && minutes <= 60)) return err('badExtend');
      if (reason.length < 3) return err('reasonRequired');
      const extra = Math.ceil((minutes * 60 * 0.9) / c.secondsPerTurn / c.teams.length) * c.teams.length;
      c.turnBudget += Math.max(extra, c.teams.length); c.extensions.push({ minutes, reason }); c.finishAfterTurn = false;
      log(c, 'extended', undefined, { minutes }); fx(c, 'note');
      return { ok: true, state: s };
    }
    case 'skip_turn': {
      const reason = TEXT(p.reason, 160);
      if (reason.length < 3) return err('reasonRequired');
      if (c.phase === 'asking' && (c.ask?.answered.length ?? 0) > 0) return err('answersAlready');
      const t = actorTeam(c); c.skipped.push({ team: t.id, reason }); log(c, 'turnSkipped', t.id);
      if (c.wagers?.[t.id]) delete c.wagers[t.id];
      m.onSkip?.(s, t.id);
      endTurn(s); return { ok: true, state: s };
    }
    case 'reveal': {
      if (!c.ask) return err('nothingToReveal');
      if (!env.revealed) return { ok: true, state, need: { type: 'reveal' } };
      if (c.rebound && !c.rebound.used) { c.rebound = null; log(c, 'reboundClosed'); } // once the answer is on screen nobody can still try it
      log(c, 'revealed'); fx(c, 'reveal');
      if (c.phase === 'asking' && c.ask.answered.length >= c.ask.teamIds.length) m.afterAsk(s);
      return { ok: true, state: s };
    }
    case 'ask': {
      if (c.phase !== 'choose' && c.phase !== 'planning' && c.phase !== 'review') return err('wrongPhase', { phase: c.phase });
      const spec = m.askSpec(s, p, env);
      if ('ok' in spec) return spec as ReduceResult;
      if (!env.question) return { ok: true, state, need: { type: 'ask', teamIds: spec.teamIds, topic: spec.topic, difficulty: spec.difficulty, purpose: spec.purpose, ref: spec.ref } };
      const q = env.question;
      if (c.usedPositions.includes(q.position)) return err('questionUsed');
      c.usedPositions.push(q.position);
      c.ask = { position: q.position, roomQuestionId: q.roomQuestionId, topic: q.topic, difficulty: q.difficulty, kind: q.kind, teamIds: spec.teamIds, answered: [], purpose: spec.purpose, ref: spec.ref, topicFallback: q.topicFallback, repeat: q.repeat };
      c.phase = 'asking'; log(c, 'asked', spec.teamIds[0], { purpose: spec.purpose }); fx(c, 'ask', spec.teamIds[0]);
      return { ok: true, state: s };
    }
    case 'grade': {
      const teamId = TEXT(p.teamId, 60);
      if (c.phase !== 'asking' || !c.ask) return err('wrongPhase', { phase: c.phase });
      if (!c.ask.teamIds.includes(teamId)) return err('notAsked');
      if (c.ask.answered.includes(teamId)) return err('alreadyGraded');
      if (!env.answer) return { ok: true, state, need: { type: 'grade', teamId } };
      const a = env.answer;
      if (a.teamId !== teamId || a.roomQuestionId !== c.ask.roomQuestionId || a.position !== c.ask.position) return err('answerMismatch');
      if (c.consumed.includes(a.submissionId)) return err('alreadyConsumed');
      c.consumed.push(a.submissionId);
      c.evidence.push({ sub: a.submissionId, team: a.teamId, pos: a.position, topic: a.topic, kind: a.kind, grade: a.grade, fraction: a.fraction, manual: a.teacherOverride, purpose: c.ask.purpose });
      if (c.evidence.length > 300) c.evidence.shift();
      const ask = c.ask;
      ask.answered.push(teamId);
      m.onAnswer(s, a, ask);
      settleWager(s, a);
      // Steal the Question: a wrong answer in round robin opens the same question to one other team (the teacher decides who, or passes)
      if (c.mods?.rebound && c.askMode === 'single' && a.grade === 'wrong' && c.teams.length > 1 && m.wallet && !c.rebound) {
        c.rebound = { position: a.position, roomQuestionId: a.roomQuestionId, from: teamId, used: false, team: null }; log(c, 'reboundOpen', teamId);
      }
      if ((c.phase as string) !== 'finished' && ask.answered.length >= ask.teamIds.length) m.afterAsk(s);
      const end = (c.phase as string) === 'finished' ? null : m.checkEnd(s);
      if (end) finish(s, end);
      return { ok: true, state: s };
    }
    case 'wager': {
      if (!c.mods?.wager || !m.wallet) return err('modifierOff', { modifier: 'secret_wager' });
      if (c.phase !== 'choose') return err('wagerBeforeQuestion');
      const team = TEXT(p.team, 60); const amount = Number(p.amount);
      if (!c.teams.some((t) => t.id === team)) return err('teamUnknown');
      if (!mayAct(c, team)) return err('notYourTurn');
      if (!Number.isInteger(amount) || amount < 0) return err('badWager');
      const cap = Math.min(m.wallet.wagerCap, m.wallet.balance(s, team));
      if (amount > cap) return err('wagerTooHigh', { max: cap });
      c.wagers ??= {};
      if (amount === 0) delete c.wagers[team]; else c.wagers[team] = amount;
      log(c, amount ? 'wagerSet' : 'wagerCleared', team); fx(c, 'note', team);
      return { ok: true, state: s };
    }
    case 'rebound': {
      if (!c.mods?.rebound || !m.wallet) return err('modifierOff', { modifier: 'steal_question' });
      const r = c.rebound; const team = TEXT(p.team, 60);
      if (!r || r.used) return err('noRebound');
      if (team === r.from) return err('reboundSameTeam');
      if (!c.teams.some((t) => t.id === team)) return err('teamUnknown');
      if (!env.answer) return { ok: true, state, need: { type: 'rebound', teamId: team } };
      const a = env.answer;
      if (a.teamId !== team || a.roomQuestionId !== r.roomQuestionId || a.position !== r.position) return err('answerMismatch');
      if (c.consumed.includes(a.submissionId)) return err('alreadyConsumed');
      c.consumed.push(a.submissionId);
      c.evidence.push({ sub: a.submissionId, team, pos: a.position, topic: a.topic, kind: a.kind, grade: a.grade, fraction: a.fraction, manual: a.teacherOverride, purpose: 'rebound' });
      if (c.evidence.length > 300) c.evidence.shift();
      const gain = a.grade === 'wrong' ? 0 : m.wallet.earn(gradeFraction(a));
      if (gain > 0) m.wallet.add(s, team, gain);
      r.used = true; r.team = team;
      log(c, gain ? 'reboundWon' : 'reboundMissed', team, { n: gain }); fx(c, gain ? 'gain' : 'miss', team);
      return { ok: true, state: s };
    }
    case 'rebound_pass': {
      if (!c.rebound || c.rebound.used) return err('noRebound');
      c.rebound = null; log(c, 'reboundPassed'); return { ok: true, state: s };
    }
    default: {
      if (!canAct(c)) return err('finished');
      const r = m.command(s, cmd, env);
      if (r.ok && !r.need) { const st = r.state; const end = st.core.phase === 'finished' ? null : m.checkEnd(st); if (end) finish(st, end); }
      return r;
    }
  }
}

/** Utility used by game modules to build an ask for the acting team (single) or everyone (all). */
/** Secret Wager: settled exactly once, on the verified answer of the team that committed it. Correct wins it, wrong loses it (never more than
 *  the team holds), a partial answer returns it untouched. No other outcome is possible, so the teacher can preview it in full. */
function settleWager(s: GameState, a: VerifiedAnswer) {
  const c = s.core; const w = c.wagers?.[a.teamId]; const wallet = moduleFor(c.game).wallet;
  if (!w || !wallet) return;
  delete c.wagers![a.teamId];
  if (a.grade === 'correct') { wallet.add(s, a.teamId, w); log(c, 'wagerWon', a.teamId, { n: w }); }
  else if (a.grade === 'wrong') { const loss = Math.min(w, wallet.balance(s, a.teamId)); wallet.add(s, a.teamId, -loss); log(c, 'wagerLost', a.teamId, { n: loss }); }
  else log(c, 'wagerReturned', a.teamId, { n: w });
}

export function askTeams(c: Core, only?: string): string[] { return only ? [only] : c.askMode === 'all' ? c.teams.map((t) => t.id) : [actorTeam(c).id]; }
export { pickQuestion, topicsOf };

/** Team who may act in the planning phase: the actor (single) or any team (all). */
export function mayAct(c: Core, teamId: string): boolean { return c.askMode === 'all' || actorTeam(c).id === teamId; }
export function gradeFraction(a: VerifiedAnswer): number { return a.grade === 'correct' ? 1 : a.grade === 'partial' ? Math.max(0.25, Math.min(0.75, a.fraction || 0.5)) : 0; }
