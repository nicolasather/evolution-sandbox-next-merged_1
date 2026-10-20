import { assertSameOrigin, failure, jsonBody, rateLimit, success } from '@/lib/quiz/api';
import { answer } from '@/lib/quiz/td/server';
import { tdAnswerSchema } from '@/lib/quiz/td/validation';
import { roomIdOf, seatFrom } from '@/lib/quiz/td/http';

/** A student's answer, graded only by the existing five-stage pipeline. In synchronized play the result stays private until the reveal. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const id = await roomIdOf(params);
    const { seatId, token } = await seatFrom(id);
    await rateLimit(req, 'td-answer', 60, 60, seatId);
    const body = tdAnswerSchema.parse(await jsonBody(req));
    return success(await answer(id, token, seatId, { roomQuestionId: body.roomQuestionId, response: body.response }));
  } catch (e) { return failure(e); }
}
