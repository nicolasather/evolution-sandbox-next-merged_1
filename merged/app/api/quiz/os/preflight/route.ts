import { currentUser } from '@/lib/quiz/supabase';
import { assertSameOrigin, failure, jsonBody, rateLimit, success } from '@/lib/quiz/api';
import { preflight } from '@/lib/quiz/os/server';
import { osPreflightSchema } from '@/lib/quiz/os/validation';

/** What an Obstacle Survival lesson would contain with this quiz: chapters, question time, and whether the quiz is long enough. Never invents questions. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    await rateLimit(req, 'os-preflight', 120, 600);
    await currentUser();
    const v = osPreflightSchema.parse(await jsonBody(req));
    return success({ ...(await preflight({ ...v, mapId: v.mapId as never })), request: v });
  } catch (e) { return failure(e); }
}
