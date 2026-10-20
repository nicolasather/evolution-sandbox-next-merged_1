import { z } from 'zod';
import { isHost } from '@/lib/quiz/rooms';
import { assertSameOrigin, failure, jsonBody, rateLimit, rpc, success } from '@/lib/quiz/api';
import { AppError } from '@/lib/quiz/errors';

const schema = z.object({ actorType: z.enum(['player', 'team']), actorId: z.string().uuid(), delta: z.number().int().min(-10000).max(10000), reason: z.string().trim().min(3).max(200) });

/** Host-only audited point correction. The reason is mandatory and kept in the audit log. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const { id } = await params;
    const { user, room } = await isHost(id);
    if ((room.config as { td?: unknown }).td) throw new AppError('Tower Defense points come only from answers.', 400);
    await rateLimit(req, 'adjust', 120, 600, user.id);
    const b = schema.parse(await jsonBody(req));
    return success(await rpc('adjust_points', { p_room: id, p_host: user.id, p_actor_type: b.actorType, p_actor: b.actorId, p_delta: b.delta, p_reason: b.reason }));
  } catch (e) { return failure(e); }
}
