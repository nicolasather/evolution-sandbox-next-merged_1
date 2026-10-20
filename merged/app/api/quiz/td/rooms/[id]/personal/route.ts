import { assertSameOrigin, failure, rateLimit, success } from '@/lib/quiz/api';
import { openPersonal } from '@/lib/quiz/td/server';
import { roomIdOf, seatFrom } from '@/lib/quiz/td/http';

/** Independent flow: reserve one personal question for this round (capped per player per round). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const id = await roomIdOf(params);
    const { seatId } = await seatFrom(id);
    await rateLimit(req, 'td-personal', 30, 60, seatId);
    return success({ question: await openPersonal(id, seatId) });
  } catch (e) { return failure(e); }
}
