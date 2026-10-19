import { joinSchema } from '@/lib/quiz/validation';
import { hashSecret, randomSecret } from '@/lib/quiz/rooms';
import { checkNickname, privacyBucket } from '@/lib/quiz/safety';
import { maybeUser, serviceDB } from '@/lib/quiz/supabase';
import { loadCosmetics } from '@/lib/quiz/cosmetics/server';
import { owns, emptyLedger } from '@/lib/quiz/cosmetics/ledger';
import { iconById } from '@/lib/quiz/cosmetics/catalog';
import { AppError } from '@/lib/quiz/errors';
import { fromDbError, clientIp } from '@/lib/quiz/api';
import { assertSameOrigin, failure, jsonBody, rateLimit, rpc, success } from '@/lib/quiz/api';

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    await rateLimit(req, 'room-join', 200, 600);
    const input = joinSchema.parse(await jsonBody(req));
    const token = randomSecret(); // only its SHA-256 hash is stored
    const nick = checkNickname(input.displayName);
    if (!nick.ok) throw new AppError(nick.message ?? 'Please choose a different name.', 400);
    const bucket = privacyBucket([clientIp(req)], new Date().toISOString().slice(0, 10), process.env.QUIZ_PRIVACY_SALT ?? 'quiz-studio');
    type Out = { roomId: string; playerId: string; status?: string };
    let out: Out;
    const v2 = await serviceDB().rpc('join_room_v2', { p_code: input.joinCode.toUpperCase(), p_name: nick.name, p_hash: hashSecret(token), p_bucket: bucket });
    if (!v2.error) out = v2.data as Out;
    else if (v2.error.code === 'PGRST202' || /could not find the function|does not exist/i.test(v2.error.message ?? '')) out = await rpc<Out>('join_room', { p_code: input.joinCode.toUpperCase(), p_name: nick.name, p_hash: hashSecret(token) });
    else throw fromDbError(v2.error);
    // optional cosmetic: only an item this person actually owns (free starters are owned by everyone)
    if (input.icon && iconById(input.icon)) {
      try {
        const user = await maybeUser();
        const ledger = user ? (await loadCosmetics(user.id)).ledger : emptyLedger();
        if (owns(ledger, input.icon)) await serviceDB().from('players').update({ identity: { icon: input.icon } }).eq('id', out.playerId);
      } catch { /* cosmetics are optional; never block joining */ }
    }
    return success({ roomId: out.roomId, playerId: out.playerId, status: out.status ?? 'active', token }, 201);
  } catch (e) { return failure(e); }
}
