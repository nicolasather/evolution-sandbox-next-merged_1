/**
 * Quiz anti-cheat core (server-side): HMAC-SHA256 signed session tokens, room codes, rate limiting,
 * input sanitising. Everything here is pure or uses node:crypto, so it is unit-testable without a database.
 *
 * Threat model it answers:
 *  - reading `correctAnswer` from client state  -> grading happens server-side; tokens carry no answers.
 *  - forging `score: 9999999`                     -> score lives ONLY inside a signed token, re-signed per graded question.
 *  - stored XSS in nicknames / prompts            -> `sanitizeText` strips tags and script vectors, hard length caps.
 *  - brute-forcing short room codes               -> 6 unambiguous chars + sliding-window limiter.
 */
import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, isValidRoomCode } from './roomCode';

/* ── Room codes ───────────────────────────────────────────────────────────────────────────────────────────────────── */
export { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, isValidRoomCode };
export function generateRoomCode(): string {
  let out = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) out += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
  return out;
}
/** Number of distinct codes (31^6 ≈ 8.87e8). */
export const ROOM_CODE_SPACE = ROOM_CODE_ALPHABET.length ** ROOM_CODE_LENGTH;

/* ── Sanitising ───────────────────────────────────────────────────────────────────────────────────────────────────── */
export const LIMITS = Object.freeze({ nickname: 24, title: 80, prompt: 300, option: 120 });
/** Strips HTML tags (including unterminated ones), script-ish URL schemes and control characters, then caps the length. */
export function sanitizeText(raw: unknown, max: number): string {
  if (typeof raw !== 'string') return '';
  let s = raw.normalize('NFKC').replace(/[\p{C}]/gu, ' ');
  let prev: string;
  do { prev = s; s = s.replace(/<[^>]*>?/gm, ''); } while (s !== prev); // loop: "<<b>script>" must not reassemble
  s = s.replace(/(?:javascript|vbscript|data)\s*:/gi, '').replace(/on\w+\s*=/gi, '').replace(/[<>"'`]/g, '');
  return s.replace(/\s+/g, ' ').trim().slice(0, max);
}
export const sanitizeNickname = (raw: unknown) => sanitizeText(raw, LIMITS.nickname);

/* ── Signed tokens ────────────────────────────────────────────────────────────────────────────────────────────────── */
const b64u = (buf: Buffer | string) => Buffer.from(buf).toString('base64url');
let warnedEphemeral = false;
function secret(): string {
  const s = process.env.QUIZ_HMAC_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.AUTH_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === 'production' && !warnedEphemeral) {
    warnedEphemeral = true;
    console.warn('[quizSecurity] QUIZ_HMAC_SECRET is not set: using a per-process secret. Tokens will not survive a restart or span instances.');
  }
  const g = globalThis as { __quizEphemeralSecret?: string };
  return (g.__quizEphemeralSecret ??= randomBytes(32).toString('hex'));
}
export function signPayload<T extends object>(payload: T, key: string = secret()): string {
  const body = b64u(JSON.stringify(payload));
  return `${body}.${b64u(createHmac('sha256', key).update(body).digest())}`;
}
export function verifyToken<T extends object>(token: unknown, key: string = secret()): T | null {
  if (typeof token !== 'string' || token.length > 4096) return null;
  const [body, sig, extra] = token.split('.');
  if (!body || !sig || extra !== undefined) return null;
  const want = createHmac('sha256', key).update(body).digest();
  let got: Buffer;
  try { got = Buffer.from(sig, 'base64url'); } catch { return null; }
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try { return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T; } catch { return null; }
}

/* ── Session state carried in the token ───────────────────────────────────────────────────────────────────────────── */
export type SessionSource = 'auto' | 'mine' | 'custom';
export type QuizSession = {
  sid: string;
  src: SessionSource;
  seed: number;
  n: number;                 // question count
  unlocked?: string[];       // ids used for a "mine" quiz (server re-generates the same questions from these)
  idx: number;               // next question index
  phase: 'main' | 'redemption' | 'done';
  score: number; streak: number; maxStreak: number; shields: number;
  correct: number;
  missed: number[];          // indices answered wrongly in the main phase
  redeemQueue: number[];     // indices still to re-ask
  redeemed: number;          // points recovered
  qAt: number;               // server ms when the current question was handed out
  t0: number;                // server ms when the session started
  rAt: number;               // server ms when the redemption round began (0 until then)
  choices: Record<string, number[]>; // per-question option picks, for telemetry (qIndex -> [count per option])
  answered: number[];        // indices already graded in the main phase (replay guard)
  v: 1;
};
/** Humanly-possible lower bound for an entire session. */
export const MIN_MS_PER_QUESTION = 350;
export const SESSION_MAX_AGE_MS = 30 * 60 * 1000;

export type SubmissionVerdict = { ok: true } | { ok: false; reason: string };
/** Everything a leaderboard write must satisfy beyond a valid signature. */
export function validateSubmission(s: QuizSession | null, now = Date.now()): SubmissionVerdict {
  if (!s) return { ok: false, reason: 'bad-signature' };
  if (s.phase !== 'done') return { ok: false, reason: 'session-not-finished' };
  if (s.answered.length !== s.n) return { ok: false, reason: 'question-count-mismatch' };
  const elapsed = now - s.t0;
  if (elapsed < s.n * MIN_MS_PER_QUESTION) return { ok: false, reason: 'implausibly-fast' };
  if (elapsed > SESSION_MAX_AGE_MS * 4) return { ok: false, reason: 'session-too-old' };
  if (s.correct > s.n || s.score < 0) return { ok: false, reason: 'inconsistent-totals' };
  return { ok: true };
}

/* ── Sliding-window rate limiter ──────────────────────────────────────────────────────────────────────────────────── */
export class SlidingWindowLimiter {
  private hits = new Map<string, number[]>();
  constructor(private max: number, private windowMs: number) {}
  /** Records an attempt and says whether it is allowed. */
  hit(key: string, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.max) { this.hits.set(key, recent); return false; }
    recent.push(now); this.hits.set(key, recent);
    if (this.hits.size > 5000) for (const [k, v] of this.hits) if (!v.some((t) => now - t < this.windowMs)) this.hits.delete(k);
    return true;
  }
  /** Peek without recording (used to block after N failures). */
  blocked(key: string, now = Date.now()): boolean {
    return (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs).length >= this.max;
  }
  reset() { this.hits.clear(); }
}
const g = globalThis as { __quizLimiters?: Record<string, SlidingWindowLimiter> };
const limiters = (g.__quizLimiters ??= {
  roomJoinFail: new SlidingWindowLimiter(5, 60_000),
  rankWrite: new SlidingWindowLimiter(10, 60_000),
  grade: new SlidingWindowLimiter(240, 60_000),
});
export const roomJoinFailLimiter = limiters.roomJoinFail!;
export const rankWriteLimiter = limiters.rankWrite!;
export const gradeLimiter = limiters.grade!;

export function clientKey(req: Request): string {
  const h = req.headers;
  return (h.get('x-forwarded-for')?.split(',')[0] ?? h.get('x-real-ip') ?? 'local').trim().slice(0, 64);
}
