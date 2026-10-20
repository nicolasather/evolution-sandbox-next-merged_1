import { assertSameOrigin, clientIp, failure, jsonBody, rateLimit, success } from '@/lib/quiz/api';
import { privacyBucket } from '@/lib/quiz/safety';
import { joinTD, seatCookie } from '@/lib/quiz/td/server';
import { tdJoinSchema } from '@/lib/quiz/td/validation';
import { cookieOptions } from '@/lib/quiz/td/http';

/** Anonymous, room-scoped join: no email, no account. The seat secret goes into an HttpOnly cookie scoped to this room's API; only its hash is stored. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    await rateLimit(req, 'td-join', 120, 600);
    const input = tdJoinSchema.parse(await jsonBody(req));
    const bucket = privacyBucket([clientIp(req)], new Date().toISOString().slice(0, 10), process.env.QUIZ_PRIVACY_SALT ?? 'quiz-studio');
    const out = await joinTD(input, bucket);
    const res = success({ roomId: out.roomId, seatId: out.seatId, teamId: out.teamId, status: out.status }, 201);
    res.cookies.set(seatCookie(out.roomId), out.token, cookieOptions(out.roomId));
    return res;
  } catch (e) { return failure(e); }
}
