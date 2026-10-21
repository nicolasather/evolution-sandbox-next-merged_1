import { assertSameOrigin, failure, rateLimit } from '@/lib/quiz/api';
import { submitInput } from '@/lib/quiz/arena/server';
import { arenaMoveSchema, MAX_PACKET_BYTES } from '@/lib/quiz/arena/validation';
import { boundedJson, roomIdOf, seatFrom } from '@/lib/quiz/arena/http';

/** One steering intent {seq, x, y}. The seat comes from the cookie; the payload can only be a direction with a sequence number — never a position, a tick or a cooldown. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const id = await roomIdOf(params);
    const { seatId } = await seatFrom(id);
    await rateLimit(req, 'arena-input', 600, 60, seatId);
    const body = arenaMoveSchema.parse(await boundedJson(req, MAX_PACKET_BYTES));
    const out = await submitInput(id, seatId, body);
    if (!out.ok) return Response.json({ error: out.message, code: out.code }, { status: out.status, headers: { 'Cache-Control': 'no-store' } });
    return Response.json(out, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return failure(e); }
}
