import { z } from 'zod';
import { isHost } from '@/lib/quiz/rooms';
import { assertSameOrigin, failure, jsonBody, rateLimit, rpc, success } from '@/lib/quiz/api';

const schema = z.discriminatedUnion('action', [
  z.object({ playerId: z.string().uuid(), action: z.enum(['approve', 'remove', 'ban']) }),
  z.object({ playerId: z.string().uuid(), action: z.literal('warn') }),
  z.object({ playerId: z.string().uuid(), action: z.enum(['freeze', 'shadow']), on: z.boolean() }),
]);

/** Host-only moderation, audited in SQL. approve/remove/ban change who is in the room; warn/freeze/shadow change how their play counts. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const { id } = await params;
    const { user } = await isHost(id);
    await rateLimit(req, 'moderate', 120, 600, user.id);
    const body = schema.parse(await jsonBody(req));
    if (body.action === 'warn' || body.action === 'freeze' || body.action === 'shadow') {
      const on = 'on' in body ? body.on : true;
      return success(await rpc('moderate_player_v2', { p_room: id, p_host: user.id, p_player: body.playerId, p_action: body.action, p_on: on }));
    }
    return success(await rpc('moderate_player', { p_room: id, p_host: user.id, p_player: body.playerId, p_action: body.action }));
  } catch (e) { return failure(e); }
}
