import 'server-only';
import { serviceDB } from './supabase';
import { AppError } from './errors';
import type { Room } from './types';
import type { SessionData } from './reports';

/** Builds the report input for a finished or running room straight from the archived snapshot (room_questions, submissions, score_events). */
export async function loadSessionData(room: Room, title = 'Quiz session'): Promise<SessionData> {
  const db = serviceDB();
  const [qs, subs, ev, teams, players] = await Promise.all([
    db.from('room_questions').select('id,position,kind,prompt,payload,base_points').eq('room_id', room.id).order('position'),
    db.from('submissions').select('room_question_id,actor_id,correct,response,base_awarded,wager,submitted_at').eq('room_id', room.id),
    db.from('score_events').select('actor_id,delta,reason,created_at,undone_at').eq('room_id', room.id),
    db.from('teams').select('id,display_name,points').eq('room_id', room.id),
    db.from('players').select('id,display_name,points').eq('room_id', room.id),
  ]);
  if (qs.error || subs.error || ev.error) throw new AppError('Could not load the report', 500);
  const classroom = room.mode === 'classroom';
  const actors = ((classroom ? teams.data : players.data) ?? []).map((a) => ({ id: a.id as string, name: a.display_name as string, points: Number(a.points) }));
  return {
    title, mode: room.mode, startedAt: room.started_at ?? new Date().toISOString(), teacherScored: classroom,
    actors,
    questions: (qs.data ?? []).map((q) => {
      const meta = ((q.payload as { meta?: Record<string, string> })?.meta ?? {});
      const optionText: Record<string, string> = {};
      for (const o of ((q.payload as { options?: { id: string; text: string }[] })?.options ?? [])) optionText[o.id] = o.text;
      return { id: q.id as string, position: q.position as number, kind: q.kind as string, prompt: q.prompt as string, basePoints: q.base_points as number, topic: meta.topic, difficulty: meta.difficulty, objective: meta.objective, optionText };
    }),
    submissions: (subs.data ?? []).map((s) => ({ questionId: s.room_question_id as string, actorId: s.actor_id as string, correct: s.correct as boolean, response: s.response, awarded: s.base_awarded as number, wager: s.wager as number, at: s.submitted_at as string })),
    events: (ev.data ?? []).map((e) => ({ actorId: e.actor_id as string, delta: Number(e.delta), reason: e.reason as string, at: e.created_at as string, undone: !!e.undone_at })),
  };
}
