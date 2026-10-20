import 'server-only';
/** Obstacle Survival server orchestration. Serverless-safe by construction (same contract as Tower Defense):
 *   - no timers and no in-memory game state: every request loads the match, catches it up with the pure engine (`advance`) and commits any change through ONE
 *     revision-locked SQL transaction (os_commit) together with its room side effects and its exactly-once credits;
 *   - movement is validated here: a student's body only moves through os_input, which replays the batch on the same deterministic physics the browser predicts with;
 *   - grades come only from the existing five-stage answer pipeline (submitAnswer → commit_answer_v2 → `submissions`), read back as immutable rows. */
import { createHash, randomBytes } from 'node:crypto';
import { AppError } from '../errors';
import { rpc, fromDbError } from '../api';
import { serviceDB } from '../supabase';
import { createRoom, getRoom, hashSecret, randomSecret, roomQuestion, verifyPlayer } from '../rooms';
import { submitAnswer } from '../answer-pipeline';
import { publicQuestionView } from '../public';
import { checkNickname } from '../safety';
import type { QuestionKind, Room } from '../types';
import { MAX_AHEAD_TICKS, MAX_LAG_TICKS, TICK_MS } from './balance';
import { courseFor, type CourseIndex } from './course';
import type { Body, CommittedAnswer, Credit, HostAction, OSConfig, OSState, PoolEntry, RoomEffect, SeatAction, SeatRec } from './domain';
import { addSeat, addTeamEffects, advance, createSession, endsMatchNext, hydrateConfig, maxSeatTick, reduceHost, reduceSeat, RULES_VERSION, worldTick } from './engine';
import { MIN_CHAPTERS, planMatch } from './plan';
import { applyBatch, idleTo, newBody, type Ctx } from './physics';
import { project, type OSPublic } from './public';
import { osCreateSchema } from './validation';

export type SessionRow = { room_id: string; host_id: string; format: string; config: OSConfig; seed: string; state: OSState; revision: number; status: 'active' | 'finished'; spectator_hash: string | null; host_seen_at: string | null };
export const TEAM_IDS = ['sq1', 'sq2', 'sq3', 'sq4'];
const DEFAULT_NAMES = ['Mint Comets', 'Coral Crew', 'Blue Orbits', 'Golden Gears'];
const GRACE_SECONDS = 1800;
const IN_DB = (x: unknown) => Number(x);

// ── course cache (deterministic, so safe to share across requests in one instance) ────────────────────────────────────────
const courses = new Map<string, CourseIndex>();
export function courseOf(cfg: Pick<OSConfig, 'mapId' | 'courseSeed' | 'lowPressure'>): CourseIndex {
  const key = `${cfg.mapId}|${cfg.courseSeed}|${cfg.lowPressure ? 1 : 0}`; let c = courses.get(key);
  if (!c) { c = courseFor(cfg.mapId, cfg.courseSeed, cfg.lowPressure).idx; if (courses.size > 64) courses.delete(courses.keys().next().value as string); courses.set(key, c); }
  return c;
}
/** The physics context of one seat: its role, its squad's upgrades and pulses, and the gates that are open at each of its ticks. */
export function ctxFor(s: OSState, seat: SeatRec, idx: CourseIndex): Ctx {
  const team = s.teams.find((t) => t.id === seat.teamId); const perks: Ctx['perks'] = {};
  for (const p of team?.perks ?? []) perks[p] = (perks[p] ?? 0) + 1;
  return { idx, role: seat.role, perks, pulses: team?.pulses ?? [], limits: s.plan.limitDist, chapterTicks: s.plan.chapterTicks, seatId: seat.id };
}

// ── loading ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export async function loadSession(roomId: string): Promise<SessionRow> {
  const { data, error } = await serviceDB().from('os_sessions').select('*').eq('room_id', roomId).maybeSingle();
  if (error) throw new AppError('Unexpected server error', 500);
  if (!data) throw new AppError('Obstacle Survival match not found', 404);
  const r = data as SessionRow;
  return { ...r, revision: IN_DB(r.revision), state: hydrateConfig(r.state, r.config) }; // OS-F01/F02/F03: trusted room settings, never request input
}
type QRow = { id: string; position: number; kind: QuestionKind; payload: Record<string, unknown> | null; base_points: number };
export async function loadPool(roomId: string): Promise<{ pool: PoolEntry[]; base: Map<string, number> }> {
  const { data, error } = await serviceDB().from('room_questions').select('id,position,kind,payload,base_points').eq('room_id', roomId).order('position');
  if (error) throw new AppError('Unexpected server error', 500);
  const rows = (data ?? []) as QRow[];
  return { pool: rows.map((r) => ({ position: r.position, id: r.id, kind: r.kind, repeat: typeof (r.payload?.meta as { repeatOf?: number } | undefined)?.repeatOf === 'number' })), base: new Map(rows.map((r) => [r.id, Number(r.base_points)])) };
}
/** Committed submissions for one question as engine answers (`awardedFraction` in thousandths of the base points; the speed bonus is capped away). */
export async function loadAnswers(roomId: string, roomQuestionId: string, base: Map<string, number>): Promise<CommittedAnswer[]> {
  const { data, error } = await serviceDB().from('submissions').select('id,actor_id,room_question_id,correct,base_awarded').eq('room_id', roomId).eq('actor_type', 'player').eq('room_question_id', roomQuestionId);
  if (error) throw new AppError('Unexpected server error', 500);
  return (data ?? []).map((s) => {
    const pts = base.get(s.room_question_id as string) ?? 0; const frac = pts > 0 ? Math.round((Number(s.base_awarded) * 1000) / pts) : s.correct ? 1000 : 0;
    return { id: s.id as string, seatId: s.actor_id as string, roomQuestionId: s.room_question_id as string, correct: !!s.correct, awardedFraction: s.correct ? 1000 : Math.max(0, Math.min(999, frac)) };
  });
}
type SeatRow = { player_id: string; body: Body; revision: number };
export async function loadSeatRows(roomId: string): Promise<SeatRow[]> {
  const { data, error } = await serviceDB().from('os_seats').select('player_id,body,revision').eq('room_id', roomId);
  if (error) throw new AppError('Unexpected server error', 500);
  return ((data ?? []) as SeatRow[]).map((r) => ({ ...r, revision: IN_DB(r.revision) }));
}
async function loadSeatRow(roomId: string, seatId: string): Promise<SeatRow | null> {
  const { data, error } = await serviceDB().from('os_seats').select('player_id,body,revision').eq('room_id', roomId).eq('player_id', seatId).maybeSingle();
  if (error) throw new AppError('Unexpected server error', 500);
  return data ? { ...(data as SeatRow), revision: IN_DB((data as SeatRow).revision) } : null;
}

// ── commit ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export class Conflict extends Error { constructor(public current: number) { super(`os_revision_conflict:${current}`); } }
type CommitArgs = { actor: string; command: string; expected: number; action: string; payload?: Record<string, unknown>; state: OSState; effects?: RoomEffect[]; credits?: Credit[]; summary?: Record<string, unknown>; seat?: { playerId: string; body: Body } };
function resultsRows(s: OSState) {
  if (!s.finish) return [];
  return s.finish.standings.map((st) => {
    const t = s.teams.find((x) => x.id === st.teamId)!;
    return { teamKey: t.id, teamName: t.name, rank: st.rank, outcome: st.outcome, finishReason: s.finish!.reason, progress: st.progress, mastery: st.mastery, teamwork: st.teamwork, score: st.score, pointsSpent: st.spent, players: st.players,
      summary: { hits: st.hits, cleared: st.cleared, assists: st.assists, escaped: st.escaped, earned: t.earned, wasted: t.wasted, chaptersCleared: t.chaptersCleared, format: s.format } };
  });
}
export async function commit(roomId: string, a: CommitArgs): Promise<{ revision: number; replayed: boolean }> {
  const finished = a.state.phase === 'finished';
  const { data, error } = await serviceDB().rpc('os_commit', {
    p_room: roomId, p_actor: a.actor, p_command: a.command, p_expected: a.expected, p_action: a.action.slice(0, 40), p_payload: a.payload ?? {}, p_state: a.state,
    p_effects: a.effects ?? [], p_credits: a.credits ?? [], p_results: finished ? resultsRows(a.state) : [], p_finished: finished, p_summary: a.summary ?? {}, p_seat: a.seat ?? null,
  });
  if (error) {
    const m = /os_revision_conflict:(\d+)/.exec(error.message ?? '');
    if (m) throw new Conflict(Number(m[1]));
    if (/os_credit_conflict/.test(error.message ?? '')) throw new Conflict(-1);
    throw fromDbError(error);
  }
  return { revision: IN_DB((data as { revision: number }).revision), replayed: !!(data as { replayed: boolean }).replayed };
}
async function publish(roomId: string, revision: number, phase: string) {
  // Realtime is only a hint: clients always re-read the authoritative state, and poll if this never arrives.
  try {
    const ch = serviceDB().channel(`os:${roomId}`);
    await Promise.race([ch.send({ type: 'broadcast', event: 'rev', payload: { revision, phase } }), new Promise((r) => setTimeout(r, 400))]);
    void serviceDB().removeChannel(ch);
  } catch { /* polling covers it */ }
}

/** Seats idled to the final tick: the closing numbers never favour a device that happened to be ahead or behind. */
async function finalBodies(roomId: string, s: OSState): Promise<Record<string, Body>> {
  const idx = courseOf((await loadSession(roomId)).config); const rows = await loadSeatRows(roomId); const finalTick = s.freezeTick ?? s.clock.anchorTick; const out: Record<string, Body> = {};
  for (const seat of s.seats.filter((x) => !x.revoked)) {
    const row = rows.find((r) => r.player_id === seat.id); const body = row?.body ?? newBody(idx);
    out[seat.id] = idleTo(body, finalTick, ctxFor(s, seat, idx)).body;
  }
  return out;
}

/** Catch the match up to `now` and persist any change. Returns the current authoritative row. Safe to call from every request. */
export async function step(roomId: string, now = Date.now()): Promise<SessionRow> {
  let row = await loadSession(roomId);
  for (let attempt = 0; attempt < 3; attempt++) {
    const s = row.state;
    if (s.phase === 'finished' || s.phase === 'lobby' || s.paused) return row;
    const due = (s.phaseDeadlineMs !== null && now >= s.phaseDeadlineMs) || s.phase === 'barrier' || (s.phase === 'traversing' && s.freezeTick !== null && worldTick(s, now) >= s.freezeTick);
    if (!due) return row;
    const { pool, base } = await loadPool(roomId);
    const answers = s.phase === 'barrier' && s.barrier?.questionId ? await loadAnswers(roomId, s.barrier.questionId, base) : [];
    const bodies = endsMatchNext(s, now) ? await finalBodies(roomId, s) : undefined;
    const out = advance(s, { now, pool, answers, bodies, seedKey: row.seed });
    if (!out.changed) return row;
    try {
      const c = await commit(roomId, { actor: 'system', command: `system-advance-${row.revision}`, expected: row.revision, action: `advance:${out.state.phase}`, state: out.state, effects: out.effects, credits: out.credits, summary: { phase: out.state.phase, chapter: out.state.chapter } });
      if (c.replayed) { row = await loadSession(roomId); continue; }
      void publish(roomId, c.revision, out.state.phase);
      return { ...row, state: out.state, revision: c.revision, status: out.state.phase === 'finished' ? 'finished' : 'active' };
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
export async function preflight(input: { quizId: string; minutes: number; readAloud: boolean; lowPressure: boolean; allowReviewCycle: boolean; mapId: OSConfig['mapId'] }) {
  const kinds = await quizKinds(input.quizId); const idx = courseFor(input.mapId, 'preflight', input.lowPressure).idx;
  const plan = planMatch({ durationMinutes: input.minutes, readAloud: input.readAloud, lowPressure: input.lowPressure, allowReviewCycle: input.allowReviewCycle }, kinds, idx);
  const byKind: Record<string, number> = {}; for (const k of kinds) byKind[k] = (byKind[k] ?? 0) + 1;
  const usable = plan.reviewCycle ? plan.questionsNeeded : kinds.length;
  return { plan: { chapters: plan.chapters, chapterSeconds: Math.round((plan.chapterTicks * TICK_MS) / 1000), estimatedMinutes: plan.estimatedMinutes, questionsNeeded: plan.questionsNeeded, questionsAvailable: plan.questionsAvailable, reviewCycle: plan.reviewCycle, notes: plan.notes, minutes: plan.minutes }, questions: kinds.length, byKind, ok: usable >= MIN_CHAPTERS || kinds.length >= MIN_CHAPTERS };
}
export async function createOSRoom(input: unknown, user: { id: string }) {
  const v = osCreateSchema.parse(input);
  const names = (v.teamNames ?? DEFAULT_NAMES.slice(0, v.teamCount)).map((n) => n.normalize('NFKC').replace(/\s+/g, ' ').trim());
  if (new Set(names.map((n) => n.toLowerCase())).size !== names.length) throw new AppError('Squads need different names', 400);
  const pre = await preflight({ quizId: v.quizId, minutes: v.minutes, readAloud: v.readAloud, lowPressure: v.lowPressure, allowReviewCycle: v.allowReviewCycle, mapId: v.mapId as OSConfig['mapId'] });
  if (!pre.ok) throw new AppError('This quiz needs at least 3 questions for Obstacle Survival.', 400);
  const config: OSConfig = { schemaVersion: 1, format: v.format, mapId: v.mapId as OSConfig['mapId'], courseSeed: randomBytes(6).toString('hex'), durationMinutes: v.minutes, teamCount: v.teamCount, teamNames: names, teamSizeCap: v.teamSizeCap, lowPressure: v.lowPressure, readAloud: v.readAloud, hideNames: v.hideNames, approvalAbove: v.approvalAbove, allowReviewCycle: v.allowReviewCycle };
  const out = await createRoom({ quizId: v.quizId, mode: 'online', flow: 'synchronized', durationSeconds: v.minutes * 60 + GRACE_SECONDS * 2, questionSeconds: null, modifiers: [], slotLimit: 3, teamNames: [], lowPressure: v.lowPressure || undefined, readAloud: v.readAloud, untimed: true, access: v.requireApproval ? { requireApproval: true } : undefined }, user);
  const roomId = out.roomId;
  try {
    const room = await getRoom(roomId);
    const { error: upErr } = await serviceDB().from('rooms').update({ config: { ...room.config, hideSpeedBonus: true, os: { format: v.format, mapId: v.mapId } } }).eq('id', roomId);
    if (upErr) throw new AppError('Unexpected server error', 500);
    if (pre.plan.reviewCycle) await rpc('projector_add_repeat_cycle', { p_room: roomId, p_host: user.id, p_consent: true, p_count: Math.max(0, pre.plan.questionsNeeded - pre.questions) });
    const { pool } = await loadPool(roomId); const kinds = await quizKinds(v.quizId);
    const idx = courseOf(config); const plan = planMatch(config, kinds, idx);
    const state = createSession(config, plan, pool, TEAM_IDS.slice(0, v.teamCount), Date.now());
    await rpc('os_create_session', { p_room: roomId, p_host: user.id, p_format: v.format, p_config: config, p_seed: randomBytes(16).toString('hex'), p_state: state });
    return { roomId, joinCode: out.code, plan: pre.plan, hostUrl: `/quiz/os/${roomId}/host`, joinUrl: `/quiz/os/join?code=${out.code}` };
  } catch (e) { await serviceDB().from('rooms').delete().eq('id', roomId); throw e; }
}

// ── seats ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export const seatCookie = (roomId: string) => `qz_os_${roomId.replace(/-/g, '')}`;
export async function verifySeat(room: Pick<Room, 'id'>, token: string | undefined | null) {
  if (!token) throw new AppError('Join the room first', 401);
  const player = await verifyPlayer(room, token);
  const { data } = await serviceDB().from('players').select('status').eq('id', player.id).maybeSingle();
  const status = (data?.status as string | undefined) ?? 'active';
  if (status === 'removed' || status === 'banned') throw new AppError('The teacher removed this device from the match.', 403);
  return { player, status };
}
export async function joinOS(input: { joinCode: string; displayName: string; desiredTeam?: string }, bucket: string | null) {
  const nick = checkNickname(input.displayName);
  if (!nick.ok) throw new AppError(nick.message ?? 'Please choose a different name.', 400);
  const code = input.joinCode.toUpperCase();
  const { data: roomRow } = await serviceDB().from('rooms').select('id,config,status').eq('join_code', code).maybeSingle();
  if (!roomRow || !(roomRow.config as { os?: unknown })?.os || roomRow.status === 'ended') throw new AppError('This online room is not joinable', 400);
  const roomId = roomRow.id as string; const first = await loadSession(roomId);
  if (first.state.locked) throw new AppError('The teacher has closed this room to new players.', 403);
  const token = randomSecret();
  const v2 = await serviceDB().rpc('join_room_v2', { p_code: code, p_name: nick.name, p_hash: hashSecret(token), p_bucket: bucket });
  if (v2.error) throw fromDbError(v2.error);
  const joined = v2.data as { roomId: string; playerId: string; status?: string };
  const idx = courseOf(first.config);
  for (let attempt = 0; attempt < 4; attempt++) {
    const cur = await loadSession(roomId); const now = Date.now();
    const r = addSeat(cur.state, joined.playerId, nick.name, now, input.desiredTeam ?? null);
    if (!r.ok) { await discardUnseated(joined.playerId); throw new AppError(r.message, r.code === 'ROOM_FULL' || r.code === 'TEAM_FULL' ? 409 : 403); }
    // a late joiner starts at the start tile on the CURRENT tick: no replay, no free progress, no earned points
    const body = newBody(idx); body.tick = Math.max(0, worldTick(cur.state, now) - 1);
    try {
      await commit(roomId, { actor: joined.playerId, command: `join-${joined.playerId}`, expected: cur.revision, action: 'join', state: r.state, seat: { playerId: joined.playerId, body } });
      const seat = r.state.seats.find((x) => x.id === joined.playerId)!;
      return { roomId, seatId: joined.playerId, teamId: seat.teamId, status: joined.status ?? 'active', token };
    } catch (e) { if (e instanceof Conflict) continue; throw e; }
  }
  await discardUnseated(joined.playerId);
  throw new AppError('The room is busy — please try again.', 409);
}
async function discardUnseated(playerId: string) {
  try { const del = await serviceDB().from('players').delete().eq('id', playerId); if (del.error) await serviceDB().from('players').update({ status: 'removed' }).eq('id', playerId); } catch { /* the refusal is what the student needs to see */ }
}

// ── projections ────────────────────────────────────────────────────────────────────────────────────────────────────────────
export type Viewer = { view: 'student'; seatId: string } | { view: 'host' } | { view: 'projector' };
export type OSSnapshot = OSPublic & { revision: number; room: { id: string; code: string; status: string }; course: { mapId: string; courseSeed: string; lowPressure: boolean }; question: Record<string, unknown> | null; body: Body | null; tip: string | null; mine: number | null; award: number | null; perks?: Record<string, number> };
export const TIPS: Record<string, string> = {
  multiple_choice: 'Read every option before you pick. Cross out the ones that cannot be right.', truth_hunt: 'Judge each statement on its own: one false word makes it false.',
  answer_forge: 'Say the answer in a few words first, then check the spelling.', connection_rush: 'Start with the pair you are most sure about; the rest get easier.', fill_table: 'Fill the cells you know first, then use them to work out the rest.',
};
export async function snapshot(roomId: string, viewer: Viewer, now = Date.now()): Promise<OSSnapshot> {
  const row = await step(roomId, now); const room = await getRoom(roomId); const s = row.state;
  const rows = s.phase === 'lobby' ? [] : await loadSeatRows(roomId); const bodies = Object.fromEntries(rows.map((r) => [r.player_id, r.body]));
  let answered = new Set<string>(); let mine: number | null = null; let baseOf = 1;
  if (s.barrier?.questionId && ['barrier', 'reveal'].includes(s.phase)) {
    const { data } = await serviceDB().from('submissions').select('actor_id,base_awarded').eq('room_id', roomId).eq('room_question_id', s.barrier.questionId).eq('actor_type', 'player');
    answered = new Set((data ?? []).map((d) => d.actor_id as string));
    // a student's own result is private until the reveal: only their own row is ever read back to them
    if (viewer.view === 'student' && s.phase === 'reveal') { const row = (data ?? []).find((d) => d.actor_id === viewer.seatId); const q0 = await roomQuestion(room, s.barrier.position); baseOf = Math.max(1, Number(q0?.base_points) || 1); mine = row ? Math.max(0, Math.min(1000, Math.round((Number(row.base_awarded) / baseOf) * 1000))) : null; }
  }
  const pub = project(s, viewer.view, viewer.view === 'student' ? viewer.seatId : null, now, bodies, answered);
  let question: Record<string, unknown> | null = null; let tip: string | null = null;
  if (s.barrier && ['barrier', 'reveal'].includes(s.phase)) {
    const q = await roomQuestion(room, s.barrier.position);
    if (q) {
      question = publicQuestionView(q, { reveal: s.phase === 'reveal', hostPeek: viewer.view === 'host', seed: `${q.id}:${viewer.view === 'student' ? viewer.seatId : 'class'}` });
      if (pub.barrier?.help) tip = TIPS[q.kind] ?? null;
    }
  }
  const me = viewer.view === 'student' ? s.seats.find((x) => x.id === viewer.seatId) : null;
  const perks: Record<string, number> = {}; const award = me && s.phase === 'reveal' ? (s.teams.find((t) => t.id === me.teamId)?.barrierAwards.at(-1) ?? null) : null; if (me) for (const p of s.teams.find((t) => t.id === me.teamId)?.perks ?? []) perks[p] = (perks[p] ?? 0) + 1;
  return { ...pub, revision: row.revision, room: { id: room.id, code: room.join_code, status: room.status }, course: { mapId: row.config.mapId, courseSeed: row.config.courseSeed, lowPressure: row.config.lowPressure }, question, body: me ? bodies[me.id] ?? null : null, tip, mine, award, ...(me ? { perks } : {}) };
}
export async function touch(roomId: string, who: { seatId?: string; host?: boolean }) {
  try { await serviceDB().rpc('os_touch', { p_room: roomId, p_player: who.seatId ?? null, p_host: !!who.host }); } catch { /* presence is best effort */ }
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
    try {
      const c = await commit(roomId, { actor: seatId, command: commandId, expected: row.revision, action: `seat:${action.kind}`, payload: action as unknown as Record<string, unknown>, state: r.state });
      if (!c.replayed) void publish(roomId, c.revision, r.state.phase);
      return { ok: true, revision: c.revision, replayed: c.replayed, note: r.note };
    } catch (e) { if (e instanceof Conflict) continue; throw e; }
  }
  throw new AppError('The shop is busy — please try again.', 409);
}
export async function hostCommand(roomId: string, commandId: string, action: HostAction): Promise<CommandOutcome> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const row = await step(roomId); const { result, effects } = reduceHost(row.state, action, Date.now());
    if (!result.ok) return { ok: false, code: result.code, message: result.message, currentRevision: row.revision };
    let state = result.state;
    if (action.kind === 'end') { state = await settleEnd(roomId, state, row.seed); }
    try {
      const c = await commit(roomId, { actor: 'host', command: commandId, expected: row.revision, action: `host:${action.kind}`, payload: action as unknown as Record<string, unknown>, state, effects });
      if (!c.replayed) void publish(roomId, c.revision, state.phase);
      return { ok: true, revision: c.revision, replayed: c.replayed };
    } catch (e) { if (e instanceof Conflict) continue; throw e; }
  }
  throw new AppError('The match is busy — please try again.', 409);
}
/** The teacher ended the match early: results are computed from the bodies as they are, so nothing is made up. */
async function settleEnd(roomId: string, state: OSState, seed: string): Promise<OSState> {
  const { standingsOf } = await import('./score'); const rows = await loadSeatRows(roomId); const bodies = Object.fromEntries(rows.map((r) => [r.player_id, r.body]));
  const next = JSON.parse(JSON.stringify(state)) as OSState;
  next.finish = { reason: 'host_ended', at: Date.now(), standings: standingsOf(next, bodies, next.plan.totalDist, seed) }; return next;
}

export type InputOutcome = { ok: true; replayed: boolean; tick: number; accepted: number; denied: { hop: number; ability: number }; hits: number; revision: number } | { ok: false; code: string; message: string; tick?: number; status: number };
const STATUS: Record<string, number> = { OLD_TICK: 409, TICK_GAP: 409, FUTURE_TICK: 409, FROZEN: 409, PAUSED: 409, BATCH_SIZE: 400, INPUT_INVALID: 400, TICK_INVALID: 400, SEAT_REVOKED: 403 };
/** One student's input batch. The body can only move forward along the deterministic physics, exactly where it stopped, and never past the server clock. */
export async function submitInput(roomId: string, seatId: string, batch: { commandId: string; fromTick: number; samples: unknown[] }): Promise<InputOutcome> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const sess = await step(roomId); const s = sess.state; const now = Date.now();
    const prior = await serviceDB().from('os_input_batches').select('to_tick,seat_revision').eq('room_id', roomId).eq('seat_id', seatId).eq('command_id', batch.commandId).maybeSingle();
    if (prior.data) return { ok: true, replayed: true, tick: IN_DB(prior.data.to_tick), accepted: 0, denied: { hop: 0, ability: 0 }, hits: 0, revision: sess.revision };
    const seat = s.seats.find((x) => x.id === seatId);
    if (!seat || seat.revoked) return { ok: false, code: 'SEAT_REVOKED', message: 'The teacher removed this device from the match.', status: 403 };
    if (s.paused) return { ok: false, code: 'PAUSED', message: 'The game is paused.', status: 409 };
    if (s.phase !== 'traversing') return { ok: false, code: 'FROZEN', message: 'The world is frozen right now.', status: 409 };
    const row = await loadSeatRow(roomId, seatId); if (!row) return { ok: false, code: 'SEAT_REVOKED', message: 'Join the room first.', status: 403 };
    const idx = courseOf(sess.config); const ctx = ctxFor(s, seat, idx); let body = row.body; const wt = worldTick(s, now);
    // a seat that fell far behind the clock (closed laptop, long network loss) is idled forward, deterministically, instead of replaying minutes of history
    if (body.tick + 1 < wt - MAX_LAG_TICKS) body = idleTo(body, wt - MAX_LAG_TICKS, ctx).body;
    const r = applyBatch(body, batch.fromTick, batch.samples, ctx, maxSeatTick(s, now, MAX_AHEAD_TICKS));
    if (!r.ok) return { ok: false, code: r.code, message: r.message, tick: body.tick, status: STATUS[r.code] ?? 400 };
    const { body: nb, out } = r.state; const effects = out.effects;
    const nextState = effects.length ? addTeamEffects(s, seatId, effects, wt) : null;
    const digest = createHash('sha256').update(JSON.stringify([batch.fromTick, batch.samples])).digest('hex').slice(0, 32);
    const { data, error } = await serviceDB().rpc('os_input', { p_room: roomId, p_seat: seatId, p_command: batch.commandId, p_seat_rev: row.revision, p_body: nb, p_from: batch.fromTick, p_to: nb.tick, p_digest: digest, p_session_rev: nextState ? sess.revision : null, p_state: nextState, p_summary: nextState ? { effects: effects.map((e) => e.kind) } : {} });
    if (error) {
      const m = /os_(seat|revision|tick)_conflict:(\d+)/.exec(error.message ?? '');
      if (m) { if (attempt === 3) return { ok: false, code: 'BUSY', message: 'Busy — try again.', status: 409 }; continue; }
      throw fromDbError(error);
    }
    const d = data as { replayed: boolean; toTick: number; revision?: number };
    return { ok: true, replayed: !!d.replayed, tick: IN_DB(d.toTick), accepted: batch.samples.length, denied: out.denied, hits: nb.hits, revision: IN_DB(d.revision ?? sess.revision) };
  }
  return { ok: false, code: 'BUSY', message: 'Busy — try again.', status: 409 };
}

/** A student's barrier answer. Only while the class question is open, only for a seat that was on the roster when it opened, never trusting a client grade. */
export async function answer(roomId: string, token: string, seatId: string, input: { roomQuestionId: string; response: unknown }) {
  const row = await step(roomId); const s = row.state; const seat = s.seats.find((x) => x.id === seatId);
  if (!seat || seat.revoked) throw new AppError('The teacher removed this device from the match.', 403);
  if (s.phase === 'finished') throw new AppError('The match is over.', 409);
  if (s.paused) throw new AppError('The game is paused.', 409);
  const b = s.barrier;
  if (s.phase !== 'barrier' || !b || b.questionId !== input.roomQuestionId) throw new AppError('That question is closed.', 409);
  if (Date.now() > b.deadlineMs + 1500) throw new AppError('That question is closed.', 409);
  if (!(b.eligible[seat.teamId] ?? []).includes(seatId)) throw new AppError('You joined after this question opened — the next one is yours.', 409);
  await submitAnswer({ roomId, roomQuestionId: input.roomQuestionId, token, response: input.response, wager: 0 }, { allowOS: true });
  void step(roomId).catch(() => undefined); // may close the question early when everyone has answered
  return { accepted: true, private: true };
}

// ── projector link, results ────────────────────────────────────────────────────────────────────────────────────────────────
export async function makeSpectatorLink(roomId: string, hostId: string) {
  const token = randomSecret(); await rpc('os_set_spectator', { p_room: roomId, p_host: hostId, p_hash: createHash('sha256').update(token).digest('hex') });
  return { token, url: `/quiz/os/${roomId}/screen#k=${token}` };
}
export async function verifySpectator(roomId: string, token: string | null) {
  if (!token || token.length > 120) throw new AppError('This projector link is not valid', 403);
  const row = await loadSession(roomId);
  if (!row.spectator_hash || row.spectator_hash !== createHash('sha256').update(token).digest('hex')) throw new AppError('This projector link is not valid', 403);
}
export async function results(roomId: string) { const { data } = await serviceDB().from('os_results').select('*').eq('room_id', roomId).order('rank'); return data ?? []; }
/** Learning report: per question, how the class did (counts only, no names for the class), plus the explanation once the match is over. */
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
  const { data } = await serviceDB().from('os_events').select('revision,actor_key,action,summary,created_at').eq('room_id', roomId).order('revision').limit(500);
  return (data ?? []).filter((e) => Number(e.revision) > after).map((e) => ({ revision: Number(e.revision), actor: e.actor_key === 'host' || e.actor_key === 'system' ? e.actor_key : 'player', action: e.action, summary: e.summary, at: e.created_at }));
}
export { RULES_VERSION };
