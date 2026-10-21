import { assertSameOrigin, failure, rateLimit, success } from '@/lib/quiz/api';
import { answer } from '@/lib/quiz/arena/server';
import { arenaAnswerSchema, MAX_ANSWER_BYTES } from '@/lib/quiz/arena/validation';
import { boundedJson, roomIdOf, seatFrom } from '@/lib/quiz/arena/http';

/** A student's quiz answer, graded only by the existing five-stage pipeline. The result stays private until the reveal. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const id = await roomIdOf(params);
    const { seatId, token } = await seatFrom(id);
    await rateLimit(req, 'arena-answer', 60, 60, seatId);
    const body = arenaAnswerSchema.parse(await boundedJson(req, MAX_ANSWER_BYTES));
    return success(await answer(id, token, seatId, { roomQuestionId: body.roomQuestionId, response: body.response }));
  } catch (e) { return failure(e); }
}
