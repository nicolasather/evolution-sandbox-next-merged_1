import { assertSameOrigin, failure, rateLimit, success } from '@/lib/quiz/api';
import { hostCommand, snapshot } from '@/lib/quiz/arena/server';
import { arenaHostSchema, MAX_PACKET_BYTES } from '@/lib/quiz/arena/validation';
import { boundedJson, hostOf, roomIdOf } from '@/lib/quiz/arena/http';

/** Teacher controls. Rate limits never block the teacher from ending or pausing an unsafe session. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const id = await roomIdOf(params);
    const { user } = await hostOf(id);
    const body = arenaHostSchema.parse(await boundedJson(req, MAX_PACKET_BYTES));
    if (!['end', 'pause'].includes(body.action.kind)) await rateLimit(req, 'arena-host', 300, 60, user.id);
    const out = await hostCommand(id, body.commandId, body.action as never);
    if (!out.ok) return Response.json({ error: out.message, code: out.code, currentRevision: out.currentRevision }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
    return success({ ...out, state: await snapshot(id, { view: 'host' }) });
  } catch (e) { return failure(e); }
}
