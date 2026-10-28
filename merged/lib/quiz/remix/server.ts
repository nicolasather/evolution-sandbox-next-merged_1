/**
 * Server-side Remix game engine. Stateless between requests: all progress lives in an HMAC-signed token that is
 * re-signed after every graded question. Questions are regenerated deterministically from the seed on each call, so the
 * correct answer is never sent to the browser before grading and never stored in the token.
 */
import 'server-only';
import { randomBytes } from 'node:crypto';
import db from '@/data/db.json';
import { generateQuiz, toPublic, type Dataset, type PublicRemixQuestion, type RemixQuestion, type EvidenceCard } from '@/lib/sandboxQuizBridge';
import { signPayload, verifyToken, validateSubmission, SESSION_MAX_AGE_MS, type QuizSession, type SessionSource } from '@/lib/quizSecurity';
import { applyAnswer, redemptionPoints, redemptionEligible, xpFor, QUESTION_MS, REDEMPTION_MS, type Wager } from './scoring';
import { composite } from './composite';
import { recordChoice, type QuestionTelemetry } from './telemetry';

const dataset = db as unknown as Dataset;
const knownIds = new Set(dataset.nodes.map((n) => n.id));
export const DISCOVERY_TOTAL = dataset.nodes.filter((n) => !n.hidden).length;

const cache = new Map<string, RemixQuestion[]>();
export function questionsFor(s: Pick<QuizSession, 'seed' | 'n' | 'unlocked'>): RemixQuestion[] {
  const key = `${s.seed}:${s.n}:${s.unlocked ? s.unlocked.join(',') : '*'}`;
  let qs = cache.get(key);
  if (!qs) {
    qs = generateQuiz(dataset, { seed: s.seed, count: s.n, only: s.unlocked });
    if (cache.size > 64) cache.clear();
    cache.set(key, qs);
  }
  return qs;
}

/** Global option-choice distribution per question id (in memory: resets when the server instance recycles). */
const telemetry = new Map<string, number[]>();
export function telemetryFor(qs: readonly RemixQuestion[], correctOnly = false): QuestionTelemetry[] {
  return qs.map((q) => ({ questionId: q.id, prompt: q.prompt, options: q.options, correctIndex: q.answerIndex, counts: telemetry.get(q.id) ?? [0, 0, 0, 0], why: q.why })).filter((t) => !correctOnly || t.counts.some(Boolean));
}

export type StartInput = { source: SessionSource; count?: number; unlocked?: string[]; seed?: number };
export type StartResult = { error: string } | { token: string; total: number; question: PublicRemixQuestion; seed: number; leagueEligible: boolean };

export function leagueFor(s: Pick<QuizSession, 'src' | 'n'>): 'official' | 'community' {
  return s.src !== 'custom' && s.n >= 10 ? 'official' : 'community';
}

export function startSession(input: StartInput, now = Date.now()): StartResult {
  const src = input.source;
  if (src !== 'auto' && src !== 'mine') return { error: 'Unsupported source' };
  const requested = Math.floor(Number(input.count ?? 10));
  const n = Math.min(25, Math.max(3, Number.isFinite(requested) ? requested : 10));
  let unlocked: string[] | undefined;
  if (src === 'mine') {
    unlocked = [...new Set((input.unlocked ?? []).filter((id) => typeof id === 'string' && knownIds.has(id)))].slice(0, 4000).sort();
    if (unlocked.length < 3) return { error: 'Unlock at least 3 discoveries in the Sandbox first.' };
  }
  const seed = Number.isInteger(input.seed) ? (input.seed as number) >>> 0 : randomBytes(4).readUInt32BE(0);
  const qs = questionsFor({ seed, n, unlocked });
  if (qs.length < 3) return { error: 'Not enough discoveries to build a quiz yet.' };
  const session: QuizSession = {
    sid: randomBytes(6).toString('hex'), src, seed, n: qs.length, unlocked, idx: 0, phase: 'main', score: 0, streak: 0, maxStreak: 0, shields: 0, correct: 0,
    missed: [], redeemQueue: [], redeemed: 0, qAt: now, t0: now, rAt: 0, choices: {}, answered: [], v: 1,
  };
  return { token: signPayload(session), total: qs.length, question: toPublic(qs[0]!, 0), seed, leagueEligible: leagueFor(session) === 'official' };
}

const spentSteps = new Map<string, number>();
export type AnswerInput ={ token: string; optionIndex: number; wager?: Wager; pausedMs?: number };
export type AnswerResult =
  | { error: string; status: number }
  | {
    token: string; phase: QuizSession['phase']; wasRedemption: boolean;
    correct: boolean; correctIndex: number; delta: number; why: string[]; evidence: EvidenceCard;
    score: number; streak: number; maxStreak: number; shields: number; shieldUsed: boolean; shieldGained: boolean; streakReset: boolean;
    next: PublicRemixQuestion | null; redemptionStarting: boolean; elapsedMs: number;
    summary?: Summary;
  };
export type Summary = {
  sid: string; total: number; correct: number; score: number; maxStreak: number; redeemed: number; xp: number; missedIds: string[];
  composite: number; league: 'official' | 'community'; telemetry: QuestionTelemetry[];
};

export function answer(input: AnswerInput, now = Date.now()): AnswerResult {
  const s = verifyToken<QuizSession>(input.token);
  if (!s || s.v !== 1) return { error: 'Invalid or tampered session', status: 400 };
  if (now - s.t0 > SESSION_MAX_AGE_MS) return { error: 'Session expired', status: 410 };
  if (s.phase === 'done') return { error: 'Session already finished', status: 409 };
  const qs = questionsFor(s);
  const redemption = s.phase === 'redemption';
  const qIndex = redemption ? s.redeemQueue[0] : s.idx;
  const q = qIndex === undefined ? undefined : qs[qIndex];
  if (!q || qIndex === undefined) return { error: 'No active question', status: 409 };
  if (!redemption && s.answered.includes(qIndex)) return { error: 'Question already answered', status: 409 };
  // Replay guard. The reveal shows the right answer, so without this a player could re-submit the SAME token with the answer
  // they just learned. Each (session, phase, question) step can be graded once. In-memory: per server instance (see report).
  const stepKey = `${s.sid}:${redemption ? 'r' : 'm'}:${qIndex}`;
  if (spentSteps.has(stepKey)) return { error: 'Question already answered', status: 409 };
  spentSteps.set(stepKey, now);
  if (spentSteps.size > 20_000) for (const [k, t] of spentSteps) if (now - t > SESSION_MAX_AGE_MS) spentSteps.delete(k);

  const wager: Wager = input.wager === 'high' ? 'high' : 'standard';
  // Server clock decides timing. A pause reported by the host only ever *reduces* elapsed, and never below zero or by more than the real gap.
  const real = Math.max(0, now - s.qAt);
  const paused = Math.min(real, Math.max(0, Math.floor(Number(input.pausedMs) || 0)));
  const elapsedMs = real - paused;
  const picked = Number.isInteger(input.optionIndex) && input.optionIndex >= 0 && input.optionIndex < q.options.length ? input.optionIndex : -1;
  const late = elapsedMs > (redemption ? 5000 + REDEMPTION_MS : QUESTION_MS + 2500);
  const correct = !late && picked === q.answerIndex;

  const next: QuizSession = { ...s, answered: s.answered.slice(), missed: s.missed.slice(), redeemQueue: s.redeemQueue.slice(), choices: { ...s.choices } };
  let delta = 0; let shieldUsed = false; let shieldGained = false; let streakReset = false;
  if (picked >= 0 && !late) next.choices[q.id] = recordChoice(next.choices[q.id] ?? [], picked, q.options.length);
  if (picked >= 0) telemetry.set(q.id, recordChoice(telemetry.get(q.id) ?? [], picked, q.options.length));

  if (redemption) {
    delta = redemptionPoints(correct, elapsedMs);
    next.score += delta; next.redeemed += delta;
    if (correct) next.correct += 1;
    next.redeemQueue.shift();
  } else {
    const o = applyAnswer(s, { correct, elapsedMs, wager, limitMs: QUESTION_MS });
    next.score = o.score; next.streak = o.streak; next.maxStreak = o.maxStreak; next.shields = o.shields;
    delta = o.delta; shieldUsed = o.shieldUsed; shieldGained = o.shieldGained; streakReset = o.streakReset;
    if (correct) next.correct += 1; else next.missed.push(qIndex);
    next.answered.push(qIndex);
    next.idx = qIndex + 1;
  }

  let nextQ: PublicRemixQuestion | null = null; let redemptionStarting = false;
  if (!redemption && next.idx < next.n) {
    nextQ = toPublic(qs[next.idx]!, next.idx);
  } else if (!redemption && redemptionEligible(next.missed.length)) {
    next.phase = 'redemption'; next.redeemQueue = next.missed.slice(); next.rAt = now; redemptionStarting = true;
    nextQ = toPublic(qs[next.redeemQueue[0]!]!, next.redeemQueue[0]!);
  } else if (redemption && next.redeemQueue.length && now - next.rAt < REDEMPTION_MS) {
    nextQ = toPublic(qs[next.redeemQueue[0]!]!, next.redeemQueue[0]!);
  } else {
    next.phase = 'done'; next.redeemQueue = [];
  }
  next.qAt = now;

  const base = {
    token: signPayload(next), phase: next.phase, wasRedemption: redemption, correct, correctIndex: q.answerIndex, delta, why: q.why, evidence: q.evidenceCard,
    score: next.score, streak: next.streak, maxStreak: next.maxStreak, shields: next.shields, shieldUsed, shieldGained, streakReset, next: nextQ, redemptionStarting, elapsedMs,
  };
  return next.phase === 'done' ? { ...base, summary: summarise(next, qs) } : base;
}

export function summarise(s: QuizSession, qs: readonly RemixQuestion[]): Summary {
  const xp = xpFor(s.score, s.correct);
  const mainCorrect = s.answered.length - s.missed.length;
  return {
    sid: s.sid, total: s.n, correct: s.correct, score: s.score, maxStreak: s.maxStreak, redeemed: s.redeemed, xp,
    missedIds: s.missed.map((i) => qs[i]?.discoveryId).filter((x): x is string => !!x),
    composite: composite({ score: s.score, questionCount: s.n, correct: Math.max(mainCorrect, 0), maxStreak: s.maxStreak, xp }),
    league: leagueFor(s), telemetry: telemetryFor(qs, true),
  };
}

/** Used by the rank route: verifies the token and returns the trusted summary, or the rejection reason. */
export function trustedSummary(token: unknown, now = Date.now()): { ok: true; summary: Summary; session: QuizSession } | { ok: false; reason: string } {
  const s = verifyToken<QuizSession>(token);
  const v = validateSubmission(s, now);
  if (!v.ok || !s) return { ok: false, reason: v.ok ? 'bad-signature' : v.reason };
  return { ok: true, summary: summarise(s, questionsFor(s)), session: s };
}
