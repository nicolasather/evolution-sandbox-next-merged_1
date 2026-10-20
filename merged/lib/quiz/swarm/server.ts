import 'server-only';
import { randomInt } from 'node:crypto';
import { serviceDB } from '../supabase';
import { AppError } from '../errors';
import { code as roomCode, createRoom, getRoom } from '../rooms';
import { rpc } from '../api';
import { signToken, verifyToken, newSubject } from '@/lib/swarm/net/tokens';
import { checkSecret, isProductionRuntime, parseWorkerHttpOrigin, workerWsUrl, WorkerUrlError } from '@/lib/swarm/config';
import { PROTOCOL } from '@/lib/swarm/domain';
import { planSession } from '@/lib/swarm/plan';
import type { Config } from '@/lib/swarm/domain';
import { swarmCreateSchema, swarmPreflightSchema } from './validation';
import { publicQuestionView, type StoredQuestion } from '../public';
import { z } from 'zod';

export const HOST_TOKEN_TTL = 8 * 3600;
/** Worker coordinates. The secret is shared with the worker (swarm-server) and never leaves the server.
 *  SW-01: the address is a validated https ORIGIN (never wss://); SW-02: the same secret minimum as the worker. */
export type WorkerHealth = { status: 'ok' | 'unconfigured' | 'misconfigured' | 'offline' | 'unhealthy' | 'protocol_mismatch'; message: string };
export function swarmEnv() {
  const secretRaw = process.env.SWARM_SECRET?.trim(); const urlRaw = (process.env.NEXT_PUBLIC_SWARM_URL ?? process.env.SWARM_URL)?.trim();
  const problems: string[] = []; let url: string | undefined; let secret: string | undefined;
  if (urlRaw) { try { url = parseWorkerHttpOrigin(urlRaw); } catch (e) { problems.push(e instanceof WorkerUrlError ? e.message : 'The game server address is invalid.'); } }
  if (secretRaw) { const c = checkSecret(secretRaw, { production: isProductionRuntime() }); if (c.ok) secret = secretRaw; else problems.push(c.message); }
  return { secret, url, problems, present: !!(secretRaw || urlRaw) };
}
export function requireSwarm() {
  const e = swarmEnv();
  if (e.problems.length) throw new AppError(`Swarm Survival's game server is misconfigured: ${e.problems.join(' ')} Ask the site owner (see swarm-server/README.md).`, 503);
  if (!e.secret || !e.url) throw new AppError('Swarm Survival needs its game server. Ask the site owner to deploy it (see swarm-server/README.md) and set NEXT_PUBLIC_SWARM_URL and SWARM_SECRET.', 503);
  return { secret: e.secret, url: e.url };
}
const wsUrlOf = workerWsUrl; export { wsUrlOf };

/** SW-08: is the worker actually answering, and does it speak the protocol this app expects? Bounded (2.5 s) and cached for a few seconds,
 *  so the preflight (which the setup page repeats while a teacher edits options) never hammers the worker. Never throws; never returns raw errors. */
const HEALTH_TTL_MS = 5000; const healthCache = new Map<string, { at: number; value: WorkerHealth }>();
export async function workerHealth(fetchImpl: typeof fetch = fetch, now: () => number = Date.now): Promise<WorkerHealth> {
  const e = swarmEnv();
  if (e.problems.length) return { status: 'misconfigured', message: 'The game server settings on this site are invalid. Ask the site owner.' };
  if (!e.secret || !e.url) return { status: 'unconfigured', message: 'The game server is not set up on this site yet.' };
  const hit = healthCache.get(e.url); if (hit && now() - hit.at < HEALTH_TTL_MS) return hit.value;
  let value: WorkerHealth;
  try {
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 2500);
    try {
      const res = await fetchImpl(`${e.url}/healthz`, { signal: ctl.signal, cache: 'no-store', headers: { accept: 'application/json' } });
      if (!res.ok) value = { status: 'unhealthy', message: 'The game server answered with an error. Try again in a minute.' };
      else {
        const j = (await res.json().catch(() => null)) as { ok?: unknown; protocol?: unknown } | null;
        if (!j || j.ok !== true) value = { status: 'unhealthy', message: 'The game server is not ready yet. Try again in a minute.' };
        else if (j.protocol !== PROTOCOL) value = { status: 'protocol_mismatch', message: 'The game server is running a different version than this site. Ask the site owner to redeploy it.' };
        else value = { status: 'ok', message: 'The game server is online.' };
      }
    } finally { clearTimeout(timer); }
  } catch { value = { status: 'offline', message: 'The game server cannot be reached right now. Practice mode still works; try again shortly.' }; }
  healthCache.set(e.url, { at: now(), value }); return value;
}
/** Migration 008 present? A harmless zero-row read. */
export async function swarmSchemaReady(): Promise<boolean> {
  const { error } = await serviceDB().from('swarm_sessions').select('room_id').limit(1);
  return !error;
}

async function quizKinds(quizId: string): Promise<string[]> {
  const { data, error } = await serviceDB().from('quiz_questions').select('kind,position').eq('quiz_id', quizId).order('position');
  if (error) throw new AppError('Unexpected server error', 500);
  return (data ?? []).map((q) => q.kind as string);
}
/** What a session would contain for this quiz. Never invents questions: a short quiz gives a shorter session and says so. */
export async function swarmPreflight(input: unknown) {
  const v = swarmPreflightSchema.parse(input); const kinds = await quizKinds(v.quizId);
  const plan = planSession({ minutes: v.minutes, poolSize: kinds.length, focus: v.focus, difficulty: v.difficulty, allowReviewCycle: v.allowReviewCycle });
  const byKind: Record<string, number> = {}; for (const k of kinds) byKind[k] = (byKind[k] ?? 0) + 1;
  const worker = swarmEnv(); const health = await workerHealth(); const schemaReady = health.status === 'ok' ? await swarmSchemaReady() : null;
  return { ok: kinds.length >= 3, questions: kinds.length, byKind, plan: { waves: plan.waves.length, questionsTotal: plan.questionsTotal, drafts: plan.drafts, bosses: plan.waves.filter((w) => w.boss).map((w) => w.boss!.kind), estimateSeconds: plan.estimateSeconds, warnings: plan.warnings, reviewCycle: plan.reviewCycle }, workerConfigured: !!(worker.secret && worker.url && !worker.problems.length), worker: health, schemaReady, request: v };
}

/** `deps` exists so tests can stand in for the network/DB probes; production callers never pass it. */
export async function createSwarmRoom(input: unknown, user: { id: string }, deps: { health?: () => Promise<WorkerHealth>; schemaReady?: () => Promise<boolean> } = {}) {
  const { secret, url } = requireSwarm();
  const health = await (deps.health ?? workerHealth)(); if (health.status !== 'ok') throw new AppError(health.message, 503);
  if (!(await (deps.schemaReady ?? swarmSchemaReady)())) throw new AppError('Swarm Survival is not installed in the database yet (migration 008). Ask the site owner.', 503);
  const v = swarmCreateSchema.parse(input); const config: Config = v.config;
  const kinds = await quizKinds(v.quizId); if (kinds.length < 3) throw new AppError('This quiz needs at least 3 questions for Swarm Survival.', 400);
  const names = config.teamNames; if (names && new Set(names.map((n) => n.toLowerCase())).size !== names.length) throw new AppError('Teams need different names', 400);
  const out = await createRoom({ quizId: v.quizId, mode: 'online', flow: 'synchronized', durationSeconds: config.minutes * 60 + 600, questionSeconds: null, modifiers: [], slotLimit: 3, teamNames: [], lowPressure: config.lowPressure || undefined, untimed: true }, user);
  const roomId = out.roomId;
  try {
    const room = await getRoom(roomId);
    const { error } = await serviceDB().from('rooms').update({ config: { ...room.config, hideSpeedBonus: true, swarm: { mode: config.mode, mapId: config.mapId } } }).eq('id', roomId);
    if (error) throw new AppError('Unexpected server error', 500);
    await rpc('swarm_create_session', { p_room: roomId, p_host: user.id, p_config: config, p_seed: randomInt(1, 2 ** 31 - 1) });
    return { roomId, joinCode: out.code, hostUrl: `/quiz/swarm/${roomId}/host`, joinUrl: `/quiz/swarm/join?code=${out.code}`, workerUrl: url, hostToken: signToken({ typ: 'host', room: roomId, sub: 'host', ttlSec: HOST_TOKEN_TTL }, secret) };
  } catch (e) { await serviceDB().from('rooms').delete().eq('id', roomId); throw e; }
}

/** The signed host session for a room the signed-in user owns. Called by the host console on load and on every reconnect. */
export async function mintHostTokens(roomId: string, hostId: string) {
  const { secret, url } = requireSwarm(); const room = await getRoom(roomId);
  if (!(room.config as { swarm?: unknown }).swarm) throw new AppError('Swarm Survival room not found', 404);
  if (room.host_id !== hostId) throw new AppError('Only the room host can perform this action', 403);
  return { workerUrl: url, wsUrl: wsUrlOf(url), joinCode: room.join_code, hostToken: signToken({ typ: 'host', room: roomId, sub: 'host', ttlSec: HOST_TOKEN_TTL }, secret), screenToken: signToken({ typ: 'screen', room: roomId, sub: `screen-${newSubject().slice(0, 8)}`, ttlSec: HOST_TOKEN_TTL }, secret) };
}

type Q = { id: string; position: number; kind: string; prompt: string; payload: Record<string, unknown>; answer_key: Record<string, unknown>; base_points: number };
async function questionsOf(roomId: string): Promise<Q[]> {
  const { data, error } = await serviceDB().from('room_questions').select('id,position,kind,prompt,payload,answer_key,base_points').eq('room_id', roomId).order('position');
  if (error) throw new AppError('Unexpected server error', 500); return (data ?? []) as Q[];
}
async function sessionOf(roomId: string) {
  const { data, error } = await serviceDB().from('swarm_sessions').select('room_id,host_id,status,config').eq('room_id', roomId).maybeSingle();
  if (error) throw new AppError('Unexpected server error', 500); if (!data) throw new AppError('Swarm Survival room not found', 404); return data as { room_id: string; host_id: string; status: string; config: Config };
}

export type SwarmReport = Awaited<ReturnType<typeof swarmReport>>;
/** Teacher summary, built only from rows the worker committed (graded answers, credits, purchases, results). Host-only. */
export async function swarmReport(roomId: string, hostId: string) {
  const s = await sessionOf(roomId); if (s.host_id !== hostId) throw new AppError('Only the room host can perform this action', 403);
  const db = serviceDB();
  const [answers, credits, purchases, people, results] = await Promise.all([
    db.from('swarm_answers').select('window_id,participant_id,question_id,fraction,correct').eq('room_id', roomId),
    db.from('swarm_credits').select('window_id,team_id,amount,eligible').eq('room_id', roomId),
    db.from('swarm_purchases').select('draft_id,team_id,upgrade,cost,how').eq('room_id', roomId),
    db.from('swarm_participants').select('participant_id,display_name,team_id,role').eq('room_id', roomId),
    db.from('swarm_results').select('outcome,reason,standings,created_at').eq('room_id', roomId).maybeSingle(),
  ]);
  for (const r of [answers, credits, purchases, people, results]) if (r.error) throw new AppError('Unexpected server error', 500);
  const qs = await questionsOf(roomId); const byId = new Map(qs.map((q) => [q.id, q]));
  const per = new Map<string, { id: string; prompt: string; kind: string; n: number; correct: number; frac: number }>();
  for (const a of (answers.data ?? []) as { question_id: string; fraction: string | number; correct: boolean }[]) {
    const q = byId.get(a.question_id); if (!q) continue; const e = per.get(q.id) ?? { id: q.id, prompt: q.prompt, kind: q.kind, n: 0, correct: 0, frac: 0 }; e.n++; e.correct += a.correct ? 1 : 0; e.frac += Number(a.fraction); per.set(q.id, e);
  }
  const questions = [...per.values()].map((e) => ({ id: e.id, prompt: e.prompt, kind: e.kind, answers: e.n, accuracyPct: Math.round((100 * e.frac) / Math.max(1, e.n)) })).sort((a, b) => a.accuracyPct - b.accuracyPct);
  const pp = new Map<string, { n: number; frac: number }>();
  for (const a of (answers.data ?? []) as { participant_id: string; fraction: string | number }[]) { const e = pp.get(a.participant_id) ?? { n: 0, frac: 0 }; e.n++; e.frac += Number(a.fraction); pp.set(a.participant_id, e); }
  const players = ((people.data ?? []) as { participant_id: string; display_name: string; team_id: string; role: string }[]).map((p) => ({ name: p.display_name, team: p.team_id, role: p.role, answered: pp.get(p.participant_id)?.n ?? 0, accuracyPct: pp.get(p.participant_id)?.n ? Math.round((100 * pp.get(p.participant_id)!.frac) / pp.get(p.participant_id)!.n) : null }));
  const teamEarned: Record<string, number> = {}; for (const c of (credits.data ?? []) as { team_id: string; amount: number }[]) teamEarned[c.team_id] = (teamEarned[c.team_id] ?? 0) + Number(c.amount);
  return {
    status: s.status, mode: s.config.mode, results: results.data ? { outcome: (results.data as { outcome: string }).outcome, reason: (results.data as { reason: string }).reason, standings: (results.data as { standings: unknown }).standings } : null,
    questions, weakest: questions.slice(0, 5), players, teamEarned, purchases: (purchases.data ?? []) as unknown[],
    note: questions.length === 0 ? 'No graded answers were recorded for this match.' : undefined,
  };
}

const reviewToken = z.string().min(10).max(600);
/** A student's own review after the match: their answers, whether each was right, and the explanation. Only after the session has finished. */
export async function swarmReview(roomId: string, token: unknown) {
  const { secret } = requireSwarm(); const t = reviewToken.parse(token);
  const v = verifyToken(t, secret, { room: roomId, typ: 'player' }); if (!v.ok) throw new AppError('Your session expired. Ask your teacher for the summary.', 401);
  const s = await sessionOf(roomId); if (s.status === 'active') throw new AppError('The review opens when the match ends.', 409);
  const db = serviceDB();
  const { data, error } = await db.from('swarm_answers').select('window_id,question_id,response,fraction,correct').eq('room_id', roomId).eq('participant_id', v.claims.sub);
  if (error) throw new AppError('Unexpected server error', 500);
  const qs = new Map((await questionsOf(roomId)).map((q) => [q.id, q]));
  const items = ((data ?? []) as { window_id: string; question_id: string; response: unknown; fraction: string | number; correct: boolean }[]).map((a) => {
    const q = qs.get(a.question_id); if (!q) return null;
    const row: StoredQuestion = { id: q.id, position: q.position, kind: q.kind, prompt: q.prompt, payload: q.payload, answer_key: q.answer_key, base_points: q.base_points };
    return { window: a.window_id, question: publicQuestionView(row, { reveal: true, seed: `${roomId}:${a.window_id}` }), mine: { response: a.response, correct: a.correct, fraction: Number(a.fraction) } };
  }).filter(Boolean).sort((a, b) => Number(a!.window.slice(1)) - Number(b!.window.slice(1)));
  return { items, total: items.length, correct: items.filter((i) => i!.mine.correct).length };
}
export { roomCode };
