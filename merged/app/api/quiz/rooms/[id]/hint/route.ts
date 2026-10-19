import { z } from 'zod';
import { getRoom, verifyPlayer, roomQuestion } from '@/lib/quiz/rooms';
import { hintOf } from '@/lib/quiz/public';
import { serviceDB } from '@/lib/quiz/supabase';
import { AppError } from '@/lib/quiz/errors';
import { assertSameOrigin, failure, jsonBody, rateLimit, success } from '@/lib/quiz/api';

const schema = z.object({ token: z.string().min(8).max(160), roomQuestionId: z.string().uuid() });

/** Hints never travel with the question. A player asks for one for the ACTIVE question only, and the request is counted. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const { id } = await params;
    const b = schema.parse(await jsonBody(req));
    await rateLimit(req, 'hint', 60, 600, b.token.slice(0, 16));
    const room = await getRoom(id);
    if (room.status !== 'active') throw new AppError('This game is not active', 400);
    const player = await verifyPlayer(room, b.token);
    const q = await roomQuestion(room, room.flow === 'independent' ? player.cursor_index : room.current_index);
    if (!q || q.id !== b.roomQuestionId) throw new AppError('That is not the active question', 400);
    await serviceDB().from('audit_log').insert({ room_id: id, actor_id: null, action: 'hint_used', detail: { player: player.id, q: q.position } });
    return success({ hint: hintOf(q as never) });
  } catch (e) { return failure(e); }
}
