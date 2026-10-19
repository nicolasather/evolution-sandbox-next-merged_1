import { z } from 'zod';
import { isHost } from '@/lib/quiz/rooms';
import { act } from '@/lib/quiz/projector/server';
import { gameActionSchema } from '@/lib/quiz/validation';
import { assertSameOrigin, failure, jsonBody, rateLimit, success } from '@/lib/quiz/api';

/** One teacher click → at most one committed mutation. Safe to retry: the same commandId is answered from the log. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const id = z.string().uuid().parse((await params).id);
    await rateLimit(req, 'projector-action', 240, 60, id);
    const { user } = await isHost(id);
    const body = gameActionSchema.parse(await jsonBody(req));
    return success(await act({ roomId: id, hostId: user.id, ...body }));
  } catch (e) { return failure(e); }
}
