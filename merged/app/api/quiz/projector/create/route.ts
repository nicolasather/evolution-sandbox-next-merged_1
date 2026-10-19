import { currentUser } from '@/lib/quiz/supabase';
import { createProjectorRoom } from '@/lib/quiz/projector/create';
import { assertSameOrigin, failure, jsonBody, rateLimit, success } from '@/lib/quiz/api';

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    await rateLimit(req, 'projector-create', 20, 600);
    const user = await currentUser();
    return success(await createProjectorRoom(await jsonBody(req), user), 201);
  } catch (e) { return failure(e); }
}
