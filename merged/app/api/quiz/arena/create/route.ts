import { currentUser } from '@/lib/quiz/supabase';
import { assertSameOrigin, failure, rateLimit, success } from '@/lib/quiz/api';
import { createArenaRoom } from '@/lib/quiz/arena/server';
import { boundedJson } from '@/lib/quiz/arena/http';
import { MAX_PACKET_BYTES } from '@/lib/quiz/arena/validation';

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    await rateLimit(req, 'arena-create', 20, 600);
    const user = await currentUser();
    return success(await createArenaRoom(await boundedJson(req, MAX_PACKET_BYTES), user), 201);
  } catch (e) { return failure(e); }
}
