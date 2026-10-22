import 'server-only';
/** Arena Clash server orchestration (protocol `arena/1`). Same serverless-safe contract as Tower Defense and Obstacle Survival:
 *   - no timers and no in-memory game state: every request loads the match, catches it up with the pure engine (`advance`) and commits any change through ONE
 *     revision-locked SQL call (arena_commit for transitions / credits / purchases, arena_tick for the plain world step);
 *   - a student can only send STEERING INTENT (a direction + a sequence number). The server world moves the body, so there is nothing to forge;
 *   - grades come only from the existing five-stage answer pipeline (submitAnswer → commit_answer_v2 → `submissions`), read back as immutable rows;
 *   - an optional persistent worker may take the fenced lease (arena_acquire_lease); the HTTP path then keeps working as the fallback and never double-writes. */
import { randomBytes, createHash } from 'node:crypto';
import { AppError } from '../errors';
import { rpc, fromDbError } from '../api';
import { serviceDB } from '../supabase';
import { createRoom, getRoom, hashSecret, randomSecret, roomQuestion, verifyPlayer } from '../rooms';
import { submitAnswer } from '../answer-pipeline';
import { publicQuestionView } from '../public';
import { checkNickname } from '../safety';
import type { QuestionKind, Room } from '../types';
import { HELPER_COST, TICK_MS } from './balance';
import type { ArenaConfig, ArenaState, CommittedAnswer, Credit, Format, HostAction, IntentEntry, MapId, PoolEntry, RoomEffect, SeatAction } from './domain';
import { addSeat, advance, createSession, hydrateConfig, reduceHost, reduceSeat, RULES_VERSION, standingsOf, worldTarget } from './engine';
import { MIN_CYCLES, planMatch } from './plan';
import { project, type ArenaPublic } from './public';
import type { Timelines } from './sim';
import { arenaCreateSchema, validAxis } from './validation';

export type SessionRow = { room_id: string; host_id: string; format: Format; config: ArenaConfig; seed: string; state: ArenaState; revision: number; status: 'active' | 'finished'; spectator_hash: string | null; host_seen_at: string | null };
export const TEAM_IDS = ['t1', 't2', 't3', 't4'];
const DEFAULT_NAMES = ['Mint Comets', 'Coral Crew', 'Blue Orbits', 'Golden Gears'];
const GRACE_SECONDS = 1800;
/** Intents kept per seat; older ones can never matter because the committed world is at most a few ticks behind. */
const KEEP_INTENTS = 24;
/** Commit the plain world step only when it is at least this many ticks behind (100 ms) so a crowd of polling clients cannot turn into a write storm. */
const MIN_TICK_COMMIT = 2;
const N = (x: unknown) => Number(x);

// ── loading ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export async function loadSession(roomId: string): Promise<SessionRow> {
  const { data, error } = await serviceDB().from('arena_sessions').select('*').eq('room_id', roomId).maybeSingle();
  if (error) throw new AppError('Unexpected server error', 500);
  if (!data) throw new AppError('Arena Clash match not found', 404);
  const r = data as SessionRow;
  return { ...r, revision: N(r.revision), state: hydrateConfig(r.state, r.config) }; // trusted room settings, never request input
}
type QRow = { id: string; position: number; kind: QuestionKind; payload: Record<string, unknown> | null; base_points: number };
export async function loadPool(roomId: string): Promise<{ pool: PoolEntry[]; base: Map<string, number> }> {
  const { data, error } = await serviceDB().from('room_questions').select('id,position,kind,payload,base_points').eq('room_id', roomId).order('position');
  if (error) throw new AppError('Unexpected server error', 500);
  const rows = (data ?? []) as QRow[];
  return { pool: rows.map((r) => ({ position: r.position, id: r.id, kind: r.kind, repeat: typeof (r.payload?.meta as { repeatOf?: number } | undefined)?.repeatOf === 'number' })), base: new Map(rows.map((r) => [r.id, Number(r.base_points)])) };
}
export async function loadAnswers(roomId: string, roomQuestionId: string, base: Map<string, number>): Promise<CommittedAnswer[]> {
  const { data, error } = await serviceDB().from('submissions').select('id,actor_id,room_question_id,correct,base_awarded').eq('room_id', roomId).eq('actor_type', 'player').eq('room_question_id', roomQuestionId);
  if (error) throw new AppError('Unexpected server error', 500);
  return (data ?? []).map((s) => {
    const pts = base.get(s.room_question_id as string) ?? 0; const frac = pts > 0 ? Math.round((Number(s.base_awarded) * 1000) / pts) : s.correct ? 1000 : 0;
    return { id: s.id as string, seatId: s.actor_id as string, roomQuestionId: s.room_question_id as string, correct: !!s.correct, awardedFraction: s.correct ? 1000 : Math.max(0, Math.min(999, frac)) };
  });
}
type SeatRow = { player_id: string; intents: IntentEntry[]; last_seq: number };
export async function loadTimelines(roomId: string): Promise<Timelines> {
  const { data, error } = await serviceDB().from('arena_seats').select('player_id,intents,last_seq').eq('room_id', roomId);
  if (error) throw new AppError('Unexpected server error', 500);
  const out: Timelines = {};
  for (const r of (data ?? []) as SeatRow[]) out[r.player_id] = Array.isArray(r.intents) ? r.intents.filter((e) => e && Number.isFinite(e.tick) && Number.isFinite(e.seq) && validAxis(e.x) && validAxis(e.y)) : [];
  return out;
}

// ── commit ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export class Conflict extends Error { constructor(public current: number) { super(`arena_revision_conflict:${current}`); } }
type Purchase = { cycle: number; teamId: string; helper: string; cost: number; seatId: string };
type CommitArgs = { actor: string; command: string; expected: number; action: string; payload?: Record<string, unknown>; state: ArenaState; effects?: RoomEffect[]; credits?: Credit[]; purchases?: Purchase[]; summary?: Record<string, unknown>; seat?: { playerId: string } };
export function resultsRows(s: ArenaState) {
  if (!s.finish) return [];
  return s.finish.standings.map((st) => {
    const t = s.teams.find((x) => x.id === st.teamId)!;
    return { teamKey: t.id, teamName: t.name, rank: st.rank, tied: st.tied, finishReason: s.finish!.reason, score: st.score, quiz: st.quiz, objective: st.objective, pointsSpent: st.spent, players: st.players,
      summary: { captures: st.captures, pulses: st.pulses, handins: st.handins, deposited: st.deposited, earned: t.earned, format: s.format, weighting: s.weighting } };
  });
}
export async function commit(roomId: string, a: CommitArgs): Promise<{ revision: number; replayed: boolean }> {
  const finished = a.state.phase === 'finished';
  const { data, error } = await serviceDB().rpc('arena_commit', {
    p_room: roomId, p_actor: a.actor, p_command: a.command, p_expected: a.expected, p_action: a.action.slice(0, 40), p_payload: a.payload ?? {}, p_state: a.state,
    p_effects: a.effects ?? [], p_credits: a.credits ?? [], p_purchases: a.purchases ?? [], p_results: finished ? resultsRows(a.state) : [], p_finished: finished, p_summary: a.summary ?? {}, p_seat: a.seat ?? null, p_lease: null,
  });
  if (error) {
    const m = /arena_revision_conflict:(\d+)/.exec(error.message ?? '');
    if (m) throw new Conflict(Number(m[1]));
    if (/arena_(credit|purchase|lease)_conflict/.test(error.message ?? '')) throw new Conflict(-1);
    throw fromDbError(error);
  }
  return { revision: N((data as { revision: number }).revision), replayed: !!(data as { replayed: boolean }).replayed };
}
async function tickCommit(roomId: string, expected: number, state: ArenaState): Promise<number> {
  const { data, error } = await serviceDB().rpc('arena_tick', { p_room: roomId, p_expected: expected, p_state: state, p_lease: null });
  if (error) {
    const m = /arena_revision_conflict:(\d+)/.exec(error.message ?? '');
    if (m) throw new Conflict(Number(m[1]));
    if (/arena_lease_conflict/.test(error.message ?? '')) throw new Conflict(-1);
    throw fromDbError(error);
  }
  return N((data as { revision: number }).revision);
}
async function publish(roomId: string, revision: number, phase: string) {
  // Realtime is only a hint: clients always re-read the authoritative state, and poll if this never arrives.
  try {
    const ch = serviceDB().channel(`arena:${roomId}`);
    await Promise.race([ch.send({ type: 'broadcast', event: 'rev', payload: { revision, phase } }), new Promise((r) => setTimeout(r, 400))]);
    void serviceDB().removeChannel(ch);
  } catch { /* polling covers it */ }
}

/** Catch the match up to `now`. Phase transitions, credits and room effects commit through arena_commit; a pure world step commits through arena_tick when it is ≥ 2 ticks
 *  behind. Otherwise the caught-up state is returned for projection without a write (the function is deterministic, so every viewer sees the same world). */
export async function step(roomId: string, now = Date.now()): Promise<SessionRow> {
  let row = await loadSession(roomId);
  for (let attempt = 0; attempt < 3; attempt++) {
    const s = row.state;
    if (s.phase === 'finished' || s.phase === 'lobby' || s.paused) return row;
    const due = (s.phaseDeadlineMs !== null && now >= s.phaseDeadlineMs) || (s.phase === 'question_open' && s.question !== null && now >= s.question.deadlineMs);
    const worldDue = s.phase === 'arena_live' && worldTarget(s, now) > (s.live?.tick ?? 0);
    let answers: CommittedAnswer[] = []; let pool: PoolEntry[] = [];
    if (s.phase === 'question_open' && s.question?.questionId) { const p = await loadPool(roomId); pool = p.pool; answers = await loadAnswers(roomId, s.question.questionId, p.base); }
    else if (due) pool = (await loadPool(roomId)).pool;
    if (!due && !worldDue && !(s.phase === 'question_open' && answers.length)) return row;
    const timelines = s.phase === 'arena_live' || due ? await loadTimelines(roomId) : {};
    const out = advance(s, { now, pool, answers, timelines });
    if (!out.changed) return row;
    const transition = out.state.phase !== s.phase || out.state.cycle !== s.cycle || out.effects.length > 0 || out.credits.length > 0;
    try {
      if (transition) {
        const c = await commit(roomId, { actor: 'system', command: `system-advance-${row.revision}`, expected: row.revision, action: `advance:${out.state.phase}`, state: out.state, effects: out.effects, credits: out.credits, summary: { phase: out.state.phase, cycle: out.state.cycle } });
        if (c.replayed) { row = await loadSession(roomId); continue; }
        void publish(roomId, c.revision, out.state.phase);
        return { ...row, state: out.state, revision: c.revision, status: out.state.phase === 'finished' ? 'finished' : 'active' };
      }
      const behind = (out.state.live?.tick ?? 0) - (s.live?.tick ?? 0);
      if (behind < MIN_TICK_COMMIT) return { ...row, state: out.state };
      const rev = await tickCommit(roomId, row.revision, out.state);
      return { ...row, state: out.state, revision: rev };
    } catch (e) { if (e instanceof Conflict) { row = await loadSession(roomId); continue; } throw e; }
  }
  return row;
}

// ── create / preflight ─────────────────────────────────────────────────────────────────────────────────────────────────────
async function quizKinds(quizId: string): Promise<QuestionKind[]> {
  const { data, error } = await serviceDB().from('quiz_questions').select('kind,position').eq('quiz_id', quizId).order('position');
  if (error) throw new AppError('Unexpected server error', 500);
  return (data ?? []).map((q) => q.kind as QuestionKind);
}
export async function preflight(input: { quizId: string; minutes: number; readAloud: boolean; lowPressure: boolean; allowReviewCycle: boolean }) {
  const kinds = await quizKinds(input.quizId);
  const plan = planMatch({ durationMinutes: input.minutes, readAloud: input.readAloud, lowPressure: input.lowPressure, allowReviewCycle: input.allowReviewCycle }, kinds);
  const byKind: Record<string, number> = {}; for (const k of kinds) byKind[k] = (byKind[k] ?? 0) + 1;
  return { plan: { cycles: plan.cycles, episodeSeconds: plan.episodeSeconds, estimatedMinutes: plan.estimatedMinutes, questionsAvailable: plan.questionsAvailable, reviewCycle: plan.reviewCycle, notes: plan.notes, minutes: plan.minutes, quizShare: plan.quizShare }, questions: kinds.length, byKind, ok: plan.cycles >= MIN_CYCLES || kinds.length >= MIN_CYCLES };
}
export async function createArenaRoom(input: unknown, user: { id: string }) {
  const v = arenaCreateSchema.parse(input);
  const names = (v.teamNames ?? DEFAULT_NAMES.slice(0, v.teamCount)).map((n) => n.normalize('NFKC').replace(/\s+/g, ' ').trim());
  if (new Set(names.map((n) => n.toLowerCase())).size !== names.length) throw new AppError('Teams need different names', 400);
  const pre = await preflight({ quizId: v.quizId, minutes: v.minutes, readAloud: v.readAloud, lowPressure: v.lowPressure, allowReviewCycle: v.allowReviewCycle });
  if (!pre.ok) throw new AppError('This quiz needs at least 3 questions for Arena Clash.', 400);
  const config: ArenaConfig = { schemaVersion: 1, format: v.format as Format, mapId: v.mapId as MapId, seed: randomBytes(8).toString('hex'), durationMinutes: v.minutes, teamCount: v.teamCount, teamNames: names, teamSizeCap: v.teamSizeCap, weighting: v.weighting, lowPressure: v.lowPressure, readAloud: v.readAloud, hideNames: v.hideNames, allowReviewCycle: v.allowReviewCycle, helpers: v.helpers as ArenaConfig['helpers'] };
  const out = await createRoom({ quizId: v.quizId, mode: 'online', flow: 'synchronized', durationSeconds: v.minutes * 60 + GRACE_SECONDS * 2, questionSeconds: null, modifiers: [], slotLimit: 3, teamNames: [], lowPressure: v.lowPressure || undefined, readAloud: v.readAloud, untimed: true, access: v.requireApproval ? { requireApproval: true } : undefined }, user);
  const roomId = out.roomId;
  try {
    const room = await getRoom(roomId);
    const { error: upErr } = await serviceDB().from('rooms').update({ config: { ...room.config, hideSpeedBonus: true, arena: { format: v.format, mapId: v.mapId } } }).eq('id', roomId);
    if (upErr) throw new AppError('Unexpected server error', 500);
    if (pre.plan.reviewCycle) await rpc('projector_add_repeat_cycle', { p_room: roomId, p_host: user.id, p_consent: true, p_count: Math.max(0, pre.plan.cycles - pre.questions) });
    const { pool } = await loadPool(roomId); const kinds = await quizKinds(v.quizId);
    const plan = planMatch(config, kinds);
    const state = createSession(config, plan, pool, TEAM_IDS.slice(0, v.teamCount), Date.now());
    await rpc('arena_create_session', { p_room: roomId, p_host: user.id, p_format: v.format, p_config: config, p_seed: randomBytes(16).toString('hex'), p_state: state });
    return { roomId, joinCode: out.code, plan: pre.plan, hostUrl: `/quiz/arena/${roomId}/host`, joinUrl: `/quiz/arena/join?code=${out.code}` };
  } catch (e) { await serviceDB().from('rooms').delete().eq('id', roomId); throw e; }
}

// ── seats ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export const seatCookie = (roomId: string) => `qz_ar_${roomId.replace(/-/g, '')}`;
export async function verifySeat(room: Pick<Room, 'id'>, token: string | undefined | null) {
  if (!token) throw new AppError('Join the room first', 401);
  const player = await verifyPlayer(room, token);
  const { data } = await serviceDB().from('players').select('status').eq('id', player.id).maybeSingle();
  const status = (data?.status as string | undefined) ?? 'active';
  if (status === 'removed' || status === 'banned') throw new AppError('The teacher removed this device from the match.', 403);
  return { player, status };
}
async function discardUnseated(playerId: string) {
  try { const del = await serviceDB().from('players').delete().eq('id', playerId); if (del.error) await serviceDB().from('players').update({ status: 'removed' }).eq('id', playerId); } catch { /* the refusal is what the student needs to see */ }
}
export async function joinArena(input: { joinCode: string; displayName: string; desiredTeam?: string }, bucket: string | null) {
  const nick = checkNickname(input.displayName);
  if (!nick.ok) throw new AppError(nick.message ?? 'Please choose a different name.', 400);
  const code = input.joinCode.toUpperCase();
  const { data: roomRow } = await serviceDB().from('rooms').select('id,config,status').eq('join_code', code).maybeSingle();
  if (!roomRow || !(roomRow.config as { arena?: unknown })?.arena || roomRow.status === 'ended') throw new AppError('This online room is not joinable', 400);
  const roomId = roomRow.id as string; const first = await loadSession(roomId);
  if (first.state.locked) throw new AppError('The teacher has closed this room to new players.', 403);
  const token = randomSecret();
  const v2 = await serviceDB().rpc('join_room_v2', { p_code: code, p_name: nick.name, p_hash: hashSecret(token), p_bucket: bucket });
  if (v2.error) throw fromDbError(v2.error);
  const joined = v2.data as { roomId: string; playerId: string; status?: string };
  for (let attempt = 0; attempt < 4; attempt++) {
    const cur = await loadSession(roomId); const now = Date.now();
    const r = addSeat(cur.state, joined.playerId, nick.name, now, input.desiredTeam ?? null);
    if (!r.ok) { await discardUnseated(joined.playerId); throw new AppError(r.message, r.code === 'ROOM_FULL' || r.code === 'TEAM_FULL' ? 409 : 403); }
    try {
      await commit(roomId, { actor: joined.playerId, command: `join-${joined.playerId}`, expected: cur.revision, action: 'join', state: r.state, seat: { playerId: joined.playerId } });
      const seat = r.state.seats.find((x) => x.id === joined.playerId)!;
      return { roomId, seatId: joined.playerId, teamId: seat.teamId, status: joined.status ?? 'active', token };
    } catch (e) { if (e instanceof Conflict) continue; throw e; }
  }
  await discardUnseated(joined.playerId);
  throw new AppError('The room is busy — please try again.', 409);
}

// ── projections ────────────────────────────────────────────────────────────────────────────────────────────────────────────
export type Viewer = { view: 'student'; seatId: string } | { view: 'host' } | { view: 'projector' };
export type ArenaSnapshot = ArenaPublic & { revision: number; room: { id: string; code: string; status: string }; map: { mapId: string; format: string; seed: string }; questionView: Record<string, unknown> | null; tip: string | null; mine: number | null; award: number | null };
export const TIPS: Record<string, string> = {
  multiple_choice: 'Read every option before you pick. Cross out the ones that cannot be right.', truth_hunt: 'Judge each statement on its own: one false word makes it false.',
  answer_forge: 'Say the answer in a few words first, then check the spelling.', connection_rush: 'Start with the pair you are most sure about; the rest get easier.', fill_table: 'Fill the cells you know first, then use them to work out the rest.',
};
export async function snapshot(roomId: string, viewer: Viewer, now = Date.now()): Promise<ArenaSnapshot> {
  const row = await step(roomId, now); const room = await getRoom(roomId); const s = row.state;
  let answered = new Set<string>(); let mine: number | null = null;
  const q = s.question;
  if (q?.questionId && ['question_open', 'reveal'].includes(s.phase)) {
    const { data } = await serviceDB().from('submissions').select('actor_id,base_awarded').eq('room_id', roomId).eq('room_question_id', q.questionId).eq('actor_type', 'player');
    answered = new Set((data ?? []).map((d) => d.actor_id as string));
    // a student's own result is private until the reveal: only their own row is ever read back to them
    if (viewer.view === 'student' && s.phase === 'reveal') { const mineRow = (data ?? []).find((d) => d.actor_id === viewer.seatId); const q0 = await roomQuestion(room, q.position); const base = Math.max(1, Number(q0?.base_points) || 1); mine = mineRow ? Math.max(0, Math.min(1000, Math.round((Number(mineRow.base_awarded) / base) * 1000))) : null; }
  }
  const pub = project(s, viewer.view, viewer.view === 'student' ? viewer.seatId : null, now, answered);
  let questionView: Record<string, unknown> | null = null; let tip: string | null = null;
  if (q && ['question_open', 'reveal'].includes(s.phase)) {
    const rq = await roomQuestion(room, q.position);
    if (rq) { questionView = publicQuestionView(rq, { reveal: s.phase === 'reveal', hostPeek: viewer.view === 'host', seed: `${rq.id}:${viewer.view === 'student' ? viewer.seatId : 'class'}` }); tip = TIPS[rq.kind] ?? null; }
  }
  const me = viewer.view === 'student' ? s.seats.find((x) => x.id === viewer.seatId) : null;
  const award = me && s.phase === 'reveal' ? (s.teams.find((t) => t.id === me.teamId)?.awards.at(-1) ?? null) : null;
  return { ...pub, revision: row.revision, room: { id: room.id, code: room.join_code, status: room.status }, map: { mapId: row.config.mapId, format: row.config.format, seed: row.config.seed }, questionView, tip, mine, award };
}
export async function touch(roomId: string, who: { seatId?: string; host?: boolean }) {
  try { await serviceDB().rpc('arena_touch', { p_room: roomId, p_player: who.seatId ?? null, p_host: !!who.host }); } catch { /* presence is best effort */ }
}

// ── commands ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
export type CommandOutcome = { ok: true; revision: number; replayed: boolean; note?: string } | { ok: false; code: string; message: string; currentRevision: number };
export async function seatCommand(roomId: string, seatId: string, commandId: string, action: SeatAction, expectedRevision?: number): Promise<CommandOutcome> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const row = await step(roomId); const r = reduceSeat(row.state, seatId, action);
    if (!r.ok) {
      const stale = expectedRevision !== undefined && expectedRevision < row.revision && r.code === 'INSUFFICIENT_POINTS';
      return { ok: false, code: stale ? 'STALE_REVISION' : r.code, message: stale ? 'A teammate just used these points. The shop is refreshed.' : r.message, currentRevision: row.revision };
    }
    const seat = row.state.seats.find((x) => x.id === seatId);
    const purchases: Purchase[] = action.kind === 'buy' && seat ? [{ cycle: row.state.cycle, teamId: seat.teamId, helper: action.helper, cost: HELPER_COST[action.helper], seatId }] : [];
    try {
      const c = await commit(roomId, { actor: seatId, command: commandId, expected: row.revision, action: `seat:${action.kind}`, payload: action as unknown as Record<string, unknown>, state: r.state, purchases });
      if (!c.replayed) void publish(roomId, c.revision, r.state.phase);
      return { ok: true, revision: c.revision, replayed: c.replayed, note: r.note };
    } catch (e) {
      if (e instanceof Conflict) { if (e.current === -1 && action.kind === 'buy') return { ok: false, code: 'ALREADY_BOUGHT', message: 'Your team already bought a helper this planning phase.', currentRevision: row.revision }; continue; }
      throw e;
    }
  }
  throw new AppError('The match is busy — please try again.', 409);
}
export async function hostCommand(roomId: string, commandId: string, action: HostAction): Promise<CommandOutcome> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const row = await step(roomId); const { pool } = action.kind === 'start' || action.kind === 'extend' ? await loadPool(roomId) : { pool: [] as PoolEntry[] };
    const { result, effects } = reduceHost(row.state, action, Date.now(), pool);
    if (!result.ok) return { ok: false, code: result.code, message: result.message, currentRevision: row.revision };
    try {
      const c = await commit(roomId, { actor: 'host', command: commandId, expected: row.revision, action: `host:${action.kind}`, payload: action as unknown as Record<string, unknown>, state: result.state, effects });
      if (!c.replayed) void publish(roomId, c.revision, result.state.phase);
      return { ok: true, revision: c.revision, replayed: c.replayed };
    } catch (e) { if (e instanceof Conflict) continue; throw e; }
  }
  throw new AppError('The match is busy — please try again.', 409);
}

export type InputOutcome = { ok: true; replayed: boolean; seq: number; tick: number } | { ok: false; code: string; message: string; status: number };
const round3 = (n: number) => Math.round(n * 1000) / 1000;
/** One steering intent. The server stamps it with its own clock (the next tick the world will simulate), so a client can neither back-date nor pre-date it. */
export async function submitInput(roomId: string, seatId: string, move: { seq: number; x: number; y: number }): Promise<InputOutcome> {
  if (!validAxis(move.x) || !validAxis(move.y) || !Number.isInteger(move.seq)) return { ok: false, code: 'INPUT_INVALID', message: 'Invalid input.', status: 400 };
  const sess = await step(roomId); const s = sess.state; const now = Date.now();
  const seat = s.seats.find((x) => x.id === seatId);
  if (!seat || seat.revoked) return { ok: false, code: 'SEAT_REVOKED', message: 'The teacher removed this device from the match.', status: 403 };
  if (s.paused) return { ok: false, code: 'PAUSED', message: 'The game is paused.', status: 409 };
  if (s.phase !== 'arena_live' || !s.live) return { ok: false, code: 'FROZEN', message: 'The world is frozen right now.', status: 409 };
  const { data, error } = await serviceDB().from('arena_seats').select('intents,last_seq').eq('room_id', roomId).eq('player_id', seatId).maybeSingle();
  if (error) throw new AppError('Unexpected server error', 500);
  if (!data) return { ok: false, code: 'SEAT_REVOKED', message: 'Join the room first.', status: 403 };
  const last = N(data.last_seq); const tick = Math.max(s.live.tick, worldTarget(s, now)) + 1;
  if (move.seq <= last) return { ok: true, replayed: true, seq: last, tick };
  let x = move.x; let y = move.y; const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
  const intents = [...((data.intents as IntentEntry[]) ?? []).slice(-(KEEP_INTENTS - 1)), { tick, x: round3(x), y: round3(y), seq: move.seq }];
  const res = await serviceDB().rpc('arena_input', { p_room: roomId, p_seat: seatId, p_seq: move.seq, p_intents: intents });
  if (res.error) { if (/arena_no_seat/.test(res.error.message ?? '')) return { ok: false, code: 'SEAT_REVOKED', message: 'Join the room first.', status: 403 }; throw fromDbError(res.error); }
  return { ok: true, replayed: !!(res.data as { replayed?: boolean }).replayed, seq: move.seq, tick };
}

/** A student's quiz answer. Only while the class question is open, only for a seat that was on the roster when it opened, never trusting a client grade. */
export async function answer(roomId: string, token: string, seatId: string, input: { roomQuestionId: string; response: unknown }) {
  const row = await step(roomId); const s = row.state; const seat = s.seats.find((x) => x.id === seatId);
  if (!seat || seat.revoked) throw new AppError('The teacher removed this device from the match.', 403);
  if (s.phase === 'finished') throw new AppError('The match is over.', 409);
  if (s.paused) throw new AppError('The game is paused.', 409);
  const q = s.question;
  if (s.phase !== 'question_open' || !q || q.questionId !== input.roomQuestionId) throw new AppError('That question is closed.', 409);
  if (Date.now() > q.deadlineMs + 1500) throw new AppError('That question is closed.', 409);
  if (!(q.eligible[seat.teamId] ?? []).includes(seatId)) throw new AppError('You joined after this question opened — the next one is yours.', 409);
  await submitAnswer({ roomId, roomQuestionId: input.roomQuestionId, token, response: input.response, wager: 0 }, { allowArena: true });
  void step(roomId).catch(() => undefined); // may close the question early when everyone has answered
  return { accepted: true, private: true };
}

// ── projector link, results ────────────────────────────────────────────────────────────────────────────────────────────────
export async function makeSpectatorLink(roomId: string, hostId: string) {
  const token = randomSecret(); await rpc('arena_set_spectator', { p_room: roomId, p_host: hostId, p_hash: createHash('sha256').update(token).digest('hex') });
  return { token, url: `/quiz/arena/${roomId}/screen#k=${token}` };
}
export async function verifySpectator(roomId: string, token: string | null) {
  if (!token || token.length > 120) throw new AppError('This projector link is not valid', 403);
  const row = await loadSession(roomId);
  if (!row.spectator_hash || row.spectator_hash !== createHash('sha256').update(token).digest('hex')) throw new AppError('This projector link is not valid', 403);
}
export async function results(roomId: string) { const { data } = await serviceDB().from('arena_results').select('*').eq('room_id', roomId).order('rank'); return data ?? []; }
/** Learning report: per question, how the class did (counts only for students), plus the explanation once the match is over. */
export async function learningReport(roomId: string, forHost: boolean) {
  const row = await loadSession(roomId); const room = await getRoom(roomId);
  const { data: qs } = await serviceDB().from('room_questions').select('id,position,kind,prompt,payload,answer_key,base_points').eq('room_id', roomId).order('position');
  const { data: subs } = await serviceDB().from('submissions').select('room_question_id,correct,base_awarded,actor_id').eq('room_id', roomId).eq('actor_type', 'player');
  const used = new Set(row.state.usedPositions); const ended = room.status === 'ended' || row.state.phase === 'finished';
  return (qs ?? []).filter((q) => used.has(q.position as number)).map((q) => {
    const mine = (subs ?? []).filter((x) => x.room_question_id === q.id); const pts = Number(q.base_points) || 1;
    const correct = mine.filter((x) => x.correct).length; const partial = mine.filter((x) => !x.correct && Number(x.base_awarded) > 0).length;
    return { position: q.position, kind: q.kind, prompt: q.prompt, answered: mine.length, correct, partial, wrong: mine.length - correct - partial,
      avgPct: mine.length ? Math.round((mine.reduce((n, x) => n + Math.min(1, Number(x.base_awarded) / pts), 0) / mine.length) * 100) : null,
      explanation: ended ? ((q.answer_key as { explanation?: string } | null)?.explanation ?? null) : null,
      ...(forHost ? { byPlayer: Object.fromEntries(mine.map((x) => [x.actor_id as string, x.correct ? 'correct' : Number(x.base_awarded) > 0 ? 'partial' : 'wrong'])) } : {}) };
  });
}
export async function replay(roomId: string, after = 0) {
  const { data } = await serviceDB().from('arena_events').select('revision,actor_key,action,summary,created_at').eq('room_id', roomId).order('revision').limit(500);
  return (data ?? []).filter((e) => Number(e.revision) > after).map((e) => ({ revision: Number(e.revision), actor: e.actor_key === 'host' || e.actor_key === 'system' ? e.actor_key : 'player', action: e.action, summary: e.summary, at: e.created_at }));
}
export { RULES_VERSION, TICK_MS, standingsOf };
