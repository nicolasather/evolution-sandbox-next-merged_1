import { z } from 'zod';
import { maybeUser, serviceDB } from '@/lib/quiz/supabase';
import { getRoom, verifyPlayer } from '@/lib/quiz/rooms';
import { loadCosmetics } from '@/lib/quiz/cosmetics/server';
import { ICONS, ALL_FRAMES } from '@/lib/quiz/cosmetics/catalog';
import { AppError } from '@/lib/quiz/errors';
import { assertSameOrigin, failure, jsonBody, rateLimit, success } from '@/lib/quiz/api';

const schema = z.object({ roomId: z.string().uuid(), token: z.string().min(8).max(160) });
const NAMES = new Map<string, string>([...ICONS.map((i) => [i.id, i.name] as [string, string]), ...ALL_FRAMES.map((f) => [f.id, f.name] as [string, string])]);

/** After a finished game the SERVER turns the player's verified activity into one progress event. Calling this again changes nothing (the event id is fixed). */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const b = schema.parse(await jsonBody(req));
    await rateLimit(req, 'cosmetics-claim', 30, 600, b.token.slice(0, 16));
    const room = await getRoom(b.roomId);
    if (room.status !== 'ended') throw new AppError('The game has not finished yet', 400);
    const player = await verifyPlayer(room, b.token);
    const user = await maybeUser();
    if (!user) return success({ earned: [], needsAccount: true });
    if (room.config.cosmeticsEnabled === false || room.config.quietClassroom) return success({ earned: [], disabled: true });
    const db = serviceDB();
    const { data: subs } = await db.from('submissions').select('room_question_id,correct,submitted_at,response').eq('actor_id', player.id);
    const rows = subs ?? [];
    const answered = rows.filter((r) => (r.response as { kind?: string })?.kind !== 'timeout').length;
    if (!answered) return success({ earned: [] });
    const times = rows.map((r) => Date.parse(r.submitted_at as string)).sort((a, c) => a - c);
    const before = await loadCosmetics(user.id);
    const accuracy = rows.filter((r) => r.correct).length / rows.length;
    const at = new Date().toISOString();
    const fact = { sessionId: room.id, quizId: room.quiz_id, verified: true, answered, distinctQuestions: new Set(rows.map((r) => r.room_question_id)).size, durationSeconds: Math.max(0, Math.round(((times.at(-1) ?? 0) - (times[0] ?? 0)) / 1000)), at };
    await db.from('cosmetic_events').upsert({ id: `session:${room.id}:${player.id}`, owner_id: user.id, kind: 'session', payload: { fact, accuracy } }, { onConflict: 'id', ignoreDuplicates: true });
    const after = await loadCosmetics(user.id);
    const earned = Object.keys(after.ledger.unlocked).filter((id) => !before.ledger.unlocked[id]).map((id) => ({ id, name: NAMES.get(id) ?? id }));
    return success({ earned });
  } catch (e) { return failure(e); }
}
