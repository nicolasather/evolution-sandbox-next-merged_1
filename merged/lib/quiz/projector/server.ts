import 'server-only';
/** Server orchestration of a projector match: loads the authoritative session, fulfils the reducer's Needs with real
 *  database calls (open question, five-stage answer pipeline, reveal), then commits the new state under a revision lock.
 *  The browser sends a teacher command; it never sends state, correctness or a VerifiedAnswer. */
import { serviceDB } from '../supabase';
import { AppError } from '../errors';
import { rpc } from '../api';
import { getRoom, roomPublicState } from '../rooms';
import { submitAnswer } from '../answer-pipeline';
import type { Room } from '../types';
import { run, type Providers } from './orchestrate';
import { createState, RULES_VERSION } from './session';
import { checkPool, planFor, poolKinds } from './scale';
import { poolFromRows, type RoomQuestionRow } from './planner';
import { publicView, type ClockView, type ProjectorSnapshot, type View } from './public-view';
import type { AskInfo, GameCommand, GameState, PoolQuestion, ProjectorConfig, Rebound, TeamRef, VerifiedAnswer } from './types';
import { reduce } from './engine';

export const GRACE_SECONDS = 1800;
type SessionRow = { room_id: string; game: string; config: ProjectorConfig; state: GameState; revision: number; status: 'active' | 'finished'; rules_version: number };

export async function loadSession(roomId: string): Promise<SessionRow | null> {
  const { data, error } = await serviceDB().from('projector_sessions').select('*').eq('room_id', roomId).maybeSingle();
  if (error) throw new AppError('Unexpected server error', 500);
  return (data as SessionRow | null) ?? null;
}
export async function loadPool(roomId: string): Promise<PoolQuestion[]> {
  const { data, error } = await serviceDB().from('room_questions').select('id,position,kind,payload,answer_key').eq('room_id', roomId).order('position');
  if (error) throw new AppError('Unexpected server error', 500);
  return poolFromRows((data ?? []) as RoomQuestionRow[]);
}
async function loadTeams(roomId: string): Promise<TeamRef[]> {
  const { data, error } = await serviceDB().from('teams').select('id,display_name,order_index').eq('room_id', roomId).order('order_index');
  if (error) throw new AppError('Unexpected server error', 500);
  return (data ?? []).map((t) => ({ id: t.id as string, name: t.display_name as string, order: t.order_index as number }));
}

/** Pre-flight on the quiz BEFORE a room exists: can it fill the lesson? */
export async function preflight(quizId: string, cfg: ProjectorConfig, teamCount: number) {
  const { data, error } = await serviceDB().from('quiz_questions').select('id,position,kind,payload,answer_key').eq('quiz_id', quizId).order('position');
  if (error) throw new AppError('Unexpected server error', 500);
  const pool = poolFromRows((data ?? []) as RoomQuestionRow[]);
  const kinds = poolKinds(pool);
  const plan = planFor(cfg.game, cfg.minutes, teamCount, cfg.focus, kinds);
  const check = checkPool(plan, pool, cfg.focus);
  // what the suggested shorter lesson would hold, planned with the SAME real question kinds (never an all-Multiple-Choice guess)
  const fitTurns = cfg.minutes !== null && !check.ok && check.fitMinutes ? planFor(cfg.game, check.fitMinutes, teamCount, cfg.focus, kinds).turnBudget : null;
  return { plan, check, pool, fitTurns };
}

/** After create_room_with_content: build the initial state from the room's own questions and store it. */
export async function createSession(roomId: string, hostId: string, cfg: ProjectorConfig, opts: { synchronized: boolean; lowPressure: boolean }) {
  let pool = await loadPool(roomId);
  const teams = await loadTeams(roomId);
  const plan0 = planFor(cfg.game, cfg.minutes, teams.length, cfg.focus, poolKinds(pool));
  const check = checkPool(plan0, pool, cfg.focus);
  if (!check.ok) {
    if (!cfg.allowRepeats) throw new AppError(`projector:tooFewQuestions:${check.shortage}`, 400);
    // a labelled repeat cycle, only because the teacher agreed; never invented questions
    await rpc('projector_add_repeat_cycle', { p_room: roomId, p_host: hostId, p_consent: true, p_count: Math.min(check.shortage, check.maxRepeatable) });
    pool = await loadPool(roomId);
  }
  const { state } = createState(cfg, teams, pool, opts);
  await rpc('projector_create_session', { p_room: roomId, p_host: hostId, p_game: cfg.game, p_config: { ...cfg, rules: RULES_VERSION }, p_state: state });
  return { plan: plan0 };
}

export function clockOf(room: Room): ClockView {
  const untimed = !!(room.config as { projector?: ProjectorConfig }).projector && (room.config as { projector?: ProjectorConfig }).projector!.minutes === null;
  const cap = room.expires_at ? new Date(room.expires_at).getTime() : null;
  const deadline = cap !== null && !untimed ? new Date(cap - GRACE_SECONDS * 1000).toISOString() : null;
  const now = Date.now();
  return { serverNow: new Date(now).toISOString(), deadlineAt: deadline, paused: !!room.paused_at, pausedAt: room.paused_at, startedAt: room.started_at, status: room.status, untimed, overtime: !!deadline && !room.paused_at && now > new Date(deadline).getTime() };
}

export type { ProjectorSnapshot };
/** The session config without its private seed. */
export function publicConfig(cfg: ProjectorConfig): ProjectorConfig { return { ...cfg, seed: '' }; }

/** Public-safe projection. For the host view, also attaches the current question WITH its answer key (peek) so the teacher can mark oral answers. */
export async function snapshot(roomId: string, view: View): Promise<ProjectorSnapshot> {
  let room = await getRoom(roomId);
  let s = await loadSession(roomId);
  if (!s) throw new AppError('Projector game not found', 404);
  // the game deadline passed: ask the reducer to finish (at the end of the current turn if one is open)
  if (room.status === 'active' && clockOf(room).overtime && s.status === 'active' && s.state.core.phase !== 'finished' && !s.state.core.finishAfterTurn) {
    try { await act({ roomId, hostId: room.host_id!, commandId: `timeup-${s.revision}-${Math.floor(Date.now() / 1000)}`.slice(0, 60).padEnd(8, '0'), expectedRevision: s.revision, action: 'time_up', payload: {} }); } catch { /* another poller won the race; the state we load next is current */ }
    s = (await loadSession(roomId))!; room = await getRoom(roomId);
  }
  const { data: teams } = await serviceDB().from('teams').select('id,display_name,points').eq('room_id', roomId).order('order_index');
  const out: ProjectorSnapshot = {
    // the stored config carries the private seed (it derives every hidden value): it never leaves the server, not even to the host
    revision: s.revision, status: s.status, game: publicView(s.state, view), clock: clockOf(room), config: publicConfig(s.config), question: null,
    room: { id: room.id, code: room.join_code, status: room.status, paused: !!room.paused_at, teams: (teams ?? []).map((t) => ({ id: t.id as string, name: t.display_name as string, points: Number(t.points) })) },
  };
  // the question being asked: the projector gets it WITHOUT the answer key; the host's copy carries the key (peek) for marking oral answers
  out.question = null;
  if (s.state.core.phase === 'asking' || (s.state.core.rebound && !s.state.core.rebound.used)) {
    const pub = await roomPublicState(room, { role: 'host' }, { peek: view === 'host' });
    out.question = (pub as { question: unknown }).question;
  }
  return out;
}

type SubRow = { id: string; correct: boolean; base_awarded: number; manual_override: boolean; room_question_id: string; actor_id: string };
/** A VerifiedAnswer is only ever built from a committed submissions row. */
function verified(row: SubRow, teamId: string, position: number, pool: PoolQuestion[], fallback: { kind: AskInfo['kind']; topic: string | null; difficulty: AskInfo['difficulty'] }): VerifiedAnswer {
  const entry = pool.find((x) => x.position === position);
  return { submissionId: row.id, teamId, roomQuestionId: row.room_question_id, position, grade: row.correct ? 'correct' : 'wrong', fraction: row.correct ? 1 : 0, kind: entry?.kind ?? fallback.kind, topic: entry?.topic ?? fallback.topic, difficulty: entry?.difficulty ?? fallback.difficulty, teacherOverride: !!row.manual_override };
}
async function committedRow(roomQuestionId: string, teamId: string): Promise<SubRow | null> {
  const { data } = await serviceDB().from('submissions').select('id,correct,base_awarded,manual_override,room_question_id,actor_id').eq('room_question_id', roomQuestionId).eq('actor_type', 'team').eq('actor_id', teamId).maybeSingle();
  return (data as SubRow | null) ?? null;
}

/** PATCH C — reconciliation. Grading writes a submission (an irreversible side effect) BEFORE the revision-locked commit of the game state. If that
 *  commit then lost a race (another tab, a retry, the time-up poller), the answer exists but the game never consumed it. Before ANY new command
 *  runs, every committed-but-unconsumed answer to the open question is applied first, from the committed row, inside the same commit. So an answer
 *  can never be lost, and — because `consumed` is checked — never be counted twice. */
export async function reconcile(state: GameState, pool: PoolQuestion[]): Promise<{ state: GameState; applied: string[] }> {
  const c = state.core; const applied: string[] = [];
  if (c.phase !== 'asking' || !c.ask) return { state, applied };
  let cur = state;
  for (const teamId of c.ask.teamIds) {
    if (cur.core.phase !== 'asking' || !cur.core.ask || cur.core.ask.answered.includes(teamId)) continue;
    const row = await committedRow(c.ask.roomQuestionId, teamId);
    if (!row || cur.core.consumed.includes(row.id)) continue;
    const r = reduce(cur, { action: 'grade', payload: { teamId } }, { pool, answer: verified(row, teamId, c.ask.position, pool, c.ask) });
    if (r.ok && !r.need) { cur = r.state; applied.push(row.id); }
  }
  return { state: cur, applied };
}

function providers(roomId: string, hostId: string, state: GameState, pool: PoolQuestion[], verdict: 'correct' | 'wrong' | undefined): Providers {
  return {
    async rebound(teamId: string, r: Rebound, ask: AskInfo | null): Promise<VerifiedAnswer> {
      let row = await committedRow(r.roomQuestionId, teamId);
      if (!row) {
        if (!verdict) throw new AppError('projector:needVerdict', 400);
        // set_steal re-checks under the room lock: classroom round robin, steal_question enabled, a wrong answer exists, the target has not answered
        await rpc('set_steal', { p_room: roomId, p_host: hostId, p_target: teamId });
        await submitAnswer({ roomId, roomQuestionId: r.roomQuestionId, actorId: teamId, override: verdict === 'correct' });
        row = await committedRow(r.roomQuestionId, teamId);
      }
      if (!row) throw new AppError('Could not read the committed answer', 500);
      return verified(row, teamId, r.position, pool, { kind: ask?.kind ?? 'multiple_choice', topic: ask?.topic ?? null, difficulty: ask?.difficulty ?? null });
    },
    async open(p) {
      const out = await rpc<{ roomQuestionId: string }>('projector_open_question', { p_room: roomId, p_host: hostId, p_position: p.position, p_team_ids: p.teamIds });
      return out;
    },
    async grade(teamId: string, ask: AskInfo): Promise<VerifiedAnswer> {
      let row = await committedRow(ask.roomQuestionId, teamId);
      if (!row) {
        if (!verdict) throw new AppError('projector:needVerdict', 400);
        await submitAnswer({ roomId, roomQuestionId: ask.roomQuestionId, actorId: teamId, override: verdict === 'correct' });
        row = await committedRow(ask.roomQuestionId, teamId);
      }
      if (!row) throw new AppError('Could not read the committed answer', 500);
      return verified(row, teamId, ask.position, pool, ask);
    },
    async reveal() { await rpc('control_room_v2', { p_room: roomId, p_host: hostId, p_action: 'reveal' }).catch(() => undefined); },
  };
  void state;
}

export type ActInput = { roomId: string; hostId: string; commandId: string; expectedRevision: number; action: string; payload: Record<string, unknown> };
/** Host-level actions that live outside the reducer. */
const ROOM_ACTIONS = new Set(['start', 'pause', 'resume']);

export async function act(i: ActInput): Promise<ProjectorSnapshot & { replayed: boolean }> {
  const db = serviceDB();
  // idempotency first: a command id we already committed is answered from the log, with no side effects
  const prev = await db.from('projector_events').select('revision').eq('room_id', i.roomId).eq('command_id', i.commandId).maybeSingle();
  if (prev.data) return { ...(await snapshot(i.roomId, 'host')), replayed: true };
  const session = await loadSession(i.roomId);
  if (!session) throw new AppError('Projector game not found', 404);
  const room = await getRoom(i.roomId);
  if (!room.host_id || room.host_id !== i.hostId) throw new AppError('Only the room host can perform this action', 403);
  if (session.revision !== i.expectedRevision) throw new AppError(`projector:revisionConflict:${session.revision}`, 409);
  let state = session.state; let summary: Record<string, unknown> = {};

  if (ROOM_ACTIONS.has(i.action)) {
    await rpc('control_room_v2', { p_room: i.roomId, p_host: i.hostId, p_action: i.action });
    summary = { room: i.action };
  } else if (i.action === 'extend') {
    const minutes = Number(i.payload.minutes); const reason = String(i.payload.reason ?? '').slice(0, 200);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 60) throw new AppError('projector:badExtend', 400);
    const r = reduce(state, { action: 'extend', payload: { minutes, reason } }, { pool: [] });
    if (!r.ok) throw new AppError(`projector:${r.code}`, 422);
    await rpc('projector_extend_time', { p_room: i.roomId, p_host: i.hostId, p_minutes: minutes, p_reason: reason });
    state = r.state; summary = { extended: minutes };
  } else {
    if (room.status !== 'active') throw new AppError('projector:notRunning', 409);
    if (room.paused_at) throw new AppError('projector:paused', 409);
    const pool = await loadPool(i.roomId);
    const rec = await reconcile(state, pool);
    state = rec.state;
    const verdict = i.payload.verdict === 'correct' || i.payload.verdict === 'wrong' ? (i.payload.verdict as 'correct' | 'wrong') : undefined;
    const cmd: GameCommand = { action: i.action, payload: Object.fromEntries(Object.entries(i.payload).filter(([k]) => k !== 'verdict')) };
    // a grade for a team whose answer was just reconciled is already done: answer it from the state instead of failing the teacher's click
    const already = i.action === 'grade' && rec.applied.length > 0 && !!state.core.ask?.answered.includes(String(i.payload.teamId ?? ''));
    const r = already ? { ok: true as const, state } : await run(state, cmd, pool, providers(i.roomId, i.hostId, state, pool, verdict));
    if (!r.ok) throw new AppError(`projector:${r.code}${r.params ? ':' + JSON.stringify(r.params) : ''}`, 422);
    state = r.state; summary = { phase: state.core.phase, ...(rec.applied.length ? { reconciled: rec.applied.length } : {}) };
  }
  const finished = state.core.phase === 'finished';
  try {
    await rpc('projector_commit', { p_room: i.roomId, p_host: i.hostId, p_command: i.commandId, p_expected: i.expectedRevision, p_action: i.action.slice(0, 40), p_payload: { ...i.payload, verdict: undefined }, p_state: state, p_summary: summary, p_finished: finished });
  } catch (e) {
    if (e instanceof AppError && /revision_conflict:(\d+)/.test(e.message)) throw new AppError(`projector:revisionConflict:${/revision_conflict:(\d+)/.exec(e.message)![1]}`, 409);
    throw e;
  }
  return { ...(await snapshot(i.roomId, 'host')), replayed: false };
}
