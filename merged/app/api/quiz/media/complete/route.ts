import { z } from 'zod';
import { currentUser } from '@/lib/quiz/supabase';
import { assertSameOrigin, failure, jsonBody, rateLimit, success } from '@/lib/quiz/api';
import { completeUpload } from '@/lib/quiz/media/server';

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await currentUser();
    await rateLimit(req, 'quiz-media-complete', 60, 600, user.id);
    const { id } = z.object({ id: z.string().uuid() }).strict().parse(await jsonBody(req));
    return success(await completeUpload(user.id, id));
  } catch (e) { return failure(e); }
}
