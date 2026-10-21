import { assertSameOrigin, clientIp, failure, rateLimit, success } from '@/lib/quiz/api';
import { privacyBucket } from '@/lib/quiz/safety';
import { joinArena, seatCookie } from '@/lib/quiz/arena/server';
import { arenaJoinSchema, MAX_PACKET_BYTES } from '@/lib/quiz/arena/validation';
import { boundedJson, cookieOptions } from '@/lib/quiz/arena/http';

/** Anonymous, room-scoped join: no email, no account. The seat secret goes into an HttpOnly cookie scoped to this room's API; only its hash is stored. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    await rateLimit(req, 'arena-join', 120, 600);
    const input = arenaJoinSchema.parse(await boundedJson(req, MAX_PACKET_BYTES));
    const bucket = privacyBucket([clientIp(req)], new Date().toISOString().slice(0, 10), process.env.QUIZ_PRIVACY_SALT ?? 'quiz-studio');
    const out = await joinArena(input, bucket);
    const res = success({ roomId: out.roomId, seatId: out.seatId, teamId: out.teamId, status: out.status }, 201);
    res.cookies.set(seatCookie(out.roomId), out.token, cookieOptions(out.roomId));
    return res;
  } catch (e) { return failure(e); }
}
