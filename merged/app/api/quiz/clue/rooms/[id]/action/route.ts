import { assertSameOrigin, failure, rateLimit, success } from '@/lib/quiz/api';
import { seatCommand, snapshot } from '@/lib/quiz/cr/server';
import { crActionSchema, MAX_PACKET_BYTES } from '@/lib/quiz/cr/validation';
import { boundedJson, roomIdOf, seatFrom } from '@/lib/quiz/cr/http';

const STATUS: Record<string, number> = { STALE_REVISION: 409, INSUFFICIENT_POINTS: 409, ALREADY_BOUGHT: 409, ALREADY_OWNED: 409, PERK_LIMIT: 409, WRONG_PHASE: 409, COOLDOWN: 409, TEAM_BURST: 409, ROLE_TAKEN: 409, SEAT_REVOKED: 403 };
/** One student command (role, ready, name, road vote, perk purchase, ability, flag pass, stamp). Safe to retry with the same commandId. The seat comes from the cookie; the payload can never name another team. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const id = await roomIdOf(params);
    const { seatId } = await seatFrom(id);
    await rateLimit(req, 'cr-action', 240, 60, seatId);
    const body = crActionSchema.parse(await boundedJson(req, MAX_PACKET_BYTES));
    const out = await seatCommand(id, seatId, body.commandId, body.action as never, body.expectedRevision);
    if (!out.ok) return Response.json({ error: out.message, code: out.code, currentRevision: out.currentRevision }, { status: STATUS[out.code] ?? 422, headers: { 'Cache-Control': 'no-store' } });
    return success({ ...out, state: await snapshot(id, { view: 'student', seatId }) });
  } catch (e) { return failure(e); }
}
