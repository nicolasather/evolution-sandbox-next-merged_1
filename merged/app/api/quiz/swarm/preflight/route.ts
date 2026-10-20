import { currentUser } from '@/lib/quiz/supabase';
import { assertSameOrigin, failure, jsonBody, rateLimit, success } from '@/lib/quiz/api';
import { swarmPreflight } from '@/lib/quiz/swarm/server';

/** What a Swarm Survival session would contain with this quiz. Never invents questions. */
export async function POST(req: Request) {
  try { assertSameOrigin(req); await rateLimit(req, 'swarm-preflight', 120, 600); await currentUser(); return success(await swarmPreflight(await jsonBody(req))); } catch (e) { return failure(e); }
}
