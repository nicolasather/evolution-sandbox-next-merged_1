/** Realtime correctness helpers: server-clock reconciliation (095), ordered updates (093), idempotent submissions (096), reconnect tokens (094). Pure. */

/** NTP-style offset between this device and the server: serverNow ≈ Date.now() + offset. Uses the request midpoint so latency cancels out. */
export function clockOffset(serverNowMs: number, requestStartMs: number, responseEndMs: number): number {
  return serverNowMs - (requestStartMs + responseEndMs) / 2;
}

/** Milliseconds left for a question according to the SERVER clock. While paused the clock is frozen at the pause moment
 *  (the server shifts round_opened_at on resume, so the remaining time is unchanged by the pause). */
export function remainingMs(o: { openedAt: string | null; pausedAt: string | null; limitSeconds: number | null | undefined }, serverNowMs: number): number | null {
  if (!o.limitSeconds || o.limitSeconds <= 0 || !o.openedAt) return null;
  const now = o.pausedAt ? Date.parse(o.pausedAt) : serverNowMs;
  return Math.max(0, Date.parse(o.openedAt) + o.limitSeconds * 1000 - now);
}

/** Accept a polled snapshot only if it is newer than what we show. Equal sequence is a harmless repeat. Missing seq falls back to the server time. */
export type Versioned = { seq?: number | null; serverNow?: string };
export function isNewer(incoming: Versioned, current: Versioned | null): boolean {
  if (!current) return true;
  if (incoming.seq != null && current.seq != null) return incoming.seq >= current.seq;
  return Date.parse(incoming.serverNow ?? '') >= Date.parse(current.serverNow ?? '');
}

/** A submission key stays the same across retries, so the server can return the first result instead of scoring twice. */
export function submissionKey(roomQuestionId: string, actorId: string): string {
  return `${roomQuestionId}:${actorId}`;
}
export type Outcome<T> = { status: 'idle' } | { status: 'pending' } | { status: 'confirmed'; value: T } | { status: 'failed'; message: string; retryable: boolean };
/** The UI may only say "answer accepted" in the confirmed state (item 100). */
export const isAccepted = (o: Outcome<unknown>) => o.status === 'confirmed';

/** Slot race resolver used by tests and by the SQL function's specification: the first N valid submissions win, deterministically. */
export function resolveSlots<T extends { id: string; at: number }>(submissions: T[], slots: number): { accepted: T[]; rejected: T[] } {
  const sorted = [...submissions].sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
  return { accepted: sorted.slice(0, slots), rejected: sorted.slice(slots) };
}

/** Exponential back-off with a cap, used for reconnect storms (098). */
export function backoffMs(attempt: number, base = 800, cap = 15000, rand = Math.random): number {
  const ceiling = Math.min(cap, base * 2 ** Math.min(attempt, 10));
  return Math.round(ceiling / 2 + (rand() * ceiling) / 2);
}
