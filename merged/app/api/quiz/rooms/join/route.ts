import { joinSchema } from '@/lib/quiz/validation';
import { hashSecret, randomSecret } from '@/lib/quiz/rooms';
import { assertSameOrigin, failure, jsonBody, rateLimit, rpc, success } from '@/lib/quiz/api';

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    await rateLimit(req, 'room-join', 200, 600);
    const input = joinSchema.parse(await jsonBody(req));
    const token = randomSecret(); // only its SHA-256 hash is stored
    const out = await rpc<{ roomId: string; playerId: string }>('join_room', { p_code: input.joinCode.toUpperCase(), p_name: input.displayName, p_hash: hashSecret(token) });
    return success({ roomId: out.roomId, playerId: out.playerId, token }, 201);
  } catch (e) { return failure(e); }
}
