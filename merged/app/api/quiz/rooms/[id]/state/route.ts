import { getRoom, isHost, roomPublicState, verifyPlayer } from '@/lib/quiz/rooms';
import { failure, rpc, success } from '@/lib/quiz/api';
import { z } from 'zod';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = z.string().uuid().parse((await params).id);
    let room = await getRoom(id);
    const token = req.headers.get('x-player-token');
    const player = token ? await verifyPlayer(room, token) : null;
    if (!player) await isHost(id); // throws 401/403 unless this is the signed-in host
    // Housekeeping that must happen server-side: end an expired match, move a timed-out independent player on.
    await rpc('finalize_if_expired', { p_room: id });
    if (player && room.flow === 'independent') await rpc('skip_if_timed_out', { p_room: id, p_player: player.id });
    room = await getRoom(id);
    const peek = new URL(req.url).searchParams.get('peek') === '1';
    return success(await roomPublicState(room, player ? { role: 'player', playerId: player.id } : { role: 'host' }, { peek }));
  } catch (e) { return failure(e); }
}
