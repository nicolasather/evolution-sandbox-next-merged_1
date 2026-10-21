import { assertSameOrigin, failure, success } from '@/lib/quiz/api';
import { makeSpectatorLink } from '@/lib/quiz/cr/server';
import { hostOf, roomIdOf } from '@/lib/quiz/cr/http';

/** A fresh read-only projector link; creating a new one revokes the previous link. The token travels in the URL fragment, never to the server log. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const id = await roomIdOf(params);
    const { user } = await hostOf(id);
    return success(await makeSpectatorLink(id, user.id));
  } catch (e) { return failure(e); }
}
