import { assertSameOrigin, failure, jsonBody, rateLimit } from '@/lib/quiz/api';
import { submitInput } from '@/lib/quiz/os/server';
import { osInputSchema } from '@/lib/quiz/os/validation';
import { roomIdOf, seatFrom } from '@/lib/quiz/os/http';

/** One batch of a student's inputs for consecutive ticks. The seat comes from the cookie; the payload can only contain axes, hop and ability flags — never a position. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const id = await roomIdOf(params);
    const { seatId } = await seatFrom(id);
    await rateLimit(req, 'os-input', 600, 60, seatId);
    const body = osInputSchema.parse(await jsonBody(req));
    const out = await submitInput(id, seatId, body);
    if (!out.ok) return Response.json({ error: out.message, code: out.code, tick: out.tick }, { status: out.status, headers: { 'Cache-Control': 'no-store' } });
    return Response.json(out, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return failure(e); }
}
