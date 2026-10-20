import 'server-only';
import { randomBytes } from 'node:crypto';
import { createRoom } from '../rooms';
import { serviceDB } from '../supabase';
import { AppError } from '../errors';
import { projectorCreateSchema } from '../validation';
import { assertProjectorModifiers } from './compat';
import { checkTeamNames } from './team-names';
import { createSession, GRACE_SECONDS, preflight } from './server';
import type { ProjectorConfig } from './types';

/** Create a classroom room AND its projector session in one request. The room is removed again if the session cannot be built. */
export async function createProjectorRoom(input: unknown, user: { id: string }) {
  const v = projectorCreateSchema.parse(input);
  let mods;
  try { mods = assertProjectorModifiers(v.game, v.modifiers, { flow: v.flow, lowPressure: v.lowPressure }); }
  catch (e) { throw new AppError((e as Error).message.replace(/^Unknown: /, ''), 400); }
  const names = checkTeamNames(v.teamNames);
  if (!names.ok) throw new AppError(names.errors.find(Boolean)!, 400);
  v.teamNames = names.names;
  const cfg: ProjectorConfig = { v: 1, game: v.game, focus: v.focus, minutes: v.minutes, seed: v.seed ?? randomBytes(6).toString('hex'), settings: v.settings, allowRepeats: v.allowRepeats, mods };
  const pre = await preflight(v.quizId, cfg, v.teamNames.length);
  if (!pre.check.ok && !(v.allowRepeats && pre.check.shortage <= pre.check.maxRepeatable)) throw new AppError(`projector:tooFewQuestions:${pre.check.shortage}`, 400);
  const out = await createRoom({
    quizId: v.quizId, mode: 'classroom', flow: v.flow, durationSeconds: (v.minutes ?? 180) * 60 + GRACE_SECONDS, questionSeconds: null,
    modifiers: mods, slotLimit: 3, teamNames: v.teamNames, lowPressure: v.lowPressure || undefined, readAloud: v.readAloud, untimed: true,
    projector: { game: v.game, minutes: v.minutes, focus: v.focus },
  }, user, { allowProjector: true });
  try {
    const { plan } = await createSession(out.roomId, user.id, cfg, { synchronized: v.flow === 'synchronized', lowPressure: v.lowPressure });
    return { ...out, plan: { turnBudget: plan.turnBudget, minutes: plan.minutes, notes: plan.notes }, check: pre.check };
  } catch (e) {
    await serviceDB().from('rooms').delete().eq('id', out.roomId);
    throw e;
  }
}
