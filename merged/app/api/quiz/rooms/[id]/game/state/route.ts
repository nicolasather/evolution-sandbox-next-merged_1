import { z } from 'zod';
import { isHost } from '@/lib/quiz/rooms';
import { snapshot } from '@/lib/quiz/projector/server';
import { failure, success } from '@/lib/quiz/api';

/** Host-authenticated. `?view=projector` returns the classroom-screen projection (no answer key, no per-answer evidence). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = z.string().uuid().parse((await params).id);
    await isHost(id);
    const view = new URL(req.url).searchParams.get('view') === 'projector' ? 'projector' : 'host';
    return success(await snapshot(id, view));
  } catch (e) { return failure(e); }
}
