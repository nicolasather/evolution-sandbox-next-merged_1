/**
 * Two segregated leaderboards. Official: auto/sandbox quizzes with >= 10 questions. Community: everything else.
 * Rows only ever come from server-verified session tokens (see rank route). In-memory per server instance, 24 h TTL;
 * swap `store` for a table when persistent ranking is wanted.
 */
import { composite, tierFor, type CompositeInput } from './composite';
import { purgeExpiredMap } from '../../legalCompliance';

export type League = 'official' | 'community';
export type LeagueRow = {
  sid: string; playerKey: string; nickname: string; league: League; createdAt: number;
  score: number; correct: number; total: number; maxStreak: number; xp: number; composite: number;
};
const g = globalThis as { __remixLeagues?: Map<string, LeagueRow> };
const store = (g.__remixLeagues ??= new Map<string, LeagueRow>());
export const LEAGUE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // ranked results live a week; classroom rooms are purged at 24 h elsewhere

export function submit(row: Omit<LeagueRow, 'composite' | 'createdAt'>, now = Date.now()): LeagueRow {
  purgeExpiredMap(store, now, LEAGUE_TTL_MS);
  const full: LeagueRow = { ...row, createdAt: now, composite: composite({ score: row.score, questionCount: row.total, correct: row.correct, maxStreak: row.maxStreak, xp: row.xp } satisfies CompositeInput) };
  store.set(row.sid, full); // keyed by session id: the same signed session can never be counted twice
  return full;
}
export function has(sid: string) { return store.has(sid); }

/** Best row per player, sorted by composite. Per-player aggregation keeps one grinder from filling the table. */
export function board(league: League, limit = 50) {
  const best = new Map<string, LeagueRow>();
  for (const r of store.values()) {
    if (r.league !== league) continue;
    const cur = best.get(r.playerKey);
    if (!cur || r.composite > cur.composite) best.set(r.playerKey, r);
  }
  return [...best.values()].sort((a, b) => b.composite - a.composite || b.score - a.score).slice(0, limit)
    .map((r, i) => ({ rank: i + 1, nickname: r.nickname, composite: r.composite, score: r.score, accuracy: r.total ? r.correct / r.total : 0, maxStreak: r.maxStreak, xp: r.xp, tier: tierFor(r.composite, i + 1), questions: r.total, playerKey: r.playerKey }));
}
/** Right to erasure: removes every row for a player key. Returns how many were removed. */
export function erase(playerKey: string): number {
  let n = 0; for (const [k, r] of store) if (r.playerKey === playerKey) { store.delete(k); n++; } return n;
}
export function _resetForTests() { store.clear(); }

/* ── Quiz takedown reports ───────────────────────────────────────────────────────────────────────────────────────── */
const rg = globalThis as { __remixReports?: Map<string, { quizId: string; reason: string; at: number }> };
const reports = (rg.__remixReports ??= new Map());
export function reportQuiz(quizId: string, reason: string, now = Date.now()) { reports.set(quizId, { quizId, reason, at: now }); }
/** A reported community quiz is hidden from public listings immediately, pending review. */
export const isHiddenByReport = (quizId: string) => reports.has(quizId);
