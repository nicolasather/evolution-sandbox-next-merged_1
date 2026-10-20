import { currentUser } from '@/lib/quiz/supabase';
import { assertSameOrigin, failure, jsonBody, rateLimit, success } from '@/lib/quiz/api';
import { createTDRoom } from '@/lib/quiz/td/server';

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    await rateLimit(req, 'td-create', 20, 600);
    const user = await currentUser();
    return success(await createTDRoom(await jsonBody(req), user), 201);
  } catch (e) { return failure(e); }
}
