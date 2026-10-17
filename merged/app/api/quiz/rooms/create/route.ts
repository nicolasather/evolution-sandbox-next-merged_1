import { maybeUser } from '@/lib/quiz/supabase';
import { createRoom } from '@/lib/quiz/rooms';
import { assertSameOrigin, failure, jsonBody, rateLimit, success } from '@/lib/quiz/api';

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    await rateLimit(req, 'room-create', 30, 600);
    const user = await maybeUser(); // solo may be played as a guest; hosted modes require a signed-in host
    const out = await createRoom(await jsonBody(req), user);
    return success(out, 201);
  } catch (e) { return failure(e); }
}
