import { assertSameOrigin, failure, rateLimit, success } from '@/lib/quiz/api';
import { seatCommand, snapshot } from '@/lib/quiz/arena/server';
import { arenaActionSchema, MAX_PACKET_BYTES } from '@/lib/quiz/arena/validation';
import { boundedJson, roomIdOf, seatFrom } from '@/lib/quiz/arena/http';

const STATUS: Record<string, number> = { STALE_REVISION: 409, INSUFFICIENT_POINTS: 409, ALREADY_BOUGHT: 409, WRONG_PHASE: 409, COOLDOWN: 409, SEAT_REVOKED: 403, ONE_PER_ROUND: 409 };
/** One student command (role, ready, name, helper purchase, ability, pass). Safe to retry with the same commandId. The seat comes from the cookie; the payload can never name another team. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const id = await roomIdOf(params);
    const { seatId } = await seatFrom(id);
    await rateLimit(req, 'arena-action', 240, 60, seatId);
    const body = arenaActionSchema.parse(await boundedJson(req, MAX_PACKET_BYTES));
    const out = await seatCommand(id, seatId, body.commandId, body.action as never, body.expectedRevision);
    if (!out.ok) return Response.json({ error: out.message, code: out.code, currentRevision: out.currentRevision }, { status: STATUS[out.code] ?? 422, headers: { 'Cache-Control': 'no-store' } });
    return success({ ...out, state: await snapshot(id, { view: 'student', seatId }) });
  } catch (e) { return failure(e); }
}
