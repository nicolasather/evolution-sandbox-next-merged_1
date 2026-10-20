import { currentUser } from '@/lib/quiz/supabase';
import { assertSameOrigin, failure, jsonBody, rateLimit, success } from '@/lib/quiz/api';
import { preflight } from '@/lib/quiz/td/server';
import { tdPreflightSchema } from '@/lib/quiz/td/validation';

/** What a Tower Defense lesson would contain with this quiz: rounds, bosses, question time, and whether the quiz is long enough. Never invents questions. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    await rateLimit(req, 'td-preflight', 120, 600);
    await currentUser();
    const v = tdPreflightSchema.parse(await jsonBody(req));
    return success({ ...(await preflight(v)), request: v });
  } catch (e) { return failure(e); }
}
