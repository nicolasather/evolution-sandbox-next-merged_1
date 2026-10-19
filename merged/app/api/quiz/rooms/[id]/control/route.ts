import { isHost } from '@/lib/quiz/rooms';
import { controlSchema } from '@/lib/quiz/validation';
import { assertSameOrigin, failure, jsonBody, rpc, success } from '@/lib/quiz/api';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const { id } = await params;
    const { user } = await isHost(id);
    const { action } = controlSchema.parse(await jsonBody(req));
    return success(await rpc('control_room', { p_room: id, p_host: user.id, p_action: action }));
  } catch (e) { return failure(e); }
}
