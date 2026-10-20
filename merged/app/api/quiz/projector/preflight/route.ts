import { z } from 'zod';
import { currentUser } from '@/lib/quiz/supabase';
import { preflight } from '@/lib/quiz/projector/server';
import { assertSameOrigin, failure, jsonBody, rateLimit, success } from '@/lib/quiz/api';
import { projectorCreateSchema } from '@/lib/quiz/validation';

const schema = projectorCreateSchema.pick({ quizId: true, game: true, minutes: true, focus: true }).extend({ teams: z.number().int().min(2).max(8) });
/** Honest preview before the room exists: how much game fits, and whether the quiz can feed it. Never fabricates questions. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    await rateLimit(req, 'projector-preflight', 120, 600);
    await currentUser();
    const v = schema.parse(await jsonBody(req));
    const { plan, check, fitTurns } = await preflight(v.quizId, { v: 1, game: v.game, focus: v.focus, minutes: v.minutes, seed: 'preview', settings: {} }, v.teams);
    // echo the request so the browser can prove which inputs this answer belongs to
    return success({ plan, check, fitTurns, request: { quizId: v.quizId, game: v.game, minutes: v.minutes, focus: v.focus, teams: v.teams } });
  } catch (e) { return failure(e); }
}
