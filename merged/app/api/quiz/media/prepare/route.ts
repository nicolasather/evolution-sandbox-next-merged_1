import { z } from 'zod';
import { currentUser } from '@/lib/quiz/supabase';
import { assertSameOrigin, failure, jsonBody, rateLimit, success } from '@/lib/quiz/api';
import { prepareUpload } from '@/lib/quiz/media/server';

const schema = z.object({ filename: z.string().max(260), mime: z.string().max(80), size: z.number().int().positive(), role: z.enum(['question', 'option', 'cover', 'poster']) }).strict();

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await currentUser();
    await rateLimit(req, 'quiz-media-prepare', 40, 600, user.id);
    return success(await prepareUpload(user.id, schema.parse(await jsonBody(req))));
  } catch (e) { return failure(e); }
}
