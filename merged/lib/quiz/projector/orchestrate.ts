/** The orchestration loop shared by the server route, the local practice lab and the tests.
 *  It fulfils the reducer's Needs through providers (DB / network on the server, fakes in tests) and then re-applies the command.
 *  Nothing here trusts a client: `grade` providers must build a VerifiedAnswer from a committed submission. */
import { reduce } from './engine';
import './games';
import { pickQuestion } from './planner';
import type { AskInfo, GameCommand, GameState, PoolQuestion, Rebound, ReduceResult, VerifiedAnswer } from './types';
import { err } from './types';

export type Providers = {
  /** open the chosen question for the asked teams; resolves with its id. Server: RPC `projector_open_question`. */
  open(pick: { position: number; teamIds: string[] }): Promise<{ roomQuestionId: string }>;
  /** grade one team on the open question. Server: runs the five-stage answer pipeline, then reads the committed row. */
  grade(teamId: string, ask: AskInfo): Promise<VerifiedAnswer>;
  /** Steal the Question: hand the still-open question to another team and grade it (server: set_steal + the five-stage pipeline). */
  rebound?(teamId: string, r: Rebound, ask: AskInfo | null): Promise<VerifiedAnswer>;
  reveal(): Promise<void>;
};

export async function run(state: GameState, cmd: GameCommand, pool: PoolQuestion[], prov: Providers): Promise<ReduceResult> {
  const first = reduce(state, cmd, { pool });
  if (!first.ok || !first.need) return first;
  const need = first.need;
  if (need.type === 'ask') {
    const pick = pickQuestion(pool, state.core.usedPositions, { topic: need.topic, difficulty: need.difficulty });
    if (!pick) return err('noQuestions');
    const entry = pool.find((p) => p.position === pick.position)!;
    const { roomQuestionId } = await prov.open({ position: pick.position, teamIds: need.teamIds });
    return reduce(state, cmd, { pool, question: { position: pick.position, roomQuestionId, topic: entry.topic, difficulty: entry.difficulty, kind: entry.kind, topicFallback: pick.topicFallback && !!need.topic, repeat: pick.repeat } });
  }
  if (need.type === 'grade') {
    const answer = await prov.grade(need.teamId, state.core.ask!);
    return reduce(state, cmd, { pool, answer });
  }
  if (need.type === 'rebound') {
    if (!prov.rebound || !state.core.rebound) return err('modifierOff', { modifier: 'steal_question' });
    const answer = await prov.rebound(need.teamId, state.core.rebound, state.core.ask);
    return reduce(state, cmd, { pool, answer });
  }
  await prov.reveal();
  return reduce(state, cmd, { pool, revealed: true });
}
