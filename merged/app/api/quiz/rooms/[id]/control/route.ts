import { isHost } from '@/lib/quiz/rooms';
import { controlSchema } from '@/lib/quiz/validation';
import { serviceDB } from '@/lib/quiz/supabase';
import { AppError } from '@/lib/quiz/errors';
import { assertSameOrigin, failure, fromDbError, jsonBody, rpc, success } from '@/lib/quiz/api';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const { id } = await params;
    const { user, room } = await isHost(id);
    // Tower Defense drives its room through td_commit; a classic "next"/"reveal" here would desynchronise the match
    if ((room.config as { td?: unknown }).td) throw new AppError('Use the Tower Defense host console for this room.', 400);
    const { action } = controlSchema.parse(await jsonBody(req));
    const v2 = await serviceDB().rpc('control_room_v2', { p_room: id, p_host: user.id, p_action: action });
    if (!v2.error) return success(v2.data);
    if (!(v2.error.code === 'PGRST202' || /could not find the function|does not exist/i.test(v2.error.message ?? ''))) throw fromDbError(v2.error);
    // migration 004 not applied: the six original actions still work
    if (['skip', 'replay', 'cancel'].includes(action)) throw new AppError('That control needs the latest database update.', 503);
    return success(await rpc('control_room', { p_room: id, p_host: user.id, p_action: action }));
  } catch (e) { return failure(e); }
}
