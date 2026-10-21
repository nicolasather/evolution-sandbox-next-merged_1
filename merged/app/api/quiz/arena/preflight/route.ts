import { currentUser } from '@/lib/quiz/supabase';
import { assertSameOrigin, failure, rateLimit, success } from '@/lib/quiz/api';
import { preflight } from '@/lib/quiz/arena/server';
import { arenaPreflightSchema, MAX_PACKET_BYTES } from '@/lib/quiz/arena/validation';
import { boundedJson } from '@/lib/quiz/arena/http';

/** What an Arena Clash lesson would contain with this quiz: cycles, episode length and whether the quiz is long enough. Never invents questions. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    await rateLimit(req, 'arena-preflight', 120, 600);
    await currentUser();
    const v = arenaPreflightSchema.parse(await boundedJson(req, MAX_PACKET_BYTES));
    return success({ ...(await preflight(v)), request: v });
  } catch (e) { return failure(e); }
}
