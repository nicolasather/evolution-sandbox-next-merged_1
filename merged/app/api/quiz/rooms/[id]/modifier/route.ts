import { getRoom, isHost, verifyPlayer } from '@/lib/quiz/rooms';
import { modifierRequestSchema } from '@/lib/quiz/validation';
import { assertSameOrigin, failure, jsonBody, rpc, success } from '@/lib/quiz/api';
import { AppError } from '@/lib/quiz/errors';

/** Instant point events. Hosts trigger them in classroom / online games; a solo player may trigger Potluck on themselves. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const { id } = await params;
    const v = modifierRequestSchema.parse(await jsonBody(req));
    const room = await getRoom(id);
    if (room.mode === 'solo') {
      const player = await verifyPlayer(room, req.headers.get('x-player-token') ?? '');
      if (v.kind !== 'potluck') throw new AppError('That modifier is not available in solo play', 400);
      return success(await rpc('apply_modifier', { p_room: id, p_kind: 'potluck', p_target: player.id, p_other: null, p_amount: 0 }));
    }
    const { user } = await isHost(id);
    if (v.kind === 'undo') return success(await rpc('undo_latest_score_event', { p_room: id }));
    if (v.kind === 'steal_question') {
      if (!v.target) throw new AppError('Choose the team that gets the question', 400);
      return success(await rpc('set_steal', { p_room: id, p_host: user.id, p_target: v.target }));
    }
    if (!v.target) throw new AppError('Choose a target', 400);
    return success(await rpc('apply_modifier', { p_room: id, p_kind: v.kind, p_target: v.target, p_other: v.other ?? null, p_amount: v.amount }));
  } catch (e) { return failure(e); }
}
