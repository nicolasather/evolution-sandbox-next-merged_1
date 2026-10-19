import 'server-only';
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { serviceDB, currentUser } from './supabase';
import { assertCompatible } from './compatibility';
import { roomCreateSchema } from './validation';
import { publicPayload, publicQuestionView } from './public';
import { AppError } from './errors';
import { applyQuietClassroom } from './learning';
import { rpc } from './api';
import type { Room, Question, GameConfig } from './types';

export function hashSecret(s: string) { return createHash('sha256').update(s).digest('hex'); }
export function randomSecret() { return randomBytes(32).toString('base64url'); }
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
export function code() {
  let out = '';
  for (let i = 0; i < 6; i++) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return out;
}

export async function getRoom(id: string): Promise<Room> {
  const { data, error } = await serviceDB().from('rooms').select('*').eq('id', id).maybeSingle();
  if (error) throw new AppError('Unexpected server error', 500);
  if (!data) throw new AppError('Room not found', 404);
  return data as Room;
}

/** Step-1 helper: the signed-in user must be the room's host. */
export async function isHost(roomId: string) {
  const user = await currentUser();
  const room = await getRoom(roomId);
  if (!room.host_id || room.host_id !== user.id) throw new AppError('Only the room host can perform this action', 403);
  return { room, user };
}

export type PlayerRow = { id: string; room_id: string; points: number; cursor_index: number; question_opened_at: string | null; display_name: string };
export async function verifyPlayer(room: Pick<Room, 'id'>, token: string): Promise<PlayerRow> {
  if (!token || token.length > 160) throw new AppError('Player token required', 403);
  const { data, error } = await serviceDB()
    .from('players')
    .select('id,room_id,points,cursor_index,question_opened_at,display_name')
    .eq('secret_hash', hashSecret(token))
    .eq('room_id', room.id)
    .maybeSingle();
  if (error) throw new AppError('Unexpected server error', 500);
  if (!data) throw new AppError('Invalid player token', 403);
  return data as PlayerRow;
}

export async function createRoom(input: unknown, user: { id: string } | null) {
  const v = roomCreateSchema.parse(input);
  assertCompatible(v.mode, v.flow, v.modifiers);
  if (v.mode !== 'solo' && !user) throw new AppError('Sign in required', 401);
  const teamNames = v.mode === 'classroom' ? v.teamNames : [];
  if (v.mode === 'classroom' && (teamNames.length < 2 || new Set(teamNames.map((x) => x.toLowerCase())).size !== teamNames.length)) {
    throw new AppError('Classroom needs 2–8 teams with different names', 400);
  }
  // Quiet Classroom turns off theft-style modifiers and potluck; the questions themselves are untouched (087).
  const modifiers = v.quietClassroom ? applyQuietClassroom(v.modifiers) : v.modifiers;
  const config: GameConfig = {
    durationSeconds: v.durationSeconds, questionSeconds: v.untimed ? null : v.questionSeconds, modifiers, slotLimit: v.slotLimit, teamNames,
    ...(v.lowPressure ? { lowPressure: true, hideSpeedBonus: true } : {}), ...(v.quietClassroom ? { quietClassroom: true } : {}), ...(v.untimed ? { untimed: true } : {}),
    ...(v.readAloud ? { readAloud: true } : {}), ...(v.fairPlay ? { fairPlay: true } : {}), ...(v.rotateSpeaker ? { rotateSpeaker: true } : {}),
    ...(v.showIdentity === false ? { showIdentity: false } : {}), ...(v.cosmeticsEnabled === false ? { cosmeticsEnabled: false } : {}),
    ...(v.access ? { access: v.access } : {}),
  };
  const token = v.mode === 'solo' ? randomSecret() : undefined;
  for (let attempt = 0; attempt < 8; attempt++) {
    const joinCode = code();
    try {
      const out = await rpc<{ roomId: string; code: string }>('create_room_with_content', {
        p_host: user?.id ?? null, p_quiz: v.quizId, p_mode: v.mode, p_flow: v.flow, p_config: config,
        p_code: joinCode, p_teams: teamNames, p_player_hash: token ? hashSecret(token) : null,
      });
      if (v.shuffleQuestions) await shuffleRoomQuestions(out.roomId, `${out.roomId}:${Date.now()}`);
      return { roomId: out.roomId, code: out.code, token };
    } catch (e) {
      if (e instanceof AppError && e.status === 409) continue; // join code collision → try another
      throw e;
    }
  }
  throw new AppError('Unable to allocate a unique room code', 500);
}

type RoomQuestionRow = { id: string; position: number; kind: string; prompt: string; payload: Record<string, unknown>; answer_key: Record<string, unknown>; base_points: number };

export async function roomQuestion(room: Pick<Room, 'id'>, position: number) {
  const { data, error } = await serviceDB().from('room_questions').select('*').eq('room_id', room.id).eq('position', position).maybeSingle();
  if (error) throw new AppError('Unexpected server error', 500);
  return data as RoomQuestionRow | null;
}

export function questionToGrader(q: RoomQuestionRow): Question {
  return { kind: q.kind as Question['kind'], prompt: q.prompt, payload: q.payload, answerKey: q.answer_key, basePoints: q.base_points };
}

export type Viewer = { role: 'host' } | { role: 'player'; playerId: string };

/** Everything the lobby, projector and player screens need — and nothing they must not see before reveal. */
export async function roomPublicState(room: Room, viewer: Viewer, opts: { peek?: boolean } = {}) {
  const db = serviceDB();
  // `status` and `identity` come from migration 004; fall back to the original columns when it has not been applied.
  const loadPlayers = async () => {
    const rich = await db.from('players').select('id,display_name,points,cursor_index,question_opened_at,status,identity').eq('room_id', room.id).order('joined_at');
    if (!rich.error) return rich;
    return db.from('players').select('id,display_name,points,cursor_index,question_opened_at').eq('room_id', room.id).order('joined_at');
  };
  const [countRes, teamsRes, playersRes] = await Promise.all([
    db.from('room_questions').select('id', { count: 'exact', head: true }).eq('room_id', room.id),
    db.from('teams').select('id,display_name,order_index,points').eq('room_id', room.id).order('order_index'),
    loadPlayers(),
  ]);
  if (countRes.error || teamsRes.error || playersRes.error) throw new AppError('Could not load room state', 500);
  const total = countRes.count ?? 0;
  type P = { id: string; display_name: string; points: number; cursor_index: number; question_opened_at: string | null; status?: string; identity?: Record<string, unknown> };
  const players = (playersRes.data ?? []) as unknown as P[];
  const statusOf = (p: P) => p.status ?? 'active';
  const self = viewer.role === 'player' ? players.find((p) => p.id === viewer.playerId) : undefined;
  const independent = room.flow === 'independent';
  const cursor = independent && self ? self.cursor_index : room.current_index;
  const opened = independent && self ? self.question_opened_at : room.round_opened_at;
  const ended = room.status === 'ended';
  const reveal = room.revealed || ended;
  const finished = cursor >= total;

  let question: Record<string, unknown> | null = null;
  let answered: { actor_id: string; actor_type: string; correct: boolean }[] = [];
  let aggregate: { counts: Record<string, number>; total: number } | null = null;
  const showQuestion = room.status === 'active' || ended || viewer.role === 'host';
  if (showQuestion && !finished) {
    const row = await roomQuestion(room, cursor);
    if (row) {
      const mayKey = reveal || (viewer.role === 'host' && opts.peek === true);
      question = publicQuestionView(row, { reveal: mayKey, seed: `${row.id}:${self?.id ?? 'host'}` });
      const sub = await db.from('submissions').select('actor_id,actor_type,correct,response').eq('room_question_id', row.id);
      answered = (sub.data ?? []) as typeof answered;
      if (reveal && row.kind === 'multiple_choice') {
        // anonymous aggregate: how many chose each option — never who (item 089)
        const counts: Record<string, number> = {};
        for (const a of sub.data ?? []) for (const id of ((a.response as { selectedIds?: string[] })?.selectedIds ?? [])) counts[id] = (counts[id] ?? 0) + 1;
        aggregate = { counts, total: (sub.data ?? []).length };
      }
    }
  }
  // A hidden question is not even listed to players who have not started yet.
  if (viewer.role === 'player' && room.status === 'waiting') question = null;

  let lastResult: { correct: boolean; awarded: number; wager: number; timeout: boolean } | null = null;
  if (self) {
    const { data } = await db.from('submissions').select('correct,base_awarded,wager,response').eq('actor_id', self.id).order('submitted_at', { ascending: false }).limit(1);
    const s = data?.[0];
    if (s) lastResult = { correct: s.correct, awarded: s.base_awarded, wager: s.wager, timeout: (s.response as { kind?: string })?.kind === 'timeout' };
  }

  let review: unknown[] | null = null;
  let mine: Record<string, { response: unknown; correct: boolean; awarded: number }> | null = null;
  if (ended && self) {
    const { data } = await db.from('submissions').select('room_question_id,response,correct,base_awarded').eq('actor_id', self.id);
    mine = Object.fromEntries((data ?? []).map((r) => [r.room_question_id as string, { response: r.response, correct: r.correct as boolean, awarded: r.base_awarded as number }]));
  }
  if (ended) {
    const { data } = await db.from('room_questions').select('id,position,kind,prompt,payload,answer_key').eq('room_id', room.id).order('position');
    review = (data ?? []).map((r) => ({ id: r.id, position: r.position, kind: r.kind, prompt: r.prompt, payload: publicPayload(r.kind, r.payload, `${r.id}:${self?.id ?? 'host'}`), answerKey: r.answer_key, mine: mine?.[r.id] ?? null }));
  }

  return {
    id: room.id, code: room.join_code, mode: room.mode, flow: room.flow, status: room.status,
    paused: !!room.paused_at, config: room.config,
    currentIndex: cursor, turnIndex: room.turn_index, startedAt: room.started_at, expiresAt: room.expires_at,
    questionOpenedAt: opened, pausedAt: room.paused_at, serverNow: new Date().toISOString(),
    revealed: reveal, questionCount: total, finished,
    selfId: self?.id ?? null,
    question,
    teams: teamsRes.data ?? [],
    // removed and banned players disappear for everyone; players awaiting approval are visible to the host only
    players: players.filter((p) => ['active'].includes(statusOf(p)) || p.id === self?.id).map((p) => ({ id: p.id, display_name: p.display_name, points: p.points, cursor_index: p.cursor_index, identity: room.config?.access?.hideIdentity ? {} : (p.identity ?? {}) })),
    pendingPlayers: viewer.role === 'host' ? players.filter((p) => statusOf(p) === 'pending').map((p) => ({ id: p.id, display_name: p.display_name })) : [],
    selfStatus: self ? statusOf(self) : null,
    aggregate,
    answeredActors: answered.map((a) => a.actor_id),
    results: viewer.role === 'host' ? answered : [],
    lastResult,
    stealActive: room.steal_active, stealTarget: room.steal_target_id,
    review,
  };
}


/** A new random question order for a room that has not started (fast replay, item 090). Positions are swapped in two passes because they are unique. */
export async function shuffleRoomQuestions(roomId: string, seed: string) {
  const db = serviceDB();
  const { data, error } = await db.from('room_questions').select('id,position').eq('room_id', roomId).order('position');
  if (error || !data) throw new AppError('Could not reorder the questions', 500);
  const ids = data.map((r) => r.id as string);
  const order = seededOrder(ids, seed);
  for (let i = 0; i < data.length; i++) await db.from('room_questions').update({ position: 10_000 + i }).eq('id', ids[i]!);
  for (let i = 0; i < order.length; i++) await db.from('room_questions').update({ position: i }).eq('id', order[i]!);
}
function seededOrder<T>(items: T[], seed: string): T[] {
  let h = 2166136261; for (const c of seed) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  const rand = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1_000_000) / 1_000_000; };
  const a = [...items]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}
