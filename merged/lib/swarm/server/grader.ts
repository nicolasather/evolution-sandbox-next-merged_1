/** Server-side grading for Swarm answers. Reuses the platform's own grading (same five kinds, same partial-credit rules) so a Swarm answer is
 *  judged exactly like a classroom answer. The client's payload is only ever a response; correctness and fraction are computed here. */
import { assertResponseIds, gradeDetailed } from '../../quiz/grading';
import type { StoredQuestion } from '../../quiz/public';
import type { Question } from '../../quiz/types';

export type Graded = { ok: true; frac: number; correct: boolean } | { ok: false; message: string };
export const toQuestion = (r: StoredQuestion): Question => ({ id: r.id, kind: r.kind as Question['kind'], prompt: r.prompt, payload: r.payload, answerKey: r.answer_key, basePoints: r.base_points });

export function gradeStored(row: StoredQuestion, response: unknown): Graded {
  try {
    const q = toQuestion(row);
    assertResponseIds(q, response);
    const g = gradeDetailed(q, response);
    const frac = Number.isFinite(g.fraction) ? Math.min(1, Math.max(0, g.correct ? 1 : g.fraction)) : 0;
    return { ok: true, frac, correct: g.correct };
  } catch (e) {
    // malformed or off-structure answers are refused (not graded as wrong) so the player can fix and resend before the deadline
    return { ok: false, message: e instanceof Error && /Answer does not|Unknown|only once|exactly|Wrong response/.test(e.message) ? e.message : 'That answer is not in the right format.' };
  }
}
