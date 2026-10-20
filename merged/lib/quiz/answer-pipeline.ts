import 'server-only';
import { serviceDB, currentUser } from './supabase';
import { getRoom, verifyPlayer, roomQuestion, questionToGrader } from './rooms';
import { assertResponseIds, gradeDetailed } from './grading';
import { computeAward } from './scoring';
import { submissionSchema } from './validation';
import { AppError } from './errors';
import { rpc, fromDbError } from './api';
import type { Room } from './types';

/**
 * The five server-side verification stages every answer passes through. The client supplies only an
 * answer (and, for the classroom host, an optional audited override); correctness and points are always
 * computed here and written by the database function under a row lock.
 *
 *  1 identify & authorise     2 eligibility (round, turn, timer)     3 response validation
 *  4 grade against hidden key (or audited teacher decision)           5 atomic commit + audit
 */
export const STAGES = ['identify', 'eligibility', 'validate', 'grade', 'commit'] as const;

const fail = (stage: number, message: string, status = 400) => new AppError(message, status, stage);

export async function submitAnswer(input: unknown, opts: { allowTD?: boolean } = {}) {
  const v = submissionSchema.parse(input);
  const db = serviceDB();

  // ── STAGE 1 · Identify & authorise ────────────────────────────────────────────────────────────
  let room: Room;
  try { room = await getRoom(v.roomId); } catch (e) { throw e instanceof AppError ? fail(1, e.message, e.status) : e; }
  // Tower Defense answers must pass the game's own gate (open question, deadline, per-round cap) in lib/quiz/td/server.ts first
  if ((room.config as { td?: unknown }).td && !opts.allowTD) throw fail(1, 'Answer from the Tower Defense screen.', 403);
  let actorType: 'team' | 'player';
  let actorId: string;
  let playerCursor: number | null = null;
  let playerOpened: string | null = null;
  if (room.mode === 'classroom') {
    let user;
    try { user = await currentUser(); } catch { throw fail(1, 'Sign in required', 401); }
    if (!room.host_id || room.host_id !== user.id) throw fail(1, 'Only the room host can perform this action', 403);
    if (!v.actorId) throw fail(1, 'The host must choose which team is answering');
    const { data: team } = await db.from('teams').select('id').eq('id', v.actorId).eq('room_id', room.id).maybeSingle();
    if (!team) throw fail(1, 'Team not found in this room', 404);
    actorType = 'team'; actorId = v.actorId;
  } else {
    let player;
    try { player = await verifyPlayer(room, v.token ?? ''); } catch (e) { throw e instanceof AppError ? fail(1, e.message, e.status) : e; }
    if (v.actorId && v.actorId !== player.id) throw fail(1, 'Actor mismatch', 403);
    if (v.override !== undefined) throw fail(1, 'Only the classroom host can override a grade', 403);
    actorType = 'player'; actorId = player.id; playerCursor = player.cursor_index; playerOpened = player.question_opened_at;
  }

  // ── STAGE 2 · Eligibility: round, turn, timer, duplicates (re-checked under lock in stage 5) ───
  const nowMs = Date.now();
  if (room.status !== 'active') throw fail(2, 'This game is not active');
  if (room.paused_at) throw fail(2, 'The game is paused');
  if (room.expires_at && nowMs > new Date(room.expires_at).getTime()) throw fail(2, 'The match time has expired');
  if (room.revealed && room.flow !== 'independent') throw fail(2, 'The answer has already been revealed for this question');
  const q = await roomQuestion(room, room.flow === 'independent' && room.mode !== 'classroom' ? (playerCursor ?? 0) : room.current_index);
  if (!q || q.id !== v.roomQuestionId) throw fail(2, 'That is not the active question');
  if (room.mode === 'classroom' && room.flow === 'round_robin') {
    const { data: team } = await db.from('teams').select('order_index').eq('id', actorId).maybeSingle();
    const stolen = room.steal_active && room.steal_target_id === actorId;
    if (!stolen && team?.order_index !== room.turn_index) throw fail(2, 'It is not that team’s turn');
  }
  const opened = room.mode !== 'classroom' && room.flow === 'independent' ? playerOpened : room.round_opened_at;
  const limit = room.config.questionSeconds;
  if (limit && limit > 0 && (!opened || nowMs > new Date(opened).getTime() + limit * 1000)) throw fail(2, 'The question timer has expired');
  const dup = await db.from('submissions').select('id', { count: 'exact', head: true }).eq('room_question_id', q.id).eq('actor_type', actorType).eq('actor_id', actorId);
  if ((dup.count ?? 0) > 0) throw fail(2, 'This question has already been answered', 409);
  if (v.wager > 0 && !room.config.modifiers.includes('secret_wager')) throw fail(2, 'Wagers are not enabled in this game');

  // ── STAGE 3 · Validate the response structure and ids ─────────────────────────────────────────
  const graded = questionToGrader(q);
  const oral = room.mode === 'classroom' && v.response === undefined;
  if (oral && v.override === undefined) throw fail(3, 'Provide an answer, or mark the spoken answer correct or incorrect');
  if (!oral && v.response === undefined) throw fail(3, 'Missing answer');
  let response: unknown;
  if (oral) response = { kind: 'manual_observation', method: 'teacher_oral_verification' };
  else {
    try { response = assertResponseIds(graded, v.response); }
    catch (e) { throw fail(3, e instanceof Error && !/^\s*\[/.test(e.message) ? e.message : 'Invalid answer format'); }
  }

  // ── STAGE 4 · Grade on the server (hidden key) or accept the host’s audited decision ─────────
  const manual = room.mode === 'classroom' && v.override !== undefined;
  const grade = manual ? { correct: v.override as boolean, fraction: v.override ? 1 : 0 } : gradeDetailed(graded, response);
  const correct = grade.correct;
  const cfg = room.config as { questionSeconds?: number | null; hideSpeedBonus?: boolean };
  // elapsed time is measured on the SERVER clock, never taken from the client
  const elapsedMs = opened ? Math.max(0, nowMs - new Date(opened).getTime()) : undefined;
  const award = manual ? { base: correct ? q.base_points : 0, bonus: 0 }
    : computeAward({ basePoints: q.base_points, payload: q.payload as never }, grade, { questionSeconds: cfg.questionSeconds, hideSpeedBonus: cfg.hideSpeedBonus, elapsedMs });
  const baseAward = award.base;
  const bonus = Math.min(award.bonus, q.base_points);
  const partial = !correct && baseAward > 0;

  // ── STAGE 5 · Atomic commit + audit (row-locked SQL function, unique submission, bounded delta) ─
  type Result = { correct: boolean; awarded: number; newPoints: number; finished: boolean };
  const plain = baseAward === (correct ? q.base_points : 0) && bonus === 0; // nothing v1 cannot express
  const { data, error } = await serviceDB().rpc('commit_answer_v2', {
    p_room: room.id, p_question: q.id, p_actor_type: actorType, p_actor: actorId, p_response: response,
    p_correct: correct, p_base_award: baseAward, p_bonus: bonus, p_partial: partial,
    p_wager: v.wager, p_manual: manual,
  });
  if (!error) return data as Result;
  // Migration 004 not applied yet: fall back to the original function for plain right/wrong answers so the app keeps working.
  const missing = error.code === 'PGRST202' || /could not find the function|does not exist/i.test(error.message ?? '');
  if (missing && plain) {
    try {
      return await rpc<Result>('commit_answer', {
        p_room: room.id, p_question: q.id, p_actor_type: actorType, p_actor: actorId,
        p_response: response, p_correct: correct, p_base_award: baseAward, p_wager: v.wager, p_manual: manual,
      });
    } catch (e) { throw e instanceof AppError ? fail(5, e.message, e.status) : e; }
  }
  if (missing) {
    // partial credit / bonus cannot be stored yet: award the nearest value v1 allows (nothing for a partial answer) rather than fail
    try {
      return await rpc<Result>('commit_answer', {
        p_room: room.id, p_question: q.id, p_actor_type: actorType, p_actor: actorId,
        p_response: response, p_correct: correct, p_base_award: correct ? q.base_points : 0, p_wager: v.wager, p_manual: manual,
      });
    } catch (e) { throw e instanceof AppError ? fail(5, e.message, e.status) : e; }
  }
  const mapped = fromDbError(error);
  throw fail(5, mapped.message, mapped.status);
}
