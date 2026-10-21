/** Weekly missions: a few education goals, capped, never measured in screen time. Quiet notifications wait until a question or session is over. Pure. */
import { weekKey } from './coins';
export type MissionId = 'finish_three_quizzes' | 'fix_three_mistakes' | 'try_new_format' | 'create_a_quiz';
export type Mission = { id: MissionId; title: string; target: number; coins: number; audience: 'student' | 'teacher' | 'both' };
export const MISSIONS: readonly Mission[] = [
  { id: 'finish_three_quizzes', title: 'Finish three quizzes', target: 3, coins: 15, audience: 'both' },
  { id: 'fix_three_mistakes', title: 'Correct three earlier mistakes', target: 3, coins: 15, audience: 'student' },
  { id: 'try_new_format', title: 'Try a question format you have not played', target: 1, coins: 10, audience: 'both' },
  { id: 'create_a_quiz', title: 'Create and save a quiz', target: 1, coins: 20, audience: 'teacher' },
];
export const WEEKLY_COIN_CAP = 40;
export type MissionEvent = { id: string; mission: MissionId; day: string };
/** Progress counts each event id once and only inside the week; no mission can be completed by time spent on screen. */
export function weeklyProgress(events: readonly MissionEvent[], day: string, audience: 'student' | 'teacher') {
  const wk = weekKey(day); const seen = new Set<string>(); let budget = WEEKLY_COIN_CAP;
  return MISSIONS.filter((m) => m.audience === 'both' || m.audience === audience).map((m) => {
    const n = events.filter((e) => e.mission === m.id && weekKey(e.day) === wk && !seen.has(e.id) && (seen.add(e.id), true)).length;
    const done = n >= m.target; const pay = done ? Math.min(m.coins, budget) : 0; budget -= pay;
    return { mission: m, progress: Math.min(n, m.target), done, payable: pay };
  });
}
/** Reward toasts never interrupt: held while a question is open, released afterwards, oldest first, at most three per release. */
export function releaseQuiet<T>(queue: readonly T[], state: { questionOpen: boolean; paused?: boolean }, max = 3): { show: T[]; keep: T[] } {
  if (state.questionOpen) return { show: [], keep: [...queue] };
  return { show: queue.slice(0, max), keep: queue.slice(max) };
}
