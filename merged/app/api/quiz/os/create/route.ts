import { currentUser } from '@/lib/quiz/supabase';
import { assertSameOrigin, failure, jsonBody, rateLimit, success } from '@/lib/quiz/api';
import { createOSRoom } from '@/lib/quiz/os/server';

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    await rateLimit(req, 'os-create', 20, 600);
    const user = await currentUser();
    return success(await createOSRoom(await jsonBody(req), user), 201);
  } catch (e) { return failure(e); }
}
