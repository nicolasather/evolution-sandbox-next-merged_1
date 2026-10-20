import { z } from 'zod';
import { assertSameOrigin, failure, jsonBody, rateLimit, success } from '@/lib/quiz/api';
import { swarmReview } from '@/lib/quiz/swarm/server';
import { swarmReviewSchema } from '@/lib/quiz/swarm/validation';

/** A student's post-match review. Authenticated by the signed seat token the worker issued at join (no account). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try { assertSameOrigin(req); await rateLimit(req, 'swarm-review', 60, 600); const id = z.string().uuid().parse((await ctx.params).id); const v = swarmReviewSchema.parse(await jsonBody(req)); return success(await swarmReview(id, v.token)); } catch (e) { return failure(e); }
}
