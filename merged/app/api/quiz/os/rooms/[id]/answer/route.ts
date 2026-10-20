import { assertSameOrigin, failure, jsonBody, rateLimit, success } from '@/lib/quiz/api';
import { answer } from '@/lib/quiz/os/server';
import { osAnswerSchema } from '@/lib/quiz/os/validation';
import { roomIdOf, seatFrom } from '@/lib/quiz/os/http';

/** A student's barrier answer, graded only by the existing five-stage pipeline. The result stays private until the reveal. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const id = await roomIdOf(params);
    const { seatId, token } = await seatFrom(id);
    await rateLimit(req, 'os-answer', 60, 60, seatId);
    const body = osAnswerSchema.parse(await jsonBody(req));
    return success(await answer(id, token, seatId, { roomQuestionId: body.roomQuestionId, response: body.response }));
  } catch (e) { return failure(e); }
}
