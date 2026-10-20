import { assertSameOrigin, failure, jsonBody, rateLimit, success } from '@/lib/quiz/api';
import { seatCommand, snapshot } from '@/lib/quiz/os/server';
import { osActionSchema } from '@/lib/quiz/os/validation';
import { roomIdOf, seatFrom } from '@/lib/quiz/os/http';

const STATUS: Record<string, number> = { STALE_REVISION: 409, INSUFFICIENT_POINTS: 409, PERK_LIMIT: 409, WRONG_PHASE: 409, SEAT_REVOKED: 403 };
/** One student command (role, ready, name, shop purchase). Safe to retry with the same commandId. The seat comes from the cookie; the payload can never name another squad. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const id = await roomIdOf(params);
    const { seatId } = await seatFrom(id);
    await rateLimit(req, 'os-action', 240, 60, seatId);
    const body = osActionSchema.parse(await jsonBody(req));
    const out = await seatCommand(id, seatId, body.commandId, body.action as never, body.expectedRevision);
    if (!out.ok) return Response.json({ error: out.message, code: out.code, currentRevision: out.currentRevision }, { status: STATUS[out.code] ?? 422, headers: { 'Cache-Control': 'no-store' } });
    return success({ ...out, state: await snapshot(id, { view: 'student', seatId }) });
  } catch (e) { return failure(e); }
}
