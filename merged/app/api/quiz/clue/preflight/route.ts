import { currentUser } from '@/lib/quiz/supabase';
import { assertSameOrigin, failure, rateLimit, success } from '@/lib/quiz/api';
import { preflight } from '@/lib/quiz/cr/server';
import { crPreflightSchema, MAX_PACKET_BYTES } from '@/lib/quiz/cr/validation';
import { boundedJson } from '@/lib/quiz/cr/http';

/** What an Clue Racing lesson would contain with this quiz: windows, leg length and whether the quiz is long enough. Never invents questions. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    await rateLimit(req, 'cr-preflight', 120, 600);
    await currentUser();
    const v = crPreflightSchema.parse(await boundedJson(req, MAX_PACKET_BYTES));
    return success({ ...(await preflight(v)), request: v });
  } catch (e) { return failure(e); }
}
