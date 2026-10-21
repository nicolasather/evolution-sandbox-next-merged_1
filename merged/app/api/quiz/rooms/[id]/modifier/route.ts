import { getRoom, isHost, verifyPlayer } from '@/lib/quiz/rooms';
import { modifierRequestSchema } from '@/lib/quiz/validation';
import { assertSameOrigin, failure, jsonBody, rpc, success } from '@/lib/quiz/api';
import { AppError } from '@/lib/quiz/errors';
import { serviceDB } from '@/lib/quiz/supabase';
import { DEFAULT_FAIR_PLAY } from '@/lib/quiz/learning';

/** Instant point events. Hosts trigger them in classroom / online games; a solo player may trigger Potluck on themselves. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const { id } = await params;
    const v = modifierRequestSchema.parse(await jsonBody(req));
    const room = await getRoom(id);
    // Projector games and Tower Defense settle their modifiers inside their own reducers; a classic point event would act on the wrong ledger.
    if ((room.config as { swarm?: unknown }).swarm) throw new AppError('Swarm Survival has no modifiers.', 400);
    if ((room.config as { projector?: unknown; td?: unknown }).projector || (room.config as { td?: unknown }).td || (room.config as { os?: unknown }).os || (room.config as { arena?: unknown }).arena || (room.config as { cr?: unknown }).cr) throw new AppError('This game applies its modifiers through its own game controls.', 400);
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
    // Optional fair-play limits (088): a cap on how often each destructive modifier can be used, a cap on the amount, and an explicit confirmation.
    if (room.config.fairPlay && DEFAULT_FAIR_PLAY[v.kind]) {
      const limit = DEFAULT_FAIR_PLAY[v.kind]!;
      const { data: used } = await serviceDB().from('score_events').select('group_id').eq('room_id', id).eq('reason', v.kind).is('undone_at', null);
      const times = new Set((used ?? []).map((r) => r.group_id as string)).size;
      if (times >= limit.maxUses) throw new AppError(`Fair-play limit: ${v.kind.replace(/_/g, ' ')} can be used ${limit.maxUses} time${limit.maxUses === 1 ? '' : 's'} per game.`, 400);
      if (limit.confirm && !v.confirmed) throw new AppError('Please confirm this point event first.', 409);
      if (limit.maxLoss > 0 && (v.kind === 'steal_points' || v.kind === 'give_points')) v.amount = Math.min(v.amount, limit.maxLoss);
    }
    return success(await rpc('apply_modifier', { p_room: id, p_kind: v.kind, p_target: v.target, p_other: v.other ?? null, p_amount: v.amount }));
  } catch (e) { return failure(e); }
}
