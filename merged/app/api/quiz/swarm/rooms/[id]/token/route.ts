import { z } from 'zod';
import { currentUser } from '@/lib/quiz/supabase';
import { assertSameOrigin, failure, rateLimit, success } from '@/lib/quiz/api';
import { mintHostTokens } from '@/lib/quiz/swarm/server';

/** Signed host + projector-screen tokens for the room's owner. The host console calls this on load and on every reconnect. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try { assertSameOrigin(req); await rateLimit(req, 'swarm-token', 120, 600); const user = await currentUser(); const id = z.string().uuid().parse((await ctx.params).id); return success(await mintHostTokens(id, user.id)); } catch (e) { return failure(e); }
}
