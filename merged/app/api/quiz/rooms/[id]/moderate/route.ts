import { z } from 'zod';
import { isHost } from '@/lib/quiz/rooms';
import { assertSameOrigin, failure, jsonBody, rateLimit, rpc, success } from '@/lib/quiz/api';

const schema = z.object({ playerId: z.string().uuid(), action: z.enum(['approve', 'remove', 'ban']) });

/** Host-only: approve a waiting player, remove one, or ban one for the rest of this room. Audited in SQL. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const { id } = await params;
    const { user } = await isHost(id);
    await rateLimit(req, 'moderate', 120, 600, user.id);
    const { playerId, action } = schema.parse(await jsonBody(req));
    return success(await rpc('moderate_player', { p_room: id, p_host: user.id, p_player: playerId, p_action: action }));
  } catch (e) { return failure(e); }
}
