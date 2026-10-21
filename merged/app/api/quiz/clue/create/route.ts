import { currentUser } from '@/lib/quiz/supabase';
import { assertSameOrigin, failure, rateLimit, success } from '@/lib/quiz/api';
import { createCrRoom } from '@/lib/quiz/cr/server';
import { boundedJson } from '@/lib/quiz/cr/http';
import { MAX_PACKET_BYTES } from '@/lib/quiz/cr/validation';

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    await rateLimit(req, 'cr-create', 20, 600);
    const user = await currentUser();
    return success(await createCrRoom(await boundedJson(req, MAX_PACKET_BYTES), user), 201);
  } catch (e) { return failure(e); }
}
