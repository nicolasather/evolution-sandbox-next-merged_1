import 'server-only';
/** Tower Defense server orchestration. Serverless-safe by construction:
 *   - no timers, no in-memory game state: every request loads the match, catches it up with the pure engine (`advance`), and commits any change
 *     through ONE revision-locked SQL transaction (td_commit) together with its room side effects and its exactly-once credits;
 *   - grades come only from the existing five-stage answer pipeline (submitAnswer → commit_answer_v2 → `submissions`), read back as immutable rows;
 *   - two requests racing to advance the same revision use the same command id, so the loser is answered from the ledger (no double step). */
import { createHash, randomBytes } from 'node:crypto';
import { AppError } from '../errors';
import { rpc, fromDbError } from '../api';
import { serviceDB } from '../supabase';
import { createRoom, getRoom, hashSecret, randomSecret, roomQuestion, verifyPlayer } from '../rooms';
import { submitAnswer } from '../answer-pipeline';
import { publicQuestionView } from '../public';
import { checkNickname } from '../safety';
import type { QuestionKind, Room } from '../types';
import { addSeat, advance, createMatch, creditPersonal, personalAllowed, reduceHost, reduceSeat, RULES_VERSION, type CommittedAnswer, type Credit, type PoolEntry, type RoomEffect } from './engine';
import { planMatch } from './plan';
import { project, accuracyOf, type TDPublic } from './public';
import type { TDConfig, TDHostAction, TDSeatAction, TDState, TDView } from './domain';
import { tdCreateSchema } from './validation';

export type SessionRow = { room_id: string; host_id: string; format: string; config: TDConfig; seed: string; state: TDState; revision: number; status: 'active' | 'finished'; spectator_hash: string | null; host_seen_at: string | null };
const DEFAULT_NAMES = ['Mint Comets', 'Coral Crew', 'Blue Orbits', 'Golden Gears'];
export const TEAM_IDS = ['sq1', 'sq2', 'sq3', 'sq4'];
const GRACE_SECONDS = 1800;

// ── loading ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export async function loadSession(roomId: string): Promise<SessionRow> {
  const { data, error } = await serviceDB().from('td_sessions').select('*').eq('room_id', roomId).maybeSingle();
  if (error) throw new AppError('Unexpected server error', 500);
  if (!data) throw new AppError('Tower Defense match not found', 404);
  return { ...(data as SessionRow), revision: Number((data as SessionRow).revision) };
}
type QRow = { id: string; position: number; kind: QuestionKind; payload: Record<string, unknown> | null; base_points: number };
export async function loadPool(roomId: string): Promise<{ pool: PoolEntry[]; base: Map<string, number> }> {
  const { data, error } = await serviceDB().from('room_questions').select('id,position,kind,payload,base_points').eq('room_id', roomId).order('position');
  if (error) throw new AppError('Unexpected server error', 500);
  const rows = (data ?? []) as QRow[];
  return {
    pool: rows.map((r) => ({ position: r.position, id: r.id, kind: r.kind, repeat: typeof (r.payload?.meta as { repeatOf?: number } | undefined)?.repeatOf === 'number' })),
    base: new Map(rows.map((r) => [r.id, Number(r.base_points)])),
  };
}
/** Committed submissions of this room as engine answers. `awardedFraction` is base_awarded / base_points in thousandths (speed bonus capped away). */
export async function loadAnswers(roomId: string, roomQuestionId: string | null, base: Map<string, number>): Promise<CommittedAnswer[]> {
  let q = serviceDB().from('submissions').select('id,actor_id,room_question_id,correct,base_awarded').eq('room_id', roomId).eq('actor_type', 'player');
  if (roomQuestionId) q = q.eq('room_question_id', roomQuestionId);
  const { data, error } = await q;
  if (error) throw new AppError('Unexpected server error', 500);
  return (data ?? []).map((s) => {
    const pts = base.get(s.room_question_id as string) ?? 0;
    const frac = pts > 0 ? Math.round((Number(s.base_awarded) * 1000) / pts) : s.correct ? 1000 : 0;
    return { id: s.id as string, seatId: s.actor_id as string, roomQuestionId: s.room_question_id as string, correct: !!s.correct, awardedFraction: s.correct ? 1000 : Math.max(0, Math.min(999, frac)) };
  });
}
async function loadPresence(roomId: string): Promise<Record<string, number>> {
  const { data } = await serviceDB().from('td_presence').select('player_id,seen_at').eq('room_id', roomId);
  return Object.fromEntries((data ?? []).map((p) => [p.player_id as string, Date.parse(p.seen_at as string)]));
}

// ── commit ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export class Conflict extends Error { constructor(public current: number) { super(`td_revision_conflict:${current}`); } }
type CommitArgs = { actor: string; command: string; expected: number; action: string; payload?: Record<string, unknown>; state: TDState; effects?: RoomEffect[]; credits?: Credit[]; summary?: Record<string, unknown> };
function resultsRows(s: TDState) {
  if (!s.finish) return [];
  return s.finish.standings.map((st) => {
    const t = s.teams.find((x) => x.id === st.teamId)!;
    const roster = s.seats.filter((x) => x.teamId === t.id);
    return {
      teamKey: t.id, teamName: t.name, rank: st.rank, outcome: s.config.format === 'coop' ? s.finish!.outcome : st.outcome, wavesCleared: t.wavesCleared, coreHP: t.coreHP, coreMax: t.maxCoreHP,
      accuracyPct: accuracyOf(t) ?? '', answered: t.answered, points: t.points, earned: t.earned, spent: t.spent,
      report: { leaks: t.leaks, kills: t.kills, towers: t.towers.map((x) => ({ kind: x.kind, level: x.level, branch: x.branch })), players: roster.length, reason: s.finish!.reason },
    };
  });
}
export async function commit(roomId: string, a: CommitArgs): Promise<{ revision: number; replayed: boolean }> {
  const finished = a.state.phase === 'finished';
  const { data, error } = await serviceDB().rpc('td_commit', {
    p_room: roomId, p_actor: a.actor, p_command: a.command, p_expected: a.expected, p_action: a.action.slice(0, 40), p_payload: a.payload ?? {}, p_state: a.state,
    p_effects: a.effects ?? [], p_credits: a.credits ?? [], p_results: finished ? resultsRows(a.state) : [], p_finished: finished, p_summary: a.summary ?? {},
  });
  if (error) {
    const m = /td_revision_conflict:(\d+)/.exec(error.message ?? '');
    if (m) throw new Conflict(Number(m[1]));
    if (/td_credit_conflict/.test(error.message ?? '')) throw new Conflict(-1); // an answer was already credited by a racing request: reload
    throw fromDbError(error);
  }
  return { revision: Number((data as { revision: number }).revision), replayed: !!(data as { replayed: boolean }).replayed };
}
async function publish(roomId: string, revision: number, phase: string) {
  // Realtime is only a hint: clients always re-read the authoritative state, and poll if this never arrives.
  try {
    const ch = serviceDB().channel(`td:${roomId}`);
    await Promise.race([ch.send({ type: 'broadcast', event: 'rev', payload: { revision, phase } }), new Promise((r) => setTimeout(r, 400))]);
    void serviceDB().removeChannel(ch);
  } catch { /* polling covers it */ }
}

/** Catch the match up to `now` and persist any change. Returns the current authoritative row. Safe to call from every request. */
export async function step(roomId: string, now = Date.now()): Promise<SessionRow> {
  let row = await loadSession(roomId);
  for (let attempt = 0; attempt < 3; attempt++) {
    const s = row.state;
    if (s.phase === 'finished' || s.phase === 'lobby' || s.paused) return row;
    const due = (s.phaseDeadlineMs !== null && now >= s.phaseDeadlineMs) || s.phase === 'quiz_open' || s.phase === 'build';
    if (!due) return row;
    const { pool, base } = await loadPool(roomId);
    const r = s.rounds.find((x) => x.n === s.round);
    const answers = s.phase === 'quiz_open' && r?.question ? await loadAnswers(roomId, r.question.roomQuestionId, base) : [];
    const presence = s.phase === 'wave_result' || s.phase === 'countdown' ? await loadPresence(roomId) : undefined;
    const out = advance(s, { now, seed: row.seed, pool, answers, presence, hostSeenMs: row.host_seen_at ? Date.parse(row.host_seen_at) : null });
    if (!out.changed) return row;
    try {
      const c = await commit(roomId, { actor: 'system', command: `system-advance-${row.revision}`, expected: row.revision, action: `advance:${out.state.phase}`.slice(0, 40), state: out.state, effects: out.effects, credits: out.credits, summary: { phase: out.state.phase, round: out.state.round } });
      if (c.replayed) { row = await loadSession(roomId); continue; }
      void publish(roomId, c.revision, out.state.phase);
      return { ...row, state: out.state, revision: c.revision, status: out.state.phase === 'finished' ? 'finished' : 'active' };
    } catch (e) {
      if (e instanceof Conflict) { row = await loadSession(roomId); continue; }
      throw e;
    }
  }
  return row;
}

// ── create / preflight ─────────────────────────────────────────────────────────────────────────────────────────────────────
async function quizKinds(quizId: string): Promise<QuestionKind[]> {
  const { data, error } = await serviceDB().from('quiz_questions').select('kind,position').eq('quiz_id', quizId).order('position');
  if (error) throw new AppError('Unexpected server error', 500);
  return (data ?? []).map((q) => q.kind as QuestionKind);
}
export async function preflight(input: { quizId: string; minutes: number; flow: 'synchronized' | 'independent'; focus: TDConfig['focus']; readAloud: boolean; allowReviewCycle: boolean }) {
  const kinds = await quizKinds(input.quizId);
  const plan = planMatch({ durationMinutes: input.minutes, focus: input.focus, readAloud: input.readAloud, questionFlow: input.flow, allowReviewCycle: input.allowReviewCycle }, kinds, kinds.length);
  const byKind: Record<string, number> = {}; for (const k of kinds) byKind[k] = (byKind[k] ?? 0) + 1;
  return { plan, questions: kinds.length, byKind, ok: kinds.length >= 3 };
}

export async function createTDRoom(input: unknown, user: { id: string }) {
  const v = tdCreateSchema.parse(input);
  const names = (v.teamNames ?? DEFAULT_NAMES.slice(0, v.teamCount)).map((n) => n.normalize('NFKC').replace(/\s+/g, ' ').trim());
  if (new Set(names.map((n) => n.toLowerCase())).size !== names.length) throw new AppError('Squads need different names', 400);
  const pre = await preflight({ quizId: v.quizId, minutes: v.minutes, flow: v.flow, focus: v.focus, readAloud: v.readAloud, allowReviewCycle: v.allowReviewCycle });
  if (!pre.ok) throw new AppError('This quiz needs at least 3 questions for Tower Defense.', 400);
  const config: TDConfig = {
    schemaVersion: 1, format: v.format, mapId: v.mapId, durationMinutes: v.minutes, questionFlow: v.flow, focus: v.focus, lowPressure: v.lowPressure, readAloud: v.readAloud,
    teamSizeCap: v.teamSizeCap, teamCount: v.teamCount, teamNames: names, approvalAbove: v.approvalAbove, hideNames: v.hideNames, modifiers: v.modifiers, allowReviewCycle: v.allowReviewCycle,
  };
  const out = await createRoom({
    quizId: v.quizId, mode: 'online', flow: v.flow, durationSeconds: v.minutes * 60 + GRACE_SECONDS, questionSeconds: null, modifiers: [], slotLimit: 3, teamNames: [],
    lowPressure: v.lowPressure || undefined, readAloud: v.readAloud, untimed: true, access: v.requireApproval ? { requireApproval: true } : undefined,
  }, user);
  const roomId = out.roomId;
  try {
    // mark the room as Tower Defense (classic routes refuse it) and switch the speed bonus off for good
    const room = await getRoom(roomId);
    const { error: upErr } = await serviceDB().from('rooms').update({ config: { ...room.config, hideSpeedBonus: true, td: { format: v.format, mapId: v.mapId } } }).eq('id', roomId);
    if (upErr) throw new AppError('Unexpected server error', 500);
    if (pre.plan.reviewCycle) await rpc('projector_add_repeat_cycle', { p_room: roomId, p_host: user.id, p_consent: true, p_count: Math.max(0, pre.plan.questionsNeeded - pre.questions) });
    const { pool } = await loadPool(roomId);
    const state = createMatch(config, pool, TEAM_IDS.slice(0, v.teamCount), Date.now());
    await rpc('td_create_session', { p_room: roomId, p_host: user.id, p_format: v.format, p_config: config, p_seed: randomBytes(16).toString('hex'), p_state: state });
    return { roomId, joinCode: out.code, plan: state.plan, hostUrl: `/quiz/td/${roomId}/host`, joinUrl: `/quiz/td/join?code=${out.code}` };
  } catch (e) {
    await serviceDB().from('rooms').delete().eq('id', roomId);
    throw e;
  }
}

// ── seats ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export const seatCookie = (roomId: string) => `qz_td_${roomId.replace(/-/g, '')}`;
/** The seat behind a cookie token. A removed or banned player is refused here, before any game logic. */
export async function verifySeat(room: Pick<Room, 'id'>, token: string | undefined | null) {
  if (!token) throw new AppError('Join the room first', 401);
  const player = await verifyPlayer(room, token);
  const { data } = await serviceDB().from('players').select('status').eq('id', player.id).maybeSingle();
  const status = (data?.status as string | undefined) ?? 'active';
  if (status === 'removed' || status === 'banned') throw new AppError('The teacher removed this device from the match.', 403);
  return { player, status };
}
export async function joinTD(input: { joinCode: string; displayName: string; desiredTeam?: string }, bucket: string | null) {
  const nick = checkNickname(input.displayName);
  if (!nick.ok) throw new AppError(nick.message ?? 'Please choose a different name.', 400);
  const code = input.joinCode.toUpperCase();
  const { data: roomRow } = await serviceDB().from('rooms').select('id,config,status').eq('join_code', code).maybeSingle();
  // never reveal whether a private room exists: the same message for "no such code" and "not a Tower Defense room"
  if (!roomRow || !(roomRow.config as { td?: unknown })?.td || roomRow.status === 'ended') throw new AppError('This online room is not joinable', 400);
  const roomId = roomRow.id as string;
  const row = await loadSession(roomId);
  if (row.state.locked) throw new AppError('The teacher has closed this room to new players.', 403);
  const token = randomSecret();
  const v2 = await serviceDB().rpc('join_room_v2', { p_code: code, p_name: nick.name, p_hash: hashSecret(token), p_bucket: bucket });
  if (v2.error) throw fromDbError(v2.error);
  const joined = v2.data as { roomId: string; playerId: string; status?: string };
  for (let attempt = 0; attempt < 4; attempt++) {
    const cur = await loadSession(roomId);
    const r = addSeat(cur.state, joined.playerId, nick.name, Date.now(), input.desiredTeam ?? null);
    if (!r.ok) throw new AppError(r.message, 403);
    try {
      await commit(roomId, { actor: joined.playerId, command: `join-${joined.playerId}`, expected: cur.revision, action: 'join', state: r.state, payload: {} });
      await touch(roomId, { seatId: joined.playerId }); // a device that just joined is present
      const seat = r.state.seats.find((x) => x.id === joined.playerId)!;
      return { roomId, seatId: joined.playerId, teamId: seat.teamId, status: joined.status ?? 'active', token };
    } catch (e) { if (e instanceof Conflict) continue; throw e; }
  }
  throw new AppError('The room is busy — please try again.', 409);
}

// ── projections ────────────────────────────────────────────────────────────────────────────────────────────────────────────
export type Viewer = { view: 'student'; seatId: string } | { view: 'host' } | { view: 'projector' };
export type TDSnapshot = TDPublic & { revision: number; room: { id: string; code: string; status: string }; question: Record<string, unknown> | null; personal?: Record<string, unknown> | null };
export async function snapshot(roomId: string, viewer: Viewer, now = Date.now()): Promise<TDSnapshot> {
  const row = await step(roomId, now);
  const room = await getRoom(roomId);
  const pub = project(row.state, viewer.view as TDView, viewer.view === 'student' ? viewer.seatId : null, now);
  // the shared question: the key only after the reveal for everyone, or for the teacher's peek at any time
  let question: Record<string, unknown> | null = null;
  const r = row.state.rounds.find((x) => x.n === row.state.round);
  if (r?.question && ['quiz_open', 'reveal'].includes(row.state.phase)) {
    const q = await roomQuestion(room, r.question.position);
    if (q) question = publicQuestionView(q, { reveal: row.state.phase === 'reveal', hostPeek: viewer.view === 'host', seed: `${q.id}:${viewer.view === 'student' ? viewer.seatId : 'class'}` });
  }
  return { ...pub, revision: row.revision, room: { id: room.id, code: room.join_code, status: room.status }, question };
}
export async function touch(roomId: string, who: { seatId?: string; host?: boolean }) {
  try { await serviceDB().rpc('td_touch', { p_room: roomId, p_player: who.seatId ?? null, p_host: !!who.host }); } catch { /* presence is best effort */ }
}

// ── commands ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
export type CommandOutcome = { ok: true; revision: number; replayed: boolean; note?: string } | { ok: false; code: string; message: string; currentRevision: number };
export async function seatCommand(roomId: string, seatId: string, commandId: string, action: TDSeatAction, expectedRevision?: number): Promise<CommandOutcome> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const row = await step(roomId);
    const r = reduceSeat(row.state, seatId, action);
    if (!r.ok) {
      // a purchase that fails ONLY because a teammate spent the points in the meantime says so plainly
      const stale = expectedRevision !== undefined && expectedRevision < row.revision && r.code === 'INSUFFICIENT_POINTS';
      return { ok: false, code: stale ? 'STALE_REVISION' : r.code, message: stale ? 'Another teammate just used these points. The board is refreshed.' : r.message, currentRevision: row.revision };
    }
    try {
      const c = await commit(roomId, { actor: seatId, command: commandId, expected: row.revision, action: `seat:${action.kind}`, payload: action as unknown as Record<string, unknown>, state: r.state });
      if (!c.replayed) void publish(roomId, c.revision, r.state.phase);
      return { ok: true, revision: c.revision, replayed: c.replayed, note: r.note };
    } catch (e) { if (e instanceof Conflict) continue; throw e; }
  }
  throw new AppError('The board is busy — please try again.', 409);
}
export async function hostCommand(roomId: string, commandId: string, action: TDHostAction): Promise<CommandOutcome> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const row = await step(roomId);
    const { result, effects } = reduceHost(row.state, action, Date.now());
    if (!result.ok) return { ok: false, code: result.code, message: result.message, currentRevision: row.revision };
    try {
      const c = await commit(roomId, { actor: 'host', command: commandId, expected: row.revision, action: `host:${action.kind}`, payload: action as unknown as Record<string, unknown>, state: result.state, effects });
      if (!c.replayed) void publish(roomId, c.revision, result.state.phase);
      return { ok: true, revision: c.revision, replayed: c.replayed };
    } catch (e) { if (e instanceof Conflict) continue; throw e; }
  }
  throw new AppError('The match is busy — please try again.', 409);
}

/** A student's answer. Synchronized: only while the class question is open (same network grace for everyone); the grade stays private until the
 *  reveal. Independent: only within the personal per-round cap, credited once from the committed submission. Never trusts a client grade. */
export async function answer(roomId: string, token: string, seatId: string, input: { roomQuestionId: string; response: unknown }) {
  const row = await step(roomId);
  const s = row.state; const seat = s.seats.find((x) => x.id === seatId);
  if (!seat || seat.revoked) throw new AppError('The teacher removed this device from the match.', 403);
  if (s.phase === 'finished') throw new AppError('The match is over.', 409);
  if (s.paused) throw new AppError('The game is paused.', 409);
  if (s.config.questionFlow === 'synchronized') {
    const r = s.rounds.find((x) => x.n === s.round);
    if (s.phase !== 'quiz_open' || !r?.question || r.question.roomQuestionId !== input.roomQuestionId) throw new AppError('That question is closed.', 409);
    if (r.deadlineMs !== null && Date.now() > r.deadlineMs + 1500) throw new AppError('That question is closed.', 409);
    await submitAnswer({ roomId, roomQuestionId: input.roomQuestionId, token, response: input.response, wager: 0 }, { allowTD: true });
    void step(roomId).catch(() => undefined); // may close the question early if everyone has answered
    return { accepted: true, private: true };
  }
  const ok = personalAllowedForAnswer(s, seatId);
  if (!ok) throw new AppError('Open a question first.', 409);
  const res = await submitAnswer({ roomId, roomQuestionId: input.roomQuestionId, token, response: input.response, wager: 0 }, { allowTD: true });
  const credited = await creditOne(roomId, seatId, input.roomQuestionId);
  return { accepted: true, private: false, correct: res.correct, awarded: credited };
}
function personalAllowedForAnswer(s: TDState, seatId: string) { const seat = s.seats.find((x) => x.id === seatId); return !!seat && seat.answersThisRound > 0 && ['build', 'wave', 'wave_result'].includes(s.phase); }
async function creditOne(roomId: string, seatId: string, roomQuestionId: string): Promise<number> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const row = await loadSession(roomId); const { base } = await loadPool(roomId);
    const sub = (await loadAnswers(roomId, roomQuestionId, base)).find((a) => a.seatId === seatId);
    if (!sub) return 0;
    const { data: done } = await serviceDB().from('td_credits').select('amount').eq('room_id', roomId).eq('credit_key', `s:${sub.id}`).maybeSingle();
    if (done) return Number(done.amount);
    const c = creditPersonal(row.state, sub); if (!c.credit) return 0;
    try { await commit(roomId, { actor: seatId, command: `credit-${sub.id}`, expected: row.revision, action: 'credit', state: c.state, credits: [c.credit] }); return c.credit.amount; }
    catch (e) { if (e instanceof Conflict) continue; throw e; }
  }
  return 0;
}
/** Independent flow: reserve one personal question for this round and return it (the player's own cursor in the room's questions). */
export async function openPersonal(roomId: string, seatId: string) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const row = await step(roomId);
    const room = await getRoom(roomId);
    const { data: p } = await serviceDB().from('players').select('cursor_index').eq('id', seatId).maybeSingle();
    const cursor = Number(p?.cursor_index ?? 0);
    const q = await roomQuestion(room, cursor);
    if (!q) throw new AppError('You have answered every question in this quiz.', 409);
    const seat = row.state.seats.find((x) => x.id === seatId);
    // an already-reserved, unanswered question is simply shown again (no extra opportunity is used)
    const { data: sub } = await serviceDB().from('submissions').select('id').eq('room_question_id', q.id).eq('actor_id', seatId).maybeSingle();
    if (seat && seat.answersThisRound > 0 && !sub && seat.pendingQ === q.id) return publicQuestionView(q, { reveal: false, seed: `${q.id}:${seatId}` });
    const allowed = personalAllowed(row.state, seatId); if (!allowed.ok) throw new AppError(allowed.message, 409);
    const next = JSON.parse(JSON.stringify(row.state)) as TDState; const me = next.seats.find((x) => x.id === seatId)!;
    me.answersThisRound++; me.pendingQ = q.id;
    try { await commit(roomId, { actor: seatId, command: `open-${q.id}-${row.revision}`, expected: row.revision, action: 'seat:open_question', state: next }); return publicQuestionView(q, { reveal: false, seed: `${q.id}:${seatId}` }); }
    catch (e) { if (e instanceof Conflict) continue; throw e; }
  }
  throw new AppError('The match is busy — please try again.', 409);
}

// ── projector link, results, replay ─────────────────────────────────────────────────────────────────────────────────────────
export async function makeSpectatorLink(roomId: string, hostId: string) {
  const token = randomSecret();
  await rpc('td_set_spectator', { p_room: roomId, p_host: hostId, p_hash: createHash('sha256').update(token).digest('hex') });
  return { token, url: `/quiz/td/${roomId}/screen#k=${token}` };
}
export async function verifySpectator(roomId: string, token: string | null) {
  if (!token || token.length > 120) throw new AppError('This projector link is not valid', 403);
  const row = await loadSession(roomId);
  if (!row.spectator_hash || row.spectator_hash !== createHash('sha256').update(token).digest('hex')) throw new AppError('This projector link is not valid', 403);
}
export async function results(roomId: string) {
  const { data } = await serviceDB().from('td_results').select('*').eq('room_id', roomId).order('rank');
  return data ?? [];
}
/** Learning report: per question, how the class did (counts only, no names), plus the explanation once the match is over. */
export async function learningReport(roomId: string, forHost: boolean) {
  const row = await loadSession(roomId); const room = await getRoom(roomId);
  const { data: qs } = await serviceDB().from('room_questions').select('id,position,kind,prompt,payload,answer_key,base_points').eq('room_id', roomId).order('position');
  const { data: subs } = await serviceDB().from('submissions').select('room_question_id,correct,base_awarded,actor_id').eq('room_id', roomId).eq('actor_type', 'player');
  const used = new Set(row.state.usedPositions);
  const ended = room.status === 'ended' || row.state.phase === 'finished';
  const asked = (qs ?? []).filter((q) => used.has(q.position as number) || (subs ?? []).some((s) => s.room_question_id === q.id));
  return asked.map((q) => {
    const mine = (subs ?? []).filter((s) => s.room_question_id === q.id);
    const pts = Number(q.base_points) || 1;
    const correct = mine.filter((s) => s.correct).length; const partial = mine.filter((s) => !s.correct && Number(s.base_awarded) > 0).length;
    return {
      position: q.position, kind: q.kind, prompt: q.prompt, answered: mine.length, correct, partial, wrong: mine.length - correct - partial,
      avgPct: mine.length ? Math.round((mine.reduce((n, s) => n + Math.min(1, Number(s.base_awarded) / pts), 0) / mine.length) * 100) : null,
      explanation: ended ? ((q.answer_key as { explanation?: string } | null)?.explanation ?? null) : null,
      ...(forHost ? { byPlayer: Object.fromEntries(mine.map((s) => [s.actor_id as string, s.correct ? 'correct' : Number(s.base_awarded) > 0 ? 'partial' : 'wrong'])) } : {}),
    };
  });
}
export async function replay(roomId: string, after = 0) {
  const { data } = await serviceDB().from('td_events').select('revision,actor_key,action,summary,created_at').eq('room_id', roomId).order('revision').limit(500);
  // actor keys are room-scoped ids; payloads are omitted (they can hold nothing secret, but the log stays minimal)
  return (data ?? []).filter((e) => Number(e.revision) > after).map((e) => ({ revision: Number(e.revision), actor: e.actor_key === 'host' || e.actor_key === 'system' ? e.actor_key : 'player', action: e.action, summary: e.summary, at: e.created_at }));
}
export { RULES_VERSION };
