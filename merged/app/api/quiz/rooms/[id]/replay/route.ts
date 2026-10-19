import { isHost, createRoom } from '@/lib/quiz/rooms';
import { assertSameOrigin, failure, rateLimit, success } from '@/lib/quiz/api';

/** Fast replay: a brand-new room for the same quiz, teams and settings with a fresh random question order.
 *  The finished room and its results are not touched, so the archive stays exactly as it was. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const { id } = await params;
    const { room, user } = await isHost(id);
    await rateLimit(req, 'room-create', 30, 600, user.id);
    const c = room.config;
    const out = await createRoom({
      quizId: room.quiz_id, mode: room.mode, flow: room.flow, durationSeconds: c.durationSeconds, questionSeconds: c.questionSeconds ?? null,
      modifiers: c.modifiers, slotLimit: c.slotLimit, teamNames: c.teamNames ?? [], lowPressure: c.lowPressure, quietClassroom: c.quietClassroom,
      untimed: c.untimed, readAloud: c.readAloud, fairPlay: c.fairPlay, rotateSpeaker: c.rotateSpeaker, access: c.access, shuffleQuestions: true,
      showIdentity: c.showIdentity, cosmeticsEnabled: c.cosmeticsEnabled,
    }, user);
    return success({ ...out, replayOf: id }, 201);
  } catch (e) { return failure(e); }
}
