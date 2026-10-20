import { assertSameOrigin, failure, jsonBody, rateLimit, success } from '@/lib/quiz/api';
import { hostCommand, snapshot } from '@/lib/quiz/os/server';
import { osHostSchema } from '@/lib/quiz/os/validation';
import { hostOf, roomIdOf } from '@/lib/quiz/os/http';

/** Teacher controls. Rate limits never block the teacher from ending or pausing an unsafe session. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const id = await roomIdOf(params);
    const { user } = await hostOf(id);
    const body = osHostSchema.parse(await jsonBody(req));
    if (!['end', 'pause'].includes(body.action.kind)) await rateLimit(req, 'os-host', 300, 60, user.id);
    const out = await hostCommand(id, body.commandId, body.action as never);
    if (!out.ok) return Response.json({ error: out.message, code: out.code, currentRevision: out.currentRevision }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
    return success({ ...out, state: await snapshot(id, { view: 'host' }) });
  } catch (e) { return failure(e); }
}
