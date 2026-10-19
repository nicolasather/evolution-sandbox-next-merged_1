import { z } from 'zod';
import { currentUser } from '@/lib/quiz/supabase';
import { preflight } from '@/lib/quiz/projector/server';
import { assertSameOrigin, failure, jsonBody, rateLimit, success } from '@/lib/quiz/api';
import { projectorCreateSchema } from '@/lib/quiz/validation';
import { planFor } from '@/lib/quiz/projector/scale';

const schema = projectorCreateSchema.pick({ quizId: true, game: true, minutes: true, focus: true }).extend({ teams: z.number().int().min(2).max(8) });
/** Honest preview before the room exists: how much game fits, and whether the quiz can feed it. Never fabricates questions. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    await rateLimit(req, 'projector-preflight', 120, 600);
    await currentUser();
    const v = schema.parse(await jsonBody(req));
    const { plan, check } = await preflight(v.quizId, { v: 1, game: v.game, focus: v.focus, minutes: v.minutes, seed: 'preview', settings: {} }, v.teams);
    const alt = v.minutes !== null && !check.ok && check.fitMinutes ? planFor(v.game, check.fitMinutes, v.teams, v.focus, ['multiple_choice']).turnBudget : null;
    return success({ plan, check, fitTurns: alt });
  } catch (e) { return failure(e); }
}
