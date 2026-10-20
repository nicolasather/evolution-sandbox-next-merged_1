import { currentUser } from '@/lib/quiz/supabase';
import { assertSameOrigin, failure, jsonBody, rateLimit, success } from '@/lib/quiz/api';
import { createSwarmRoom } from '@/lib/quiz/swarm/server';

export async function POST(req: Request) {
  try { assertSameOrigin(req); await rateLimit(req, 'swarm-create', 20, 600); const user = await currentUser(); return success(await createSwarmRoom(await jsonBody(req), user), 201); } catch (e) { return failure(e); }
}
