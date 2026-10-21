import { failure, success } from '@/lib/quiz/api';
import { snapshot, touch } from '@/lib/quiz/arena/server';
import { hostOf, roomIdOf, seatFrom, spectatorOf } from '@/lib/quiz/arena/http';

/** The authoritative, catch-up-then-project state for one viewer:
 *   ?view=host        the signed-in host (full state + question peek)
 *   x-arena-screen    a revocable read-only projector link (no host controls, no names, no wallets)
 *   otherwise         the student behind the seat cookie (own team + aliased rivals) */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = await roomIdOf(params);
    const view = new URL(req.url).searchParams.get('view');
    if (view === 'host') { await hostOf(id); void touch(id, { host: true }); return success(await snapshot(id, { view: 'host' })); }
    if (req.headers.get('x-arena-screen')) { await spectatorOf(req, id); return success(await snapshot(id, { view: 'projector' })); }
    const { seatId } = await seatFrom(id);
    void touch(id, { seatId });
    return success(await snapshot(id, { view: 'student', seatId }));
  } catch (e) { return failure(e); }
}
